BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='classes' AND column_name='observations'
    ) THEN
        ALTER TABLE classes ADD COLUMN observations text;
    END IF;
END $$;

COMMIT;