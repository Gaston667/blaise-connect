-- Migration additive : la fonction d'un administrateur devient facultative.
BEGIN;

ALTER TABLE administrators
    ALTER COLUMN job_title DROP NOT NULL;

ALTER TABLE administrators
    DROP CONSTRAINT ck_administrators_job_title;

ALTER TABLE administrators
    ADD CONSTRAINT ck_administrators_job_title
    CHECK (job_title IS NULL OR char_length(btrim(job_title)) > 0);

COMMIT;
