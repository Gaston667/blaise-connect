-- =========================================================
-- 040 - DONNEES DE DEMONSTRATION : structure scolaire 2026-2027
-- 30 élèves en Seconde A, 30 élèves en Première A et 5 non inscrits.
-- =========================================================

BEGIN;

INSERT INTO school_years (name, start_date, end_date, is_current)
SELECT '2026-2027', DATE '2026-09-01', DATE '2027-06-30', true
WHERE NOT EXISTS (SELECT 1 FROM school_years WHERE name = '2026-2027');

UPDATE school_years
SET is_current = true
WHERE name = '2026-2027'
  AND closed_at IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM school_years
      WHERE is_current = true AND name <> '2026-2027'
  );

INSERT INTO reporting_periods (school_year_id, name, start_date, end_date)
SELECT school_year.id, period_data.name, period_data.start_date, period_data.end_date
FROM school_years AS school_year
CROSS JOIN (
    VALUES
        ('Période 1', DATE '2026-09-01', DATE '2026-12-18'),
        ('Période 2', DATE '2026-12-19', DATE '2027-03-31'),
        ('Période 3', DATE '2027-04-01', DATE '2027-06-30')
) AS period_data(name, start_date, end_date)
WHERE school_year.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1
      FROM reporting_periods AS existing_period
      WHERE existing_period.school_year_id = school_year.id
        AND existing_period.start_date = period_data.start_date
  );

-- Matières communes et cinq spécialités de Première.
INSERT INTO subjects (name, description, is_active, is_specialty)
VALUES
    ('Mathématiques', 'Algèbre, géométrie, analyse et probabilités.', true, false),
    ('Français', 'Langue, littérature et expression.', true, false),
    ('Anglais', 'Langue et culture anglaises.', true, false),
    ('Histoire-Géographie', 'Histoire, géographie et citoyenneté.', true, false),
    ('Sciences', 'Sciences intégrées.', true, false),
    ('Informatique', 'Initiation au numérique et à la programmation.', true, false),
    ('Physique-Chimie', 'Physique et chimie.', true, false),
    ('SVT', 'Sciences de la vie et de la Terre.', true, false),
    ('Éducation physique et sportive', 'Activités physiques et sportives.', true, false),
    ('EMC', 'Enseignement moral et civique.', true, false),
    ('Spécialité Mathématiques', 'Approfondissement en mathématiques.', true, true),
    ('Spécialité Physique-Chimie', 'Approfondissement en physique-chimie.', true, true),
    ('Spécialité SVT', 'Approfondissement en sciences de la vie et de la Terre.', true, true),
    ('Spécialité SES', 'Sciences économiques et sociales.', true, true),
    ('Spécialité NSI', 'Numérique et sciences informatiques.', true, true)
ON CONFLICT DO NOTHING;

-- Deux classes de capacité 30, avec un professeur principal chacune.
INSERT INTO classes (
    school_year_id, class_level_id, main_teacher_id, group_label, capacity
)
SELECT school_year.id, class_level.id, teacher.id, 'A', 30
FROM (
    VALUES ('SECONDE', 'e000001'), ('PREMIERE', 'e000002')
) AS class_data(level_code, teacher_registration_number)
JOIN school_years AS school_year ON school_year.name = '2026-2027'
JOIN class_levels AS class_level ON class_level.code::text = class_data.level_code
JOIN accounts AS teacher_account
    ON teacher_account.registration_number = class_data.teacher_registration_number
JOIN teachers AS teacher ON teacher.account_id = teacher_account.id
ON CONFLICT (school_year_id, class_level_id, group_label) DO NOTHING;

-- u000001 à u000030 : Seconde A ; u000031 à u000060 : Première A.
-- u000061 à u000065 restent sans inscription pour les démonstrations d'inscription.
INSERT INTO student_enrollments (student_id, class_id, start_date)
SELECT student.id, school_class.id, DATE '2026-09-01'
FROM students AS student
JOIN accounts AS student_account ON student_account.id = student.account_id
JOIN school_years AS school_year ON school_year.name = '2026-2027'
JOIN classes AS school_class ON school_class.school_year_id = school_year.id
JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
WHERE (
        student_account.registration_number ~ '^u0000([0-2][0-9]|30)$'
        AND class_level.code = 'SECONDE'
      )
   OR (
        student_account.registration_number ~ '^u0000(3[1-9]|[4-5][0-9]|60)$'
        AND class_level.code = 'PREMIERE'
      )
ON CONFLICT (student_id, class_id) DO NOTHING;

-- Tronc commun pour les deux classes, spécialités uniquement en Première A.
INSERT INTO class_subjects (class_id, subject_id, coefficient)
SELECT school_class.id, subject.id,
    CASE subject.name
        WHEN 'Mathématiques' THEN 4.00
        WHEN 'Français' THEN 4.00
        WHEN 'Anglais' THEN 3.00
        WHEN 'Histoire-Géographie' THEN 3.00
        WHEN 'Physique-Chimie' THEN 3.00
        WHEN 'SVT' THEN 3.00
        WHEN 'Sciences' THEN 2.00
        WHEN 'Informatique' THEN 2.00
        WHEN 'Spécialité Mathématiques' THEN 4.00
        WHEN 'Spécialité Physique-Chimie' THEN 4.00
        WHEN 'Spécialité SVT' THEN 4.00
        WHEN 'Spécialité SES' THEN 4.00
        WHEN 'Spécialité NSI' THEN 4.00
        ELSE 1.00
    END
FROM classes AS school_class
JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
JOIN subjects AS subject ON subject.is_active = true
WHERE school_year.name = '2026-2027'
  AND (subject.is_specialty = false OR class_level.code = 'PREMIERE')
ON CONFLICT (class_id, subject_id) DO NOTHING;

COMMIT;
