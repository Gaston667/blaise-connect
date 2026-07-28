-- =========================================================
-- JEU DE DONNEES FICTIF DE DEVELOPPEMENT
-- =========================================================
-- Mot de passe commun : test@1234
-- Exécuté uniquement lors de la première initialisation du volume PostgreSQL.
-- Le fichier reste idempotent afin de faciliter son utilisation manuelle.

BEGIN;

-- 1. Comptes : 4 administrateurs, 10 enseignants, 30 élèves,
--    30 responsables.
-- Répartition actuelle : 3 ADMIN, 7 TEACHER, 10 STUDENT et 10 GUARDIAN.
INSERT INTO accounts (
    registration_number,
    password_hash,
    role,
    is_active,
    failed_login_attempts,
    locked_until,
    last_login_at,
    archived_at,
    created_at,
    updated_at
)
SELECT
    account_prefix || lpad(account_number::text, 6, '0'),
    '$argon2id$v=19$m=65536,t=3,p=4$fdzl7sb+dyZM9pHYxntmkw$52e5qk6b3tG8l+6BGx7tG997wmj9NNhOnr2MDm+M7bg',
    account_role,
    true,
    0,
    NULL,
    TIMESTAMPTZ '2026-07-28 08:00:00+00' + account_number * INTERVAL '5 minutes',
    NULL,
    TIMESTAMPTZ '2026-07-01 08:00:00+00',
    TIMESTAMPTZ '2026-07-28 08:00:00+00'
FROM (
    SELECT 'a', account_number, 'ADMIN'
    FROM generate_series(1, 3) AS account_number

    UNION ALL

    SELECT 'e', account_number, 'TEACHER'
    FROM generate_series(1, 7) AS account_number

    UNION ALL

    SELECT 'u', account_number, 'STUDENT'
    FROM generate_series(1, 10) AS account_number

    UNION ALL

    SELECT 'p', account_number, 'GUARDIAN'
    FROM generate_series(1, 10) AS account_number
) AS generated_accounts(account_prefix, account_number, account_role)
ON CONFLICT (registration_number) DO NOTHING;

-- 2. Profils administrateurs.
INSERT INTO administrators (
    account_id,
    first_name,
    last_name,
    gender,
    email,
    phone,
    address,
    hire_date,
    job_title,
    photo_path,
    archived_at,
    created_at,
    updated_at
)
SELECT
    accounts.id,
    (ARRAY['Aminata', 'Mamadou', 'Fatoumata'])[profile_number],
    (ARRAY['Diallo', 'Camara', 'Bah'])[profile_number],
    (ARRAY['FEMALE', 'MALE', 'FEMALE'])[profile_number],
    accounts.registration_number || '@blaiseconnect.test',
    '+224620100' || lpad(profile_number::text, 3, '0'),
    profile_number || ' avenue de la Direction, Conakry',
    DATE '2020-09-01' + profile_number,
    (ARRAY['Directrice', 'Gestionnaire scolaire', 'Secrétaire'])[profile_number],
    '/photos/administrators/' || accounts.registration_number || '.jpg',
    NULL,
    now(),
    now()
FROM accounts
JOIN LATERAL (
    SELECT substring(accounts.registration_number FROM 2)::integer
) AS profile(profile_number) ON true
WHERE accounts.role = 'ADMIN'
ON CONFLICT (account_id) DO NOTHING;

-- 3. Profils enseignants.
INSERT INTO teachers (
    account_id,
    first_name,
    last_name,
    birth_date,
    gender,
    email,
    phone,
    address,
    hire_date,
    qualification,
    photo_path,
    archived_at,
    created_at,
    updated_at
)
SELECT
    accounts.id,
    (ARRAY['Ibrahima', 'Mariama', 'Ousmane', 'Aïssatou', 'Alpha', 'Kadiatou', 'Moussa'])[profile_number],
    (ARRAY['Sylla', 'Condé', 'Barry', 'Keita', 'Sow', 'Touré', 'Camara'])[profile_number],
    DATE '1980-01-10' + (profile_number * 700),
    CASE WHEN profile_number % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END,
    accounts.registration_number || '@blaiseconnect.test',
    '+224621200' || lpad(profile_number::text, 3, '0'),
    profile_number || ' rue des Enseignants, Conakry',
    DATE '2018-09-01' + (profile_number * 30),
    (ARRAY['Licence Mathématiques', 'Master Lettres', 'Licence Anglais', 'Master Histoire', 'Licence Biologie', 'Master Informatique', 'Licence Physique'])[profile_number],
    '/photos/teachers/' || accounts.registration_number || '.jpg',
    NULL,
    now(),
    now()
FROM accounts
JOIN LATERAL (
    SELECT substring(accounts.registration_number FROM 2)::integer
) AS profile(profile_number) ON true
WHERE accounts.role = 'TEACHER'
ON CONFLICT (account_id) DO NOTHING;

-- 4. Profils élèves.
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
    observations,
    updated_by_account_id,
    archived_at,
    created_at,
    updated_at
)
SELECT
    accounts.id,
    (ARRAY['Abdoulaye', 'Hawa', 'Mohamed', 'Nènè', 'Sékou', 'Mariam', 'Amadou', 'Fanta', 'Lamine', 'Aminata'])[profile_number],
    (ARRAY['Diallo', 'Bah', 'Camara', 'Keita', 'Condé', 'Sylla', 'Sow', 'Barry', 'Touré', 'Cissé'])[profile_number],
    DATE '2011-01-01' + (profile_number * 95),
    CASE WHEN profile_number % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END,
    accounts.registration_number || '@eleve.blaiseconnect.test',
    '+224622300' || lpad(profile_number::text, 3, '0'),
    profile_number || ' quartier scolaire, Conakry',
    DATE '2026-09-01',
    'ACTIVE',
    '/photos/students/' || accounts.registration_number || '.jpg',
    (ARRAY['Conakry', 'Kindia', 'Labé', 'Kankan', 'Mamou', 'Boké', 'Faranah', 'Nzérékoré', 'Coyah', 'Dubréka'])[profile_number],
    'Guinéenne',
    (ARRAY['CM2', 'CM2', 'SIXIEME', 'SIXIEME', 'CINQUIEME', 'CINQUIEME', 'CM2', 'SIXIEME', 'CINQUIEME', 'CM2'])[profile_number],
    'Dossier fictif de développement',
    administrator_account.id,
    NULL,
    now(),
    now()
FROM accounts
JOIN LATERAL (
    SELECT substring(accounts.registration_number FROM 2)::integer
) AS profile(profile_number) ON true
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator_account
WHERE accounts.role = 'STUDENT'
ON CONFLICT (account_id) DO NOTHING;

-- 5. Profils responsables.
INSERT INTO guardians (
    account_id,
    first_name,
    last_name,
    gender,
    email,
    phone,
    address,
    occupation,
    employer,
    photo_path,
    archived_at,
    created_at,
    updated_at
)
SELECT
    accounts.id,
    (ARRAY['Boubacar', 'Aïcha', 'Lansana', 'M’Mah', 'Aboubacar', 'Hadja', 'Sory', 'Ramatoulaye', 'Fodé', 'Kadiatou'])[profile_number],
    (ARRAY['Diallo', 'Bah', 'Camara', 'Keita', 'Condé', 'Sylla', 'Sow', 'Barry', 'Touré', 'Cissé'])[profile_number],
    CASE WHEN profile_number % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END,
    accounts.registration_number || '@blaiseconnect.test',
    '+224623400' || lpad(profile_number::text, 3, '0'),
    profile_number || ' quartier des Familles, Conakry',
    (ARRAY['Commerçant', 'Infirmière', 'Chauffeur', 'Couturière', 'Ingénieur', 'Enseignante', 'Agriculteur', 'Comptable', 'Technicien', 'Pharmacienne'])[profile_number],
    (ARRAY['Indépendant', 'Hôpital communal', 'Transport urbain', 'Atelier familial', 'Société guinéenne', 'École primaire', 'Exploitation familiale', 'Cabinet comptable', 'Entreprise locale', 'Pharmacie centrale'])[profile_number],
    '/photos/guardians/' || accounts.registration_number || '.jpg',
    NULL,
    now(),
    now()
FROM accounts
JOIN LATERAL (
    SELECT substring(accounts.registration_number FROM 2)::integer
) AS profile(profile_number) ON true
WHERE accounts.role = 'GUARDIAN'
ON CONFLICT (account_id) DO NOTHING;

-- 6. Année scolaire courante.
INSERT INTO school_years (
    name,
    start_date,
    end_date,
    is_current
)
VALUES (
    '2026-2027',
    DATE '2026-09-01',
    DATE '2027-07-15',
    true
)
ON CONFLICT (name) DO NOTHING;

-- 7. Périodes contiguës de l'année fictive.
INSERT INTO reporting_periods (
    school_year_id,
    name,
    start_date,
    end_date
)
SELECT
    school_years.id,
    period_data.name,
    period_data.start_date,
    period_data.end_date
FROM school_years
CROSS JOIN (
    VALUES
        ('Période 1', DATE '2026-09-01', DATE '2026-12-18'),
        ('Période 2', DATE '2026-12-19', DATE '2027-03-31'),
        ('Période 3', DATE '2027-04-01', DATE '2027-07-15')
) AS period_data(name, start_date, end_date)
WHERE school_years.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1
      FROM reporting_periods
      WHERE reporting_periods.school_year_id = school_years.id
        AND reporting_periods.start_date = period_data.start_date
  );

-- 8. Niveaux utilisés par les classes fictives.
INSERT INTO class_levels (
    code,
    name,
    education_stage,
    display_order
)
VALUES
    ('SIXIEME', 'Sixième', 'MIDDLE_SCHOOL', 10),
    ('CINQUIEME', 'Cinquième', 'MIDDLE_SCHOOL', 11),
    ('QUATRIEME', 'Quatrième', 'MIDDLE_SCHOOL', 12)
ON CONFLICT (code) DO NOTHING;

-- 9. Matières.
INSERT INTO subjects (name, description)
VALUES
    ('Mathématiques', 'Matière fictive de développement'),
    ('Français', 'Matière fictive de développement'),
    ('Anglais', 'Matière fictive de développement'),
    ('Histoire-Géographie', 'Matière fictive de développement'),
    ('Sciences', 'Matière fictive de développement'),
    ('Informatique', 'Matière fictive de développement')
ON CONFLICT DO NOTHING;

-- 10. Classes annuelles avec professeur principal.
INSERT INTO classes (
    school_year_id,
    class_level_id,
    main_teacher_id,
    group_label,
    capacity
)
SELECT
    school_years.id,
    class_levels.id,
    teachers.id,
    'A',
    30
FROM (
    VALUES
        ('SIXIEME', 'e000001'),
        ('CINQUIEME', 'e000002'),
        ('QUATRIEME', 'e000003')
) AS class_data(level_code, teacher_registration_number)
JOIN school_years
    ON school_years.name = '2026-2027'
JOIN class_levels
    ON class_levels.code::text = class_data.level_code
JOIN accounts
    ON accounts.registration_number = class_data.teacher_registration_number
JOIN teachers
    ON teachers.account_id = accounts.id
ON CONFLICT (school_year_id, class_level_id, group_label) DO NOTHING;

-- 11. Matières et coefficients de chaque classe.
INSERT INTO class_subjects (
    class_id,
    subject_id,
    coefficient
)
SELECT
    classes.id,
    subjects.id,
    CASE subjects.name
        WHEN 'Mathématiques' THEN 4.00
        WHEN 'Français' THEN 4.00
        WHEN 'Anglais' THEN 3.00
        ELSE 2.00
    END
FROM classes
JOIN school_years
    ON school_years.id = classes.school_year_id
CROSS JOIN subjects
WHERE school_years.name = '2026-2027'
ON CONFLICT (class_id, subject_id) DO NOTHING;

-- 12. Répartition régulière des 30 élèves dans les trois classes.
WITH ordered_students AS (
    SELECT
        students.id,
        row_number() OVER (
            ORDER BY accounts.registration_number
        ) AS row_number
    FROM students
    JOIN accounts
        ON accounts.id = students.account_id
    WHERE accounts.role = 'STUDENT'
),
ordered_classes AS (
    SELECT
        classes.id,
        row_number() OVER (
            ORDER BY class_levels.display_order
        ) AS row_number
    FROM classes
    JOIN school_years
        ON school_years.id = classes.school_year_id
    JOIN class_levels
        ON class_levels.id = classes.class_level_id
    WHERE school_years.name = '2026-2027'
)
INSERT INTO student_enrollments (
    student_id,
    class_id,
    start_date
)
SELECT
    ordered_students.id,
    ordered_classes.id,
    DATE '2026-09-01'
FROM ordered_students
JOIN ordered_classes
    ON ordered_classes.row_number
        = ((ordered_students.row_number - 1) % 3) + 1
ON CONFLICT (student_id, class_id) DO NOTHING;

COMMIT;

-- Les affectations enseignant-matière, évaluations et notes seront ajoutées
-- lorsque leurs tables auront été créées par des migrations versionnées.
