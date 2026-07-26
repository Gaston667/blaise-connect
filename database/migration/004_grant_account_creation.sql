-- =========================================================
-- MIGRATION 004 : création des comptes par l'application
-- =========================================================
-- User Story : US-002

BEGIN;

-- Le backend fournit ces trois colonnes. Les autres valeurs sont générées
-- par PostgreSQL ou initialisées par leur valeur par défaut.
GRANT INSERT (
    registration_number,
    password_hash,
    role
)
ON TABLE accounts
TO blaise_app;

COMMIT;
