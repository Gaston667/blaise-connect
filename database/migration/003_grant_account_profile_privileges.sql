-- =========================================================
-- MIGRATION 003 : droits applicatifs sur comptes et profils
-- =========================================================
-- Principe du moindre privilège : SELECT, INSERT et UPDATE utiles.
-- Aucun droit DELETE n'est accordé.

BEGIN;

GRANT SELECT ON TABLE
    accounts,
    auth_sessions,
    students,
    teachers,
    administrators,
    guardians
TO blaise_app;

GRANT INSERT (
    registration_number,
    password_hash,
    role
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
    email, phone, address, admission_date, status, photo_path, archived_at
) ON students TO blaise_app;

GRANT UPDATE (
    first_name, last_name, birth_date, gender,
    email, phone, address, admission_date, status, photo_path, archived_at
) ON students TO blaise_app;

GRANT INSERT (
    account_id, first_name, last_name, birth_date, gender,
    email, phone, address, hire_date, qualification, photo_path, archived_at
) ON teachers TO blaise_app;

GRANT UPDATE (
    first_name, last_name, birth_date, gender,
    email, phone, address, hire_date, qualification, photo_path, archived_at
) ON teachers TO blaise_app;

GRANT INSERT (
    account_id, first_name, last_name, gender,
    email, phone, address, hire_date, job_title, photo_path, archived_at
) ON administrators TO blaise_app;

GRANT UPDATE (
    first_name, last_name, gender,
    email, phone, address, hire_date, job_title, photo_path, archived_at
) ON administrators TO blaise_app;

GRANT INSERT (
    account_id, first_name, last_name, gender,
    email, phone, address, occupation, employer, photo_path, archived_at
) ON guardians TO blaise_app;

GRANT UPDATE (
    account_id, first_name, last_name, gender,
    email, phone, address, occupation, employer, photo_path, archived_at
) ON guardians TO blaise_app;

GRANT INSERT (
    account_id,
    session_token_hash
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
    guardians
FROM blaise_app;

COMMIT;
