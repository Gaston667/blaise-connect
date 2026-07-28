-- =========================================================
-- JEU DE DONNEES FICTIF DE DEVELOPPEMENT
-- =========================================================
-- Mot de passe commun : test@1234
-- Exécuté uniquement lors de la première initialisation du volume PostgreSQL.
-- Le fichier reste idempotent afin de faciliter son utilisation manuelle.

BEGIN;

-- 1. Comptes : 4 administrateurs, 10 enseignants, 30 élèves,
--    30 responsables.
INSERT INTO accounts (registration_number, password_hash, role)
SELECT
    account_prefix || lpad(account_number::text, 6, '0'),
    '$argon2id$v=19$m=65536,t=3,p=4$fdzl7sb+dyZM9pHYxntmkw$52e5qk6b3tG8l+6BGx7tG997wmj9NNhOnr2MDm+M7bg',
    account_role
FROM (
    SELECT 'a', account_number, 'ADMIN'
    FROM generate_series(1, 4) AS account_number

    UNION ALL

    SELECT 'e', account_number, 'TEACHER'
    FROM generate_series(1, 10) AS account_number

    UNION ALL

    SELECT 'u', account_number, 'STUDENT'
    FROM generate_series(1, 30) AS account_number

    UNION ALL

    SELECT 'p', account_number, 'GUARDIAN'
    FROM generate_series(1, 30) AS account_number
) AS generated_accounts(account_prefix, account_number, account_role)
ON CONFLICT (registration_number) DO NOTHING;

-- 2. Profils administrateurs.
INSERT INTO administrators (
    account_id,
    first_name,
    last_name,
    email,
    hire_date,
    job_title
)
SELECT
    accounts.id,
    'Admin',
    'Test ' || substring(accounts.registration_number FROM 2),
    accounts.registration_number || '@blaiseconnect.test',
    DATE '2026-07-01',
    CASE accounts.registration_number
        WHEN 'a000001' THEN 'Direction'
        ELSE 'Administration'
    END
FROM accounts
WHERE accounts.role = 'ADMIN'
ON CONFLICT (account_id) DO NOTHING;

-- 3. Profils enseignants.
INSERT INTO teachers (
    account_id,
    first_name,
    last_name,
    email,
    hire_date,
    qualification
)
SELECT
    accounts.id,
    'Enseignant',
    'Test ' || substring(accounts.registration_number FROM 2),
    accounts.registration_number || '@blaiseconnect.test',
    DATE '2026-07-01',
    'Qualification fictive'
FROM accounts
WHERE accounts.role = 'TEACHER'
ON CONFLICT (account_id) DO NOTHING;

-- 4. Profils élèves.
INSERT INTO students (
    account_id,
    first_name,
    last_name,
    birth_date,
    admission_date,
    status
)
SELECT
    accounts.id,
    'Eleve',
    'Test ' || substring(accounts.registration_number FROM 2),
    DATE '2012-01-01'
        + (substring(accounts.registration_number FROM 2)::integer % 365),
    DATE '2026-09-01',
    'ACTIVE'
FROM accounts
WHERE accounts.role = 'STUDENT'
ON CONFLICT (account_id) DO NOTHING;

-- 5. Profils responsables.
INSERT INTO guardians (
    account_id,
    first_name,
    last_name,
    email,
    phone,
    occupation
)
SELECT
    accounts.id,
    'Responsable',
    'Test ' || substring(accounts.registration_number FROM 2),
    accounts.registration_number || '@blaiseconnect.test',
    '+224600'
        || lpad(substring(accounts.registration_number FROM 2), 6, '0'),
    'Profession fictive'
FROM accounts
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
