-- MIGRATION 007 : création idempotente de la table students
-- Crée la table `students` et le type `student_status_enum` si nécessaire.

BEGIN;

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Crée le type d'énumération si absent
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'student_status_enum') THEN
        CREATE TYPE student_status_enum AS ENUM ('ACTIVE','INACTIVE','ARCHIVED');
    END IF;
END
$$;

-- Crée la table students si elle n'existe pas encore
CREATE TABLE IF NOT EXISTS students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL UNIQUE,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    birth_date date,
    gender varchar(20),
    email varchar(254),
    phone varchar(30),
    address text,
    admission_date date NOT NULL,
    status student_status_enum NOT NULL DEFAULT 'ACTIVE',
    photo_path varchar(500),
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_students_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CONSTRAINT ck_students_first_name CHECK (char_length(btrim(first_name)) > 0),
    CONSTRAINT ck_students_last_name CHECK (char_length(btrim(last_name)) > 0),
    CONSTRAINT ck_students_birth_date CHECK (birth_date IS NULL OR birth_date <= admission_date),
    CONSTRAINT ck_students_archived_at CHECK (archived_at IS NULL OR archived_at >= created_at),
    CONSTRAINT ck_students_status_archived_at CHECK (
        (status = 'ARCHIVED' AND archived_at IS NOT NULL)
        OR
        (status IN ('ACTIVE','INACTIVE') AND archived_at IS NULL)
    )
);

COMMIT;
