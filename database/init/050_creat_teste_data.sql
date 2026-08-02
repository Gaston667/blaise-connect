-- =========================================================
-- 050 - JEU DE DONNEES DE TEST (FUSION 007 + 008 + 009)
-- =========================================================
-- Mot de passe commun des comptes : test@1234
-- Script idempotent: peut etre rejoue sans doublons.

BEGIN;

-- 1. Comptes: 3 admins, 7 enseignants, 10 eleves, 10 responsables.
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
    SELECT 'a', account_number, 'ADMIN' FROM generate_series(1, 3) AS account_number
    UNION ALL
    SELECT 'e', account_number, 'TEACHER' FROM generate_series(1, 7) AS account_number
    UNION ALL
    SELECT 'u', account_number, 'STUDENT' FROM generate_series(1, 10) AS account_number
    UNION ALL
    SELECT 'p', account_number, 'GUARDIAN' FROM generate_series(1, 10) AS account_number
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

-- 4. Profils eleves.
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

-- 6. Lien responsable principal/legal fictif par eleve.
WITH ordered_students AS (
    SELECT
        students.id,
        row_number() OVER (ORDER BY accounts.registration_number) AS row_number
    FROM students
    JOIN accounts ON accounts.id = students.account_id
),
ordered_guardians AS (
    SELECT
        guardians.id,
        row_number() OVER (ORDER BY accounts.registration_number) AS row_number
    FROM guardians
    JOIN accounts ON accounts.id = guardians.account_id
)
INSERT INTO student_guardians (
    student_id,
    guardian_id,
    relationship_type,
    relationship_details,
    is_legal_guardian,
    is_primary_contact,
    is_emergency_contact
)
SELECT
    ordered_students.id,
    ordered_guardians.id,
    CASE WHEN ordered_students.row_number % 2 = 0 THEN 'MOTHER' ELSE 'FATHER' END,
    NULL,
    true,
    true,
    true
FROM ordered_students
JOIN ordered_guardians ON ordered_guardians.row_number = ordered_students.row_number
ON CONFLICT (student_id, guardian_id) DO NOTHING;

-- 7. Annee scolaire courante.
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

-- 8. Periodes de bulletin.
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

-- 9. Tous les niveaux disponibles ; le jeu de test active le secondaire.
INSERT INTO class_levels (code, name, education_stage, display_order, is_active)
VALUES
    ('PETITE_SECTION', 'Petite Section', 'PRESCHOOL', 1, false),
    ('MOYENNE_SECTION', 'Moyenne Section', 'PRESCHOOL', 2, false),
    ('GRANDE_SECTION', 'Grande Section', 'PRESCHOOL', 3, false),
    ('CP', 'CP', 'PRIMARY', 4, false),
    ('CE1', 'CE1', 'PRIMARY', 5, false),
    ('CE2', 'CE2', 'PRIMARY', 6, false),
    ('CM1', 'CM1', 'PRIMARY', 7, false),
    ('CM2', 'CM2', 'PRIMARY', 8, false),
    ('SIXIEME', '6ème', 'MIDDLE_SCHOOL', 9, false),
    ('CINQUIEME', '5ème', 'MIDDLE_SCHOOL', 10, false),
    ('QUATRIEME', '4ème', 'MIDDLE_SCHOOL', 11, false),
    ('TROISIEME', '3ème', 'MIDDLE_SCHOOL', 12, false),
    ('SECONDE', '2nde', 'HIGH_SCHOOL', 13, true),
    ('PREMIERE', '1ère', 'HIGH_SCHOOL', 14, true),
    ('TERMINALE', 'Terminale', 'HIGH_SCHOOL', 15, true)
ON CONFLICT (code) DO NOTHING;

-- Normalisation des display_order (si des valeurs existaient deja).
UPDATE class_levels SET display_order = 1 WHERE code = 'PETITE_SECTION';
UPDATE class_levels SET display_order = 2 WHERE code = 'MOYENNE_SECTION';
UPDATE class_levels SET display_order = 3 WHERE code = 'GRANDE_SECTION';
UPDATE class_levels SET display_order = 4 WHERE code = 'CP';
UPDATE class_levels SET display_order = 5 WHERE code = 'CE1';
UPDATE class_levels SET display_order = 6 WHERE code = 'CE2';
UPDATE class_levels SET display_order = 7 WHERE code = 'CM1';
UPDATE class_levels SET display_order = 8 WHERE code = 'CM2';
UPDATE class_levels SET display_order = 9 WHERE code = 'SIXIEME';
UPDATE class_levels SET display_order = 10 WHERE code = 'CINQUIEME';
UPDATE class_levels SET display_order = 11 WHERE code = 'QUATRIEME';
UPDATE class_levels SET display_order = 12 WHERE code = 'TROISIEME';
UPDATE class_levels SET display_order = 13 WHERE code = 'SECONDE';
UPDATE class_levels SET display_order = 14 WHERE code = 'PREMIERE';
UPDATE class_levels SET display_order = 15 WHERE code = 'TERMINALE';

UPDATE class_levels
SET is_active = education_stage IN ('MIDDLE_SCHOOL', 'HIGH_SCHOOL');

-- 10. Matieres de test.
INSERT INTO subjects (
    name,
    description,
    is_active
)
VALUES
    ('Mathématiques', 'Matière fictive de développement', true),
    ('Français', 'Matière fictive de développement', true),
    ('Anglais', 'Matière fictive de développement', true),
    ('Histoire-Géographie', 'Matière fictive de développement', true),
    ('Sciences', 'Matière fictive de développement', true),
    ('Informatique', 'Matière fictive de développement', true)
ON CONFLICT DO NOTHING;

-- 11. Toutes les classes annuelles du secondaire, de la 6eme a la Terminale.
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
        ('QUATRIEME', 'e000003'),
        ('TROISIEME', 'e000004'),
        ('SECONDE', 'e000005'),
        ('PREMIERE', 'e000006'),
        ('TERMINALE', 'e000007')
) AS class_data(level_code, teacher_registration_number)
JOIN school_years ON school_years.name = '2026-2027'
JOIN class_levels ON class_levels.code::text = class_data.level_code
JOIN accounts ON accounts.registration_number = class_data.teacher_registration_number
JOIN teachers ON teachers.account_id = accounts.id
ON CONFLICT (school_year_id, class_level_id, group_label) DO NOTHING;

-- 12. Association de toutes les matieres de test aux classes de 2026-2027.
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
        WHEN 'Histoire-Géographie' THEN 2.00
        WHEN 'Sciences' THEN 2.00
        WHEN 'Informatique' THEN 2.00
        ELSE 1.00
    END
FROM classes
JOIN school_years ON school_years.id = classes.school_year_id
CROSS JOIN subjects
WHERE school_years.name = '2026-2027'
  AND subjects.name IN (
      'Mathématiques',
      'Français',
      'Anglais',
      'Histoire-Géographie',
      'Sciences',
      'Informatique'
  )
  AND subjects.is_active = true
ON CONFLICT (class_id, subject_id) DO NOTHING;

-- 13. Repartition des eleves dans toutes les classes du secondaire.
WITH ordered_students AS (
    SELECT
        students.id,
        row_number() OVER (
            ORDER BY accounts.registration_number
        ) AS row_number
    FROM students
    JOIN accounts ON accounts.id = students.account_id
    WHERE accounts.role = 'STUDENT'
      AND NOT EXISTS (
          SELECT 1
          FROM student_enrollments AS existing_enrollment
          WHERE existing_enrollment.student_id = students.id
            AND existing_enrollment.end_date IS NULL
      )
),
ordered_classes AS (
    SELECT
        classes.id,
        row_number() OVER (
            ORDER BY class_levels.display_order
        ) AS row_number
    FROM classes
    JOIN school_years ON school_years.id = classes.school_year_id
    JOIN class_levels ON class_levels.id = classes.class_level_id
    WHERE school_years.name = '2026-2027'
),
class_count AS (
    SELECT count(*) AS total
    FROM ordered_classes
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
JOIN class_count ON class_count.total > 0
JOIN ordered_classes
    ON ordered_classes.row_number = ((ordered_students.row_number - 1) % class_count.total) + 1
ON CONFLICT (student_id, class_id) DO NOTHING;

COMMIT;
