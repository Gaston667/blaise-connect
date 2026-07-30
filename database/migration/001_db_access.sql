-- =========================================================
-- MIGRATION 001 : accès minimal du rôle applicatif
-- =========================================================
-- Cette migration ne dépend d'aucune table applicative.

BEGIN;

REVOKE CONNECT, TEMPORARY
    ON DATABASE blaise_connect
    FROM PUBLIC;

REVOKE CREATE, USAGE
    ON SCHEMA public
    FROM PUBLIC;

GRANT CONNECT
    ON DATABASE blaise_connect
    TO blaise_app;

GRANT USAGE
    ON SCHEMA public
    TO blaise_app;

COMMIT;
