-- Autorise SQLAlchemy à insérer explicitement revoked_at = NULL
-- lors de la création d'une session de connexion.
BEGIN;

GRANT INSERT (
    revoked_at
) ON auth_sessions TO blaise_app;

COMMIT;
