-- Autorise les colonnes facultatives que SQLAlchemy envoie explicitement
-- à NULL pendant la création d'un compte.
BEGIN;

GRANT INSERT (
    locked_until,
    last_login_at,
    archived_at
) ON accounts TO blaise_app;

COMMIT;
