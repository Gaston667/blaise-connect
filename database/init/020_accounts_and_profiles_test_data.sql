-- =========================================================
-- DONNEES DE TEST - ELEVES, RESPONSABLES LEGAUX, ENSEIGNANTS
-- =========================================================
-- Dépend de :
--   001_db_access.sql
--   002_accounts_and_profiles.sql
--
-- Contenu :
--   - 60 comptes + profils élèves
--   - 60 comptes + profils responsables légaux
--   - 10 comptes + profils enseignants
--
-- Mot de passe commun : test@1234
-- Script idempotent : rejouable sans créer de doublons.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. COMPTES DE TEST
-- =========================================================

INSERT INTO accounts (
    registration_number,
    password_hash,
    role,
    is_active,
    failed_login_attempts,
    locked_until,
    last_login_at,
    archived_at
)
SELECT
    account_prefix || lpad(account_number::text, 6, '0'),
    '$argon2id$v=19$m=65536,t=3,p=4$fdzl7sb+dyZM9pHYxntmkw$52e5qk6b3tG8l+6BGx7tG997wmj9NNhOnr2MDm+M7bg',
    account_role,
    true,
    0,
    NULL,
    TIMESTAMPTZ '2026-08-01 08:00:00+00'
        + account_number * INTERVAL '5 minutes',
    NULL
FROM (
    SELECT 'a', account_number, 'ADMIN'
    FROM generate_series(1, 3) AS account_number

    UNION ALL

    SELECT 'e', account_number, 'TEACHER'
    FROM generate_series(1, 10) AS account_number

    UNION ALL

    SELECT 'u', account_number, 'STUDENT'
    FROM generate_series(1, 60) AS account_number

    UNION ALL

    SELECT 'p', account_number, 'GUARDIAN'
    FROM generate_series(1, 60) AS account_number
) AS generated_accounts(
    account_prefix,
    account_number,
    account_role
)
ON CONFLICT (registration_number) DO NOTHING;


-- =========================================================
-- 2. PROFILS ADMINISTRATEURS
-- =========================================================

INSERT INTO administrators (
    account_id,
    first_name,
    last_name,
    gender,
    nationality,
    email,
    phone,
    address,
    hire_date,
    job_title,
    archived_at
)
SELECT
    account.id,
    (ARRAY['Aminata', 'Mamadou', 'Hawa'])[profile_number],
    (ARRAY['Diallo', 'Camara', 'Bah'])[profile_number],
    CASE WHEN profile_number = 1 THEN 'FEMALE' ELSE 'MALE' END,
    'Guinéenne',
    account.registration_number || '@blaiseconnect.test',
    '+224620100' || lpad(profile_number::text, 3, '0'),
    profile_number || ' rue de l''Administration, Kamsar',
    DATE '2019-09-01' + (profile_number * 90),
    (ARRAY['Directrice adjointe', 'Secrétaire général', 'Gestionnaire'])[profile_number],
    NULL
FROM accounts AS account
CROSS JOIN LATERAL (
    SELECT substring(account.registration_number FROM 2)::integer
) AS profile(profile_number)
WHERE account.role = 'ADMIN'
  AND substring(account.registration_number FROM 2)::integer BETWEEN 1 AND 3
ON CONFLICT (account_id) DO NOTHING;


-- =========================================================
-- 3. PROFILS ENSEIGNANTS
-- =========================================================

INSERT INTO teachers (
    account_id,
    first_name,
    last_name,
    birth_date,
    gender,
    nationality,
    email,
    phone,
    address,
    hire_date,
    qualification,
    photo_path,
    archived_at
)
SELECT
    account.id,
    (ARRAY[
        'Ibrahima', 'Mariama', 'Ousmane', 'Aissatou', 'Alpha',
        'Kadiatou', 'Moussa', 'Fatoumata', 'Abdoulaye', 'Nene'
    ])[profile_number],
    (ARRAY[
        'Sylla', 'Conde', 'Barry', 'Keita', 'Sow',
        'Toure', 'Camara', 'Diallo', 'Bah', 'Cisse'
    ])[profile_number],
    DATE '1980-01-10' + (profile_number * 620),
    CASE
        WHEN profile_number % 2 = 0 THEN 'FEMALE'
        ELSE 'MALE'
    END,
    'Guinéenne',
    account.registration_number || '@blaiseconnect.test',
    '+224621200' || lpad(profile_number::text, 3, '0'),
    profile_number || ' rue des Enseignants, Kamsar',
    DATE '2018-09-01' + (profile_number * 30),
    (ARRAY[
        'Licence Mathematiques',
        'Master Lettres',
        'Licence Anglais',
        'Master Histoire',
        'Licence Biologie',
        'Master Informatique',
        'Licence Physique',
        'Master Geographie',
        'Licence Chimie',
        'Master Philosophie'
    ])[profile_number],
    '/photos/teachers/' || account.registration_number || '.jpg',
    NULL
FROM accounts AS account
CROSS JOIN LATERAL (
    SELECT substring(account.registration_number FROM 2)::integer
) AS profile(profile_number)
WHERE account.role = 'TEACHER'
  AND substring(account.registration_number FROM 2)::integer BETWEEN 1 AND 10
ON CONFLICT (account_id) DO NOTHING;


-- =========================================================
-- 3. PROFILS ELEVES
-- =========================================================
-- Les noms/prénoms tournent dans plusieurs listes afin de
-- produire 60 profils cohérents sans écrire 60 blocs INSERT.
-- =========================================================

INSERT INTO students (
    account_id,
    first_name,
    last_name,
    birth_date,
    gender,
    email,
    phone,
    address,
    admission_date,
    status,
    photo_path,
    birth_place,
    nationality,
    previous_level,
    updated_by_account_id,
    archived_at
)
SELECT
    account.id,

    (ARRAY[
        'Abdoulaye', 'Hawa', 'Mohamed', 'Nene', 'Sekou',
        'Mariam', 'Amadou', 'Fanta', 'Lamine', 'Aminata',
        'Ibrahima', 'Fatoumata', 'Mamadou', 'Aissatou', 'Ousmane',
        'Kadiatou', 'Alpha', 'Mariama', 'Boubacar', 'Hadja'
    ])[((profile_number - 1) % 20) + 1],

    (ARRAY[
        'Diallo', 'Bah', 'Camara', 'Keita', 'Conde',
        'Sylla', 'Sow', 'Barry', 'Toure', 'Cisse',
        'Bangoura', 'Kourouma', 'Balde', 'Soumah', 'Fofana'
    ])[((profile_number - 1) % 15) + 1],

    DATE '2008-01-01' + (profile_number * 37),

    CASE
        WHEN profile_number % 2 = 0 THEN 'FEMALE'
        ELSE 'MALE'
    END,

    account.registration_number || '@eleve.blaiseconnect.test',

    '+2246223' || lpad(profile_number::text, 5, '0'),

    ((profile_number - 1) % 20 + 1) || ' quartier scolaire, Kamsar',

    DATE '2026-09-01',

    CASE
        WHEN profile_number IN (20, 40) THEN 'INACTIVE'::student_status_enum
        ELSE 'ACTIVE'::student_status_enum
    END,

    '/photos/students/' || account.registration_number || '.jpg',

    (ARRAY[
        'Conakry', 'Kindia', 'Labe', 'Kankan', 'Mamou',
        'Boke', 'Faranah', 'Nzerekore', 'Coyah', 'Dubreka'
    ])[((profile_number - 1) % 10) + 1],

    'Guineenne',

    (ARRAY[
        'CM2', '6eme', '5eme', '4eme', '3eme',
        'Seconde', 'Premiere'
    ])[((profile_number - 1) % 7) + 1],

    NULL,

    NULL
FROM accounts AS account
CROSS JOIN LATERAL (
    SELECT substring(account.registration_number FROM 2)::integer
) AS profile(profile_number)
WHERE account.role = 'STUDENT'
  AND substring(account.registration_number FROM 2)::integer BETWEEN 1 AND 60
ON CONFLICT (account_id) DO NOTHING;


-- =========================================================
-- 4. PROFILS RESPONSABLES LEGAUX
-- =========================================================

INSERT INTO guardians (
    account_id,
    first_name,
    last_name,
    gender,
    nationality,
    email,
    phone,
    address,
    occupation,
    employer,
    photo_path,
    archived_at
)
SELECT
    account.id,

    (ARRAY[
        'Boubacar', 'Aicha', 'Lansana', 'Mmah', 'Aboubacar',
        'Hadja', 'Sory', 'Ramatoulaye', 'Fode', 'Kadiatou',
        'Mamadou', 'Fatoumata', 'Ibrahima', 'Mariama', 'Alpha'
    ])[((profile_number - 1) % 15) + 1],

    (ARRAY[
        'Diallo', 'Bah', 'Camara', 'Keita', 'Conde',
        'Sylla', 'Sow', 'Barry', 'Toure', 'Cisse',
        'Bangoura', 'Kourouma', 'Balde', 'Soumah', 'Fofana'
    ])[((profile_number - 1) % 15) + 1],

    CASE
        WHEN profile_number % 2 = 0 THEN 'FEMALE'
        ELSE 'MALE'
    END,

    'Guinéenne',

    account.registration_number || '@blaiseconnect.test',

    '+2246234' || lpad(profile_number::text, 5, '0'),

    ((profile_number - 1) % 20 + 1) || ' quartier des Familles, Kamsar',

    (ARRAY[
        'Commercant',
        'Infirmiere',
        'Chauffeur',
        'Couturiere',
        'Ingenieur',
        'Enseignant',
        'Agriculteur',
        'Comptable',
        'Technicien',
        'Pharmacien'
    ])[((profile_number - 1) % 10) + 1],

    (ARRAY[
        'Independant',
        'Centre de sante',
        'Transport',
        'Atelier familial',
        'Entreprise miniere',
        'Ecole',
        'Exploitation familiale',
        'Cabinet comptable',
        'Entreprise locale',
        'Pharmacie'
    ])[((profile_number - 1) % 10) + 1],

    '/photos/guardians/' || account.registration_number || '.jpg',

    NULL
FROM accounts AS account
CROSS JOIN LATERAL (
    SELECT substring(account.registration_number FROM 2)::integer
) AS profile(profile_number)
WHERE account.role = 'GUARDIAN'
  AND substring(account.registration_number FROM 2)::integer BETWEEN 1 AND 60
ON CONFLICT (account_id) DO NOTHING;


COMMIT;
