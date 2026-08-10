-- =========================================================
-- 040 - DONNEES DE TEST POUR LA MIGRATION 004
-- Structure scolaire : année, périodes, matières, classes,
-- inscriptions élèves et matières par classe
-- =========================================================
-- Dépend de :
--   001_db_access.sql
--   002_accounts_and_profiles.sql
--   003_relationships_and_documents.sql
--   004_school_structure.sql
--   020_accounts_and_profiles_test_data.sql
--
-- Script idempotent : il peut être rejoué sans doublons.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. ANNEE SCOLAIRE COURANTE
-- =========================================================

INSERT INTO school_years (
    name,
    start_date,
    end_date,
    is_current
)
SELECT
    '2026-2027',
    DATE '2026-09-01',
    DATE '2027-07-15',
    true
WHERE NOT EXISTS (
    SELECT 1
    FROM school_years
    WHERE name = '2026-2027'
);

-- Si l'année existait déjà mais n'était pas courante,
-- la définir comme courante seulement s'il n'existe aucune autre année courante.
UPDATE school_years
SET is_current = true
WHERE name = '2026-2027'
  AND closed_at IS NULL
  AND is_current = false
  AND NOT EXISTS (
      SELECT 1
      FROM school_years AS other_year
      WHERE other_year.is_current = true
        AND other_year.name <> '2026-2027'
  );


-- =========================================================
-- 2. PERIODES DE BULLETIN
-- =========================================================
-- Trois périodes contiguës couvrant toute l'année.

INSERT INTO reporting_periods (
    school_year_id,
    name,
    start_date,
    end_date
)
SELECT
    school_year.id,
    period_data.name,
    period_data.start_date,
    period_data.end_date
FROM school_years AS school_year
CROSS JOIN (
    VALUES
        ('Période 1', DATE '2026-09-01', DATE '2026-12-18'),
        ('Période 2', DATE '2026-12-19', DATE '2027-03-31'),
        ('Période 3', DATE '2027-04-01', DATE '2027-07-15')
) AS period_data(name, start_date, end_date)
WHERE school_year.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1
      FROM reporting_periods AS existing_period
      WHERE existing_period.school_year_id = school_year.id
        AND existing_period.start_date = period_data.start_date
        AND existing_period.end_date = period_data.end_date
  );


-- =========================================================
-- 3. MATIERES DE TEST
-- =========================================================
-- 15 matières classiques + 10 enseignements de spécialité.
-- Les spécialités possèdent un nom distinct pour éviter
-- toute confusion avec les matières du tronc commun.


INSERT INTO subjects (
    name,
    description,
    is_active
)
VALUES
    -- ==========================================
    -- MATIERES
    -- ==========================================

    (
        'Français',
        'Étude de la langue française, de la littérature et de l''expression écrite et orale.',
        true
    ),
    (
        'Mathématiques',
        'Étude de l''algèbre, de la géométrie, de l''analyse et des probabilités.',
        true
    ),
    (
        'Physique-Chimie',
        'Étude des phénomènes physiques, de la matière et des transformations chimiques.',
        true
    ),
    (
        'Sciences de la vie et de la Terre (SVT)',
        'Étude du vivant, de la Terre, de l''environnement et du corps humain.',
        true
    ),
    (
        'Histoire-Géographie',
        'Étude des sociétés, des événements historiques, des territoires et des espaces géographiques.',
        true
    ),
    (
        'Anglais',
        'Apprentissage de la langue anglaise et développement de la compréhension et de l''expression.',
        true
    ),
    (
        'Espagnol',
        'Apprentissage de la langue espagnole et développement de la compréhension et de l''expression.',
        true
    ),
    (
        'Philosophie',
        'Étude des grandes notions philosophiques et développement de l''argumentation.',
        true
    ),
    (
        'Sciences économiques et sociales (SES)',
        'Introduction aux principaux concepts économiques, sociaux et politiques.',
        true
    ),
    (
        'Enseignement scientifique',
        'Étude de problématiques scientifiques à travers plusieurs disciplines.',
        true
    ),
    (
        'Sciences numériques et technologie (SNT)',
        'Découverte du numérique, des données, d''Internet et des technologies informatiques.',
        true
    ),
    (
        'Éducation physique et sportive (EPS)',
        'Développement des capacités physiques et pratique de différentes activités sportives.',
        true
    ),
    (
        'Enseignement moral et civique (EMC)',
        'Étude de la citoyenneté, des valeurs républicaines, des droits et des responsabilités.',
        true
    ),
    (
        'Informatique',
        'Initiation à l''algorithmique, à la programmation et aux systèmes informatiques.',
        true
    ),
    (
        'Arts',
        'Découverte et pratique de différentes formes d''expression et de création artistique.',
        true
    ),

    -- ==========================================
    -- SPECIALITES
    -- ==========================================

    (
        'Mathématiques - Spécialité',
        'Approfondissement de l''algèbre, de l''analyse, de la géométrie, des probabilités et des statistiques.',
        true
    ),
    (
        'Physique-Chimie - Spécialité',
        'Approfondissement de la physique et de la chimie par l''expérimentation et la modélisation.',
        true
    ),
    (
        'SVT - Spécialité',
        'Approfondissement de la biologie, de la géologie, de l''environnement et des sciences du vivant.',
        true
    ),
    (
        'SES - Spécialité',
        'Approfondissement des sciences économiques, de la sociologie et des sciences politiques.',
        true
    ),
    (
        'NSI - Spécialité',
        'Étude approfondie de la programmation, des algorithmes, des données, des réseaux et des systèmes informatiques.',
        true
    ),
    (
        'HGGSP - Spécialité',
        'Étude de l''histoire, de la géographie, de la géopolitique et des sciences politiques.',
        true
    ),
    (
        'HLP - Spécialité',
        'Étude croisée de la littérature et de la philosophie autour des grandes questions humaines.',
        true
    ),
    (
        'LLCER Anglais - Spécialité',
        'Approfondissement de la langue, de la littérature et de la culture des pays anglophones.',
        true
    ),
    (
        'Sciences de l''ingénieur - Spécialité',
        'Étude, analyse et conception de systèmes techniques et technologiques.',
        true
    ),
    (
        'Arts - Spécialité',
        'Approfondissement de la pratique artistique, de la création et de la culture artistique.',
        true
    )

ON CONFLICT DO NOTHING;


-- =========================================================
-- 4. CLASSES DE TEST - LYCEE UNIQUEMENT
-- =========================================================
-- Seconde A
-- Première A
-- Terminale A
--
-- On utilise trois enseignants différents comme
-- professeurs principaux.


INSERT INTO classes (
    school_year_id,
    class_level_id,
    main_teacher_id,
    group_label,
    capacity
)
SELECT
    school_year.id,
    class_level.id,
    teacher.id,
    'A',
    30
FROM (
    VALUES
        ('SECONDE',   'e000001'),
        ('PREMIERE',  'e000002'),
        ('TERMINALE', 'e000003')
) AS class_data(
    level_code,
    teacher_registration_number
)
JOIN school_years AS school_year
    ON school_year.name = '2026-2027'

JOIN class_levels AS class_level
    ON class_level.code::text = class_data.level_code

JOIN accounts AS teacher_account
    ON teacher_account.registration_number =
       class_data.teacher_registration_number

JOIN teachers AS teacher
    ON teacher.account_id = teacher_account.id

ON CONFLICT (
    school_year_id,
    class_level_id,
    group_label
)
DO NOTHING;


-- =========================================================
-- 5. INSCRIPTIONS DES ELEVES
-- =========================================================
-- Répartit les 10 élèves de test dans les 7 classes.
-- Un élève ne reçoit une nouvelle inscription que s'il n'en
-- possède pas déjà une ouverte.

WITH ordered_students AS (
    SELECT
        student.id,
        row_number() OVER (
            ORDER BY account.registration_number
        ) AS row_number
    FROM students AS student
    JOIN accounts AS account
        ON account.id = student.account_id
    WHERE account.registration_number ~ '^u0000(0[1-9]|10)$'
      AND NOT EXISTS (
          SELECT 1
          FROM student_enrollments AS existing_enrollment
          WHERE existing_enrollment.student_id = student.id
            AND existing_enrollment.end_date IS NULL
      )
),
ordered_classes AS (
    SELECT
        school_class.id,
        row_number() OVER (
            ORDER BY class_level.display_order, school_class.group_label
        ) AS row_number
    FROM classes AS school_class
    JOIN school_years AS school_year
        ON school_year.id = school_class.school_year_id
    JOIN class_levels AS class_level
        ON class_level.id = school_class.class_level_id
    WHERE school_year.name = '2026-2027'
      AND class_level.education_stage IN (
          'MIDDLE_SCHOOL',
          'HIGH_SCHOOL'
      )
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
    student.id,
    school_class.id,
    DATE '2026-09-01'
FROM ordered_students AS student
JOIN class_count
    ON class_count.total > 0
JOIN ordered_classes AS school_class
    ON school_class.row_number =
       ((student.row_number - 1) % class_count.total) + 1
ON CONFLICT (student_id, class_id)
DO NOTHING;


-- =========================================================
-- 6. MATIERES PAR CLASSE
-- =========================================================
-- Chaque classe reçoit les six matières de test.
-- Le coefficient appartient bien à class_subjects,
-- car il peut varier d'une classe à l'autre.

INSERT INTO class_subjects (
    class_id,
    subject_id,
    coefficient
)
SELECT
    school_class.id,
    subject.id,
    CASE subject.name
        WHEN 'Mathématiques'       THEN 4.00
        WHEN 'Français'            THEN 4.00
        WHEN 'Anglais'             THEN 3.00
        WHEN 'Histoire-Géographie' THEN 2.00
        WHEN 'Sciences'            THEN 2.00
        WHEN 'Informatique'        THEN 2.00
        ELSE 1.00
    END
FROM classes AS school_class
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
CROSS JOIN subjects AS subject
WHERE school_year.name = '2026-2027'
  AND subject.name IN (
      'Mathématiques',
      'Français',
      'Anglais',
      'Histoire-Géographie',
      'Sciences',
      'Informatique'
  )
  AND subject.is_active = true
ON CONFLICT (class_id, subject_id)
DO NOTHING;


COMMIT;
