-- MIGRATION 009 : ajoute colonnes manquantes à students (idempotent)

BEGIN;

-- Crée le type student_status_enum si nécessaire
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status_enum') THEN
        CREATE TYPE student_status_enum AS ENUM ('ACTIVE','INACTIVE','ARCHIVED');
    END IF;
END
$$;

-- Ajoute la colonne status si absente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='status'
    ) THEN
        ALTER TABLE students ADD COLUMN status student_status_enum NOT NULL DEFAULT 'ACTIVE';
    END IF;
END
$$;

-- Ajoute la colonne photo_path si absente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='photo_path'
    ) THEN
        ALTER TABLE students ADD COLUMN photo_path varchar(500);
    END IF;
END
$$;

-- Ajoute la colonne archived_at si absente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='students' AND column_name='archived_at'
    ) THEN
        ALTER TABLE students ADD COLUMN archived_at timestamptz;
    END IF;
END
$$;

-- Ajoute la contrainte ck_students_archived_at si absente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_students_archived_at'
    ) THEN
        ALTER TABLE students ADD CONSTRAINT ck_students_archived_at CHECK (archived_at IS NULL OR archived_at >= created_at);
    END IF;
END
$$;

-- Ajoute la contrainte ck_students_status_archived_at si absente
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_students_status_archived_at'
    ) THEN
        ALTER TABLE students ADD CONSTRAINT ck_students_status_archived_at CHECK (
            (status = 'ARCHIVED' AND archived_at IS NOT NULL)
            OR
            (status IN ('ACTIVE','INACTIVE') AND archived_at IS NULL)
        );
    END IF;
END
$$;

COMMIT;
