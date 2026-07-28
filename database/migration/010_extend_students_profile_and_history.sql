-- MIGRATION 010 : enrichit students (profil complet) + historique de statut (idempotent)
BEGIN;

-- Colonnes de profil supplémentaires
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='birth_place') THEN
        ALTER TABLE students ADD COLUMN birth_place varchar(150);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='nationality') THEN
        ALTER TABLE students ADD COLUMN nationality varchar(100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='previous_level') THEN
        ALTER TABLE students ADD COLUMN previous_level varchar(100);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='observations') THEN
        ALTER TABLE students ADD COLUMN observations text;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='internal_code') THEN
        ALTER TABLE students ADD COLUMN internal_code varchar(50);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_students_internal_code'
    ) THEN
        ALTER TABLE students ADD CONSTRAINT uq_students_internal_code UNIQUE (internal_code);
    END IF;
END $$;

-- Traçabilité de la dernière modification
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='students' AND column_name='updated_by_account_id') THEN
        ALTER TABLE students ADD COLUMN updated_by_account_id uuid REFERENCES accounts(id);
    END IF;
END $$;

-- Table d'historique des changements de statut
CREATE TABLE IF NOT EXISTS student_status_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    status student_status_enum NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    changed_by_account_id uuid REFERENCES accounts(id),
    note text
);

CREATE INDEX IF NOT EXISTS idx_student_status_history_student_id
    ON student_status_history (student_id, changed_at DESC);

-- Fonction + trigger : enregistre automatiquement chaque changement de
-- statut dans l'historique, pour éviter de répéter cette logique dans
-- chaque action (archiver / désactiver / réactiver).
CREATE OR REPLACE FUNCTION log_student_status_change() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO student_status_history (student_id, status, changed_by_account_id)
        VALUES (NEW.id, NEW.status, NEW.updated_by_account_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_students_log_status_change ON students;
CREATE TRIGGER trg_students_log_status_change
    AFTER INSERT OR UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION log_student_status_change();

COMMIT;