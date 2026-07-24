-- =========================================================
-- MIGRATION 003 : privilèges minimaux du rôle applicatif
-- =========================================================
-- User Stories : US-001 et US-025
-- Le backend accède uniquement aux colonnes nécessaires à
-- l'authentification et à la gestion des sessions.

BEGIN;

-- Empêche les rôles non autorisés de se connecter ou de créer des objets.
REVOKE CONNECT, TEMPORARY
    ON DATABASE blaise_connect
    FROM PUBLIC;

REVOKE CREATE, USAGE
    ON SCHEMA public
    FROM PUBLIC;

-- Autorise uniquement l'accès à la base et au schéma existants.
GRANT CONNECT
    ON DATABASE blaise_connect
    TO blaise_app;

GRANT USAGE
    ON SCHEMA public
    TO blaise_app;

-- Authentification : lecture du compte et mise à jour de son état de sécurité.
GRANT SELECT
    ON TABLE accounts
    TO blaise_app;

GRANT UPDATE (
    failed_login_attempts,
    locked_until,
    last_login_at,
    updated_at
)
    ON TABLE accounts
    TO blaise_app;

-- Sessions : création, consultation, activité et révocation seulement.
GRANT SELECT
    ON TABLE auth_sessions
    TO blaise_app;

GRANT INSERT (
    account_id,
    session_token_hash
)
    ON TABLE auth_sessions
    TO blaise_app;

GRANT UPDATE (
    last_activity_at,
    revoked_at
)
    ON TABLE auth_sessions
    TO blaise_app;

COMMIT;
