-- =========================================================
-- COMPTES FICTIFS DE DEVELOPPEMENT
-- =========================================================
-- Mot de passe commun : test@1234
-- Ce fichier est exécuté uniquement à la première création du volume.

INSERT INTO accounts (
    registration_number,
    password_hash,
    role
)
SELECT
    'a' || lpad(account_number::text, 6, '0'),
    '$argon2id$v=19$m=65536,t=3,p=4$fdzl7sb+dyZM9pHYxntmkw$52e5qk6b3tG8l+6BGx7tG997wmj9NNhOnr2MDm+M7bg',
    'ADMIN'
FROM generate_series(1, 4) AS account_number

UNION ALL

SELECT
    'e' || lpad(account_number::text, 6, '0'),
    '$argon2id$v=19$m=65536,t=3,p=4$fdzl7sb+dyZM9pHYxntmkw$52e5qk6b3tG8l+6BGx7tG997wmj9NNhOnr2MDm+M7bg',
    'TEACHER'
FROM generate_series(1, 10) AS account_number

UNION ALL

SELECT
    'u' || lpad(account_number::text, 6, '0'),
    '$argon2id$v=19$m=65536,t=3,p=4$fdzl7sb+dyZM9pHYxntmkw$52e5qk6b3tG8l+6BGx7tG997wmj9NNhOnr2MDm+M7bg',
    'STUDENT'
FROM generate_series(1, 30) AS account_number

UNION ALL

SELECT
    'p' || lpad(account_number::text, 6, '0'),
    '$argon2id$v=19$m=65536,t=3,p=4$fdzl7sb+dyZM9pHYxntmkw$52e5qk6b3tG8l+6BGx7tG997wmj9NNhOnr2MDm+M7bg',
    'GUARDIAN'
FROM generate_series(1, 30) AS account_number

ON CONFLICT (registration_number) DO NOTHING;
