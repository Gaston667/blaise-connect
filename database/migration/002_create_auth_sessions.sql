-- ========================================
-- MIGRATION 002 : Sessions d'authentification
-- ========================================
-- User Stories : US-001 et US-025
-- Objectif : conserver les sessions contrôlées par le backend et permettre
-- leur expiration après 15 minutes d'inactivité.
--
-- Le délai de 15 minutes est appliqué par FastAPI en comparant l'heure
-- courante à last_activity_at. La base conserve les données nécessaires,
-- mais ne décide pas seule si une session est expirée.
--
-- Le jeton de session brut ne doit jamais être enregistré dans PostgreSQL.
-- Seul son hash SHA-256, représenté par 64 caractères hexadécimaux, est stocké.
-- ========================================

BEGIN;

CREATE TABLE auth_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL,
    session_token_hash char(64) NOT NULL,
    last_activity_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_auth_sessions
        PRIMARY KEY (id),

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

-- Accélère la recherche et la révocation des sessions d'un compte.
CREATE INDEX idx_auth_sessions_account_id
    ON auth_sessions (account_id);

-- Le rôle applicatif peut créer, consulter et révoquer une session.
-- La suppression physique reste réservée au rôle de migration.
GRANT SELECT, INSERT, UPDATE
    ON TABLE auth_sessions
    TO blaise_app;

COMMIT;
