-- MIGRATION 011 : table de liaison élève <-> responsable légal (idempotent)
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'guardian_relationship_enum') THEN
        CREATE TYPE guardian_relationship_enum AS ENUM ('PERE', 'MERE', 'TUTEUR', 'AUTRE');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS student_guardian_links (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    guardian_id uuid NOT NULL REFERENCES guardians(id) ON DELETE RESTRICT,
    relationship guardian_relationship_enum NOT NULL,
    is_primary_contact boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_student_guardian_link UNIQUE (student_id, guardian_id)
);

CREATE INDEX IF NOT EXISTS idx_student_guardian_links_student_id
    ON student_guardian_links (student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardian_links_guardian_id
    ON student_guardian_links (guardian_id);

-- Un seul contact principal par élève
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_primary_contact_per_student
    ON student_guardian_links (student_id)
    WHERE is_primary_contact = true;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE event_object_table = 'student_guardian_links'
        AND trigger_name = 'trg_student_guardian_links_set_updated_at'
    ) THEN
        CREATE TRIGGER trg_student_guardian_links_set_updated_at
            BEFORE UPDATE ON student_guardian_links
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    END IF;
END $$;

COMMIT;