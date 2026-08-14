-- =========================================================
-- MIGRATION 002 : comptes, profils et droits applicatifs
-- =========================================================
-- Fusionne :
--   - création des tables (comptes, profils, sessions, historique)
--   - triggers, fonctions de protection et d'audit
--   - droits colonne par colonne du rôle blaise_app
-- La colonne observations n'existe pas dans ce schéma propre.
-- =========================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Le statut scolaire est indépendant de l'état du compte de connexion.
CREATE TYPE student_status_enum AS ENUM (
    'ACTIVE',
    'INACTIVE',
    'ARCHIVED'
);

-- =========================================================
-- 1. COMPTES
-- =========================================================

CREATE TABLE accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_number varchar(50) NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role varchar(20) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    failed_login_attempts smallint NOT NULL DEFAULT 0,
    locked_until timestamptz,
    last_login_at timestamptz,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ck_accounts_role
        CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN', 'GUARDIAN')),

    -- a = administrateur, e = enseignant, u = élève, p = responsable.
    CONSTRAINT ck_accounts_registration_number
        CHECK (registration_number ~ '^[aeup][0-9]{6}$'),

    CONSTRAINT ck_accounts_password_hash
        CHECK (char_length(btrim(password_hash)) >= 20),

    CONSTRAINT ck_accounts_failed_login_attempts
        CHECK (failed_login_attempts >= 0),

    CONSTRAINT ck_accounts_archived_inactive
        CHECK (archived_at IS NULL OR is_active = false)
);

-- =========================================================
-- 2. PROFILS
-- =========================================================

CREATE TABLE students (
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
    birth_place varchar(150),
    nationality varchar(100) NOT NULL,
    previous_level varchar(100),
    updated_by_account_id uuid,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_students_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_updated_by_account
        FOREIGN KEY (updated_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_students_first_name
        CHECK (char_length(btrim(first_name)) > 0),

    CONSTRAINT ck_students_last_name
        CHECK (char_length(btrim(last_name)) > 0),

    CONSTRAINT ck_students_nationality_required
        CHECK (char_length(btrim(nationality)) > 0),

    CONSTRAINT ck_students_birth_date
        CHECK (birth_date IS NULL OR birth_date <= admission_date),

    CONSTRAINT ck_students_archived_at
        CHECK (archived_at IS NULL OR archived_at >= created_at),

    CONSTRAINT ck_students_status_archived_at
        CHECK (
            (status = 'ARCHIVED' AND archived_at IS NOT NULL)
            OR
            (status IN ('ACTIVE', 'INACTIVE') AND archived_at IS NULL)
        )
);

CREATE TABLE teachers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL UNIQUE,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    birth_date date,
    gender varchar(20),
    email varchar(254),
    phone varchar(30),
    address text,
    hire_date date NOT NULL,
    qualification text,
    nationality varchar(100) NOT NULL,
    photo_path varchar(500),
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_teachers_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_teachers_first_name
        CHECK (char_length(btrim(first_name)) > 0),

    CONSTRAINT ck_teachers_last_name
        CHECK (char_length(btrim(last_name)) > 0),

    CONSTRAINT ck_teachers_nationality_required
        CHECK (char_length(btrim(nationality)) > 0),

    CONSTRAINT ck_teachers_birth_date
        CHECK (birth_date IS NULL OR birth_date <= hire_date),

    CONSTRAINT ck_teachers_archived_at
        CHECK (archived_at IS NULL OR archived_at >= created_at)
);

CREATE TABLE administrators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL UNIQUE,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    gender varchar(20),
    email varchar(254),
    phone varchar(30),
    address text,
    hire_date date NOT NULL,
    job_title varchar(100) NOT NULL,
    nationality varchar(100) NOT NULL,
    photo_path varchar(500),
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_administrators_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_administrators_first_name
        CHECK (char_length(btrim(first_name)) > 0),

    CONSTRAINT ck_administrators_last_name
        CHECK (char_length(btrim(last_name)) > 0),

    CONSTRAINT ck_administrators_job_title
        CHECK (char_length(btrim(job_title)) > 0),

    CONSTRAINT ck_administrators_nationality_required
        CHECK (char_length(btrim(nationality)) > 0),

    CONSTRAINT ck_administrators_archived_at
        CHECK (archived_at IS NULL OR archived_at >= created_at)
);

-- account_id est facultatif : un responsable peut exister sans compte.
CREATE TABLE guardians (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid UNIQUE,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    gender varchar(20),
    email varchar(254),
    phone varchar(30) NOT NULL,
    address text,
    occupation varchar(150),
    employer varchar(150),
    nationality varchar(100) NOT NULL,
    photo_path varchar(500),
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_guardians_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_guardians_first_name
        CHECK (char_length(btrim(first_name)) > 0),

    CONSTRAINT ck_guardians_last_name
        CHECK (char_length(btrim(last_name)) > 0),

    CONSTRAINT ck_guardians_nationality_required
        CHECK (char_length(btrim(nationality)) > 0),

    CONSTRAINT ck_guardians_archived_at
        CHECK (archived_at IS NULL OR archived_at >= created_at)
);

-- =========================================================
-- 3. SESSIONS ET HISTORIQUE
-- =========================================================

CREATE TABLE auth_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    session_token_hash char(64) NOT NULL,
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_auth_sessions PRIMARY KEY (id),

    CONSTRAINT fk_auth_sessions_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_auth_sessions_token_hash
        UNIQUE (session_token_hash),

    CONSTRAINT ck_auth_sessions_token_hash
        CHECK (session_token_hash ~ '^[0-9a-f]{64}$'),

    CONSTRAINT ck_auth_sessions_last_activity
        CHECK (last_activity_at >= created_at),

    CONSTRAINT ck_auth_sessions_revoked_at
        CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

CREATE INDEX idx_auth_sessions_account_id
    ON auth_sessions (account_id);

CREATE TABLE student_status_history (
    id uuid
        CONSTRAINT pk_student_status_history PRIMARY KEY
        DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    status student_status_enum NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    changed_by_account_id uuid,
    note text,

    CONSTRAINT fk_student_status_history_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_student_status_history_changed_by
        FOREIGN KEY (changed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE SET NULL
);

CREATE INDEX idx_student_status_history_student_id
    ON student_status_history (student_id, changed_at DESC);

CREATE UNIQUE INDEX uq_teachers_email_ci
    ON teachers (lower(email))
    WHERE email IS NOT NULL;

-- =========================================================
-- 4. TRIGGERS ET FONCTIONS
-- =========================================================

-- Mise à jour automatique de updated_at.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_set_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_students_set_updated_at
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teachers_set_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_administrators_set_updated_at
BEFORE UPDATE ON administrators
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_guardians_set_updated_at
BEFORE UPDATE ON guardians
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Journal des changements de statut d'un élève.
CREATE OR REPLACE FUNCTION log_student_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_OP = 'INSERT'
       OR NEW.status IS DISTINCT FROM OLD.status
    THEN
        INSERT INTO public.student_status_history (
            student_id,
            status,
            changed_by_account_id
        )
        VALUES (
            NEW.id,
            NEW.status,
            NEW.updated_by_account_id
        );
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_students_log_status_change
AFTER INSERT OR UPDATE OF status ON students
FOR EACH ROW
EXECUTE FUNCTION log_student_status_change();

-- Matricule et rôle immuables après création.
CREATE OR REPLACE FUNCTION protect_account_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.registration_number IS DISTINCT FROM OLD.registration_number THEN
        RAISE EXCEPTION 'Le matricule ne peut pas être modifié.';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Le rôle du compte ne peut pas être modifié.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_protect_identity
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION protect_account_identity();

-- Vérifie que le rôle du compte correspond au profil lié.
CREATE OR REPLACE FUNCTION check_profile_account_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    account_role varchar(20);
    expected_role varchar(20);
BEGIN
    expected_role := TG_ARGV[0];

    IF NEW.account_id IS NULL THEN
        IF expected_role = 'GUARDIAN' THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Un compte est obligatoire pour ce profil.';
    END IF;

    SELECT role INTO account_role
      FROM accounts
     WHERE id = NEW.account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Le compte associé est introuvable.';
    END IF;

    IF account_role <> expected_role THEN
        RAISE EXCEPTION
            'Rôle incorrect : rôle attendu %, rôle reçu %.',
            expected_role, account_role;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_students_check_account_role
AFTER INSERT OR UPDATE ON students
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_profile_account_role('STUDENT');

CREATE CONSTRAINT TRIGGER trg_teachers_check_account_role
AFTER INSERT OR UPDATE ON teachers
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_profile_account_role('TEACHER');

CREATE CONSTRAINT TRIGGER trg_administrators_check_account_role
AFTER INSERT OR UPDATE ON administrators
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_profile_account_role('ADMIN');

CREATE CONSTRAINT TRIGGER trg_guardians_check_account_role
AFTER INSERT OR UPDATE ON guardians
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_profile_account_role('GUARDIAN');

-- Archivage atomique : un profil archivé exige un compte inactif et archivé.
CREATE OR REPLACE FUNCTION check_archived_profile_account()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    linked_account_active boolean;
    linked_account_archived_at timestamptz;
BEGIN
    IF NEW.archived_at IS NULL OR NEW.account_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT a.is_active, a.archived_at
      INTO linked_account_active, linked_account_archived_at
      FROM accounts AS a
     WHERE a.id = NEW.account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'Le compte du profil archivé est introuvable.';
    END IF;

    IF linked_account_active OR linked_account_archived_at IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Le compte lié doit être inactif et archivé avant la fin de la transaction.';
    END IF;

    RETURN NEW;
END;
$$;

-- Sens inverse : un compte réactivé/désarchivé ne peut pas avoir de profil archivé.
CREATE OR REPLACE FUNCTION check_account_archived_profiles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_active = false AND NEW.archived_at IS NOT NULL THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1 FROM students      AS s WHERE s.account_id = NEW.id AND s.archived_at IS NOT NULL
        UNION ALL
        SELECT 1 FROM teachers      AS t WHERE t.account_id = NEW.id AND t.archived_at IS NOT NULL
        UNION ALL
        SELECT 1 FROM administrators AS a WHERE a.account_id = NEW.id AND a.archived_at IS NOT NULL
        UNION ALL
        SELECT 1 FROM guardians     AS g WHERE g.account_id = NEW.id AND g.archived_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Un compte lié à un profil archivé doit rester inactif et archivé.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_students_check_archived_account
AFTER INSERT OR UPDATE OF account_id, archived_at ON students
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_archived_profile_account();

CREATE CONSTRAINT TRIGGER trg_teachers_check_archived_account
AFTER INSERT OR UPDATE OF account_id, archived_at ON teachers
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_archived_profile_account();

CREATE CONSTRAINT TRIGGER trg_administrators_check_archived_account
AFTER INSERT OR UPDATE OF account_id, archived_at ON administrators
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_archived_profile_account();

CREATE CONSTRAINT TRIGGER trg_guardians_check_archived_account
AFTER INSERT OR UPDATE OF account_id, archived_at ON guardians
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_archived_profile_account();

CREATE CONSTRAINT TRIGGER trg_accounts_check_archived_profiles
AFTER UPDATE OF is_active, archived_at ON accounts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_account_archived_profiles();

-- =========================================================
-- 5. DROITS APPLICATIFS (principe du moindre privilège)
-- =========================================================

GRANT SELECT ON TABLE
    accounts,
    auth_sessions,
    students,
    teachers,
    administrators,
    guardians,
    student_status_history
TO blaise_app;

GRANT INSERT (
    registration_number, password_hash, role,
    locked_until, last_login_at, archived_at
) ON accounts TO blaise_app;

GRANT UPDATE (
    password_hash,
    is_active,
    failed_login_attempts,
    locked_until,
    last_login_at,
    archived_at,
    updated_at
) ON accounts TO blaise_app;

GRANT INSERT (
    account_id, first_name, last_name, birth_date, gender,
    email, phone, address, admission_date, status, photo_path,
    birth_place, nationality, previous_level,
    updated_by_account_id, archived_at
) ON students TO blaise_app;

GRANT UPDATE (
    first_name, last_name, birth_date, gender,
    email, phone, address, admission_date, status, photo_path,
    birth_place, nationality, previous_level,
    updated_by_account_id, archived_at, updated_at
) ON students TO blaise_app;

GRANT INSERT (
    account_id, first_name, last_name, birth_date, gender,
    email, phone, address, hire_date, qualification, nationality, photo_path, archived_at
) ON teachers TO blaise_app;

GRANT UPDATE (
    first_name, last_name, birth_date, gender,
    email, phone, address, hire_date, qualification, nationality, photo_path, archived_at
) ON teachers TO blaise_app;

GRANT INSERT (
    account_id, first_name, last_name, gender,
    email, phone, address, hire_date, job_title, nationality, photo_path, archived_at
) ON administrators TO blaise_app;

GRANT UPDATE (
    first_name, last_name, gender,
    email, phone, address, hire_date, job_title, nationality, photo_path, archived_at
) ON administrators TO blaise_app;

GRANT INSERT (
    account_id, first_name, last_name, gender,
    email, phone, address, occupation, employer, nationality, photo_path, archived_at
) ON guardians TO blaise_app;

GRANT UPDATE (
    account_id, first_name, last_name, gender,
    email, phone, address, occupation, employer, nationality, photo_path, archived_at
) ON guardians TO blaise_app;

GRANT INSERT (
    account_id,
    session_token_hash,
    revoked_at
) ON auth_sessions TO blaise_app;

GRANT UPDATE (
    last_activity_at,
    revoked_at
) ON auth_sessions TO blaise_app;

REVOKE DELETE ON TABLE
    accounts,
    auth_sessions,
    students,
    teachers,
    administrators,
    guardians,
    student_status_history
FROM blaise_app;

COMMIT;
