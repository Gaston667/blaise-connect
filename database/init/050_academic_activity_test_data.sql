-- =========================================================
-- 050 - DONNEES DE TEST POUR LA MIGRATION 005
-- Activité académique : affectations, évaluations, notes,
-- spécialités proposées par classe et choix de Première/Terminale
-- =========================================================
-- Dépend de :
--   001_db_access.sql
--   002_accounts_and_profiles.sql
--   003_relationships_and_documents.sql
--   004_school_structure.sql
--   005_academic_activity.sql
--   020_accounts_and_profiles_test_data.sql
--   030_relationships_and_documents_test_data.sql
--   040_school_structure_test_data.sql
--
-- Hypothèse métier retenue pour les données :
--   Première  : 3 spécialités
--   Terminale : 2 spécialités
--
-- IMPORTANT :
-- Le backend doit vérifier qu'une sélection est complète avant validation.
-- La base doit au minimum empêcher de dépasser 3 en Première et 2 en Terminale.
--
-- Script idempotent : il peut être rejoué sans doublons.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. SPECIALITES DE TEST
-- =========================================================
-- Ces matières sont marquées is_specialty = true.
-- Elles restent distinctes des matières générales créées dans 040.

INSERT INTO subjects (
    name,
    description,
    is_active,
    is_specialty
)
VALUES
    ('Spécialité Mathématiques',
     'Spécialité fictive de développement',
     true,
     true),

    ('Spécialité Physique-Chimie',
     'Spécialité fictive de développement',
     true,
     true),

    ('Spécialité SVT',
     'Spécialité fictive de développement',
     true,
     true),

    ('Spécialité NSI',
     'Numérique et sciences informatiques - spécialité fictive',
     true,
     true)
ON CONFLICT DO NOTHING;


-- =========================================================
-- 2. SPECIALITES PROPOSEES PAR LES CLASSES
-- =========================================================
-- La migration 005 exige désormais qu'une spécialité choisie par un élève
-- soit réellement proposée dans sa classe via class_subjects.
--
-- Pour les données de test, les 4 spécialités sont proposées aux classes
-- de Première et de Terminale de l'année 2026-2027.
-- Le coefficient 1.00 est volontairement neutre pour ces données fictives.

INSERT INTO class_subjects (
    class_id,
    subject_id,
    coefficient
)
SELECT
    school_class.id,
    subject.id,
    1.00::numeric
FROM classes AS school_class
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
JOIN class_levels AS class_level
    ON class_level.id = school_class.class_level_id
CROSS JOIN subjects AS subject
WHERE school_year.name = '2026-2027'
  AND class_level.code IN ('PREMIERE', 'TERMINALE')
  AND subject.is_specialty = true
  AND subject.name IN (
      'Spécialité Mathématiques',
      'Spécialité Physique-Chimie',
      'Spécialité SVT',
      'Spécialité NSI'
  )
ON CONFLICT (
    class_id,
    subject_id
) DO NOTHING;


-- =========================================================
-- 3. AFFECTATIONS ENSEIGNANTS ↔ MATIERES DE CLASSE
-- =========================================================
-- Une affectation active par matière de classe.
-- Les 6 matières générales de 040 sont réparties entre 6 enseignants.

INSERT INTO teacher_assignments (
    teacher_id,
    class_subject_id,
    start_date
)
SELECT
    teacher.id,
    class_subject.id,
    school_year.start_date
FROM class_subjects AS class_subject
JOIN classes AS school_class
    ON school_class.id = class_subject.class_id
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
JOIN (
    VALUES
        ('Mathématiques',       'e000001'),
        ('Français',            'e000002'),
        ('Anglais',             'e000003'),
        ('Histoire-Géographie', 'e000004'),
        ('Sciences',            'e000005'),
        ('Informatique',        'e000006')
) AS assignment_data(subject_name, teacher_registration_number)
    ON assignment_data.subject_name = subject.name
JOIN accounts AS teacher_account
    ON teacher_account.registration_number =
       assignment_data.teacher_registration_number
JOIN teachers AS teacher
    ON teacher.account_id = teacher_account.id
WHERE school_year.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1
      FROM teacher_assignments AS existing_assignment
      WHERE existing_assignment.class_subject_id = class_subject.id
        AND existing_assignment.end_date IS NULL
  );


-- =========================================================
-- 4. EVALUATIONS DE TEST
-- =========================================================
-- Deux évaluations par affectation pour vérifier :
--   - barèmes différents ;
--   - coefficients différents ;
--   - calculs ultérieurs de moyennes.

INSERT INTO assessments (
    teacher_assignment_id,
    title,
    description,
    assessment_date,
    maximum_score,
    coefficient
)
SELECT
    assignment.id,
    assessment_data.title,
    assessment_data.description,
    assessment_data.assessment_date,
    assessment_data.maximum_score,
    assessment_data.coefficient
FROM teacher_assignments AS assignment
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN classes AS school_class
    ON school_class.id = class_subject.class_id
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
CROSS JOIN (
    VALUES
        (
            'Évaluation diagnostique',
            'Première évaluation fictive de développement.',
            DATE '2026-10-05',
            20.00::numeric,
            1.00::numeric
        ),
        (
            'Contrôle de la période 1',
            'Deuxième évaluation fictive de développement.',
            DATE '2026-11-10',
            20.00::numeric,
            2.00::numeric
        )
) AS assessment_data(
    title,
    description,
    assessment_date,
    maximum_score,
    coefficient
)
WHERE school_year.name = '2026-2027'
ON CONFLICT (
    teacher_assignment_id,
    title,
    assessment_date
) DO NOTHING;


-- =========================================================
-- 5. NOTES DES ELEVES
-- =========================================================
-- Toutes les évaluations reçoivent une note pour les élèves
-- de leur classe.
--
-- Deux cas ABSENT sont créés en Mathématiques :
--   u000001 : absence JUSTIFIED
--   u000008 : absence UNJUSTIFIED
--
-- Les autres résultats sont numériques.

INSERT INTO grades (
    assessment_id,
    student_enrollment_id,
    result_type,
    score,
    comment,
    justification_status,
    reviewed_by_account_id,
    reviewed_at
)
SELECT
    assessment.id,
    enrollment.id,

    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_account.registration_number IN ('u000001', 'u000008')
        THEN 'ABSENT'::grade_result_type_enum

        ELSE 'SCORED'::grade_result_type_enum
    END,

    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_account.registration_number IN ('u000001', 'u000008')
        THEN NULL

        ELSE (
            8
            + (
                substring(
                    student_account.registration_number FROM 2
                )::integer % 12
            )
        )::numeric
    END,

    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
        THEN 'Résultat fictif de l''évaluation diagnostique.'
        ELSE 'Résultat fictif du contrôle de période.'
    END,

    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_account.registration_number = 'u000001'
        THEN 'JUSTIFIED'::justification_status_enum

        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_account.registration_number = 'u000008'
        THEN 'UNJUSTIFIED'::justification_status_enum

        ELSE NULL
    END,

    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_account.registration_number = 'u000001'
        THEN administrator_account.id
        ELSE NULL
    END,

    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_account.registration_number = 'u000001'
        THEN TIMESTAMPTZ '2026-10-07 10:00:00+00'
        ELSE NULL
    END

FROM assessments AS assessment
JOIN teacher_assignments AS assignment
    ON assignment.id = assessment.teacher_assignment_id
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
JOIN student_enrollments AS enrollment
    ON enrollment.class_id = class_subject.class_id
JOIN students AS student
    ON student.id = enrollment.student_id
JOIN accounts AS student_account
    ON student_account.id = student.account_id
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator_account

ON CONFLICT (
    assessment_id,
    student_enrollment_id
) DO NOTHING;


-- =========================================================
-- 6. SPECIALITES DE PREMIERE
-- =========================================================
-- Dans le jeu 040, u000006 est affecté à la Première A.
-- Il reçoit exactement 3 spécialités.

INSERT INTO student_specialties (
    student_enrollment_id,
    subject_id
)
SELECT
    enrollment.id,
    subject.id
FROM student_enrollments AS enrollment
JOIN students AS student
    ON student.id = enrollment.student_id
JOIN accounts AS student_account
    ON student_account.id = student.account_id
JOIN classes AS school_class
    ON school_class.id = enrollment.class_id
JOIN class_levels AS class_level
    ON class_level.id = school_class.class_level_id
JOIN class_subjects AS class_subject
    ON class_subject.class_id = school_class.id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
WHERE student_account.registration_number = 'u000006'
  AND class_level.code = 'PREMIERE'
  AND subject.name IN (
      'Spécialité Mathématiques',
      'Spécialité Physique-Chimie',
      'Spécialité NSI'
  )
  AND subject.is_specialty = true
ON CONFLICT (
    student_enrollment_id,
    subject_id
) DO NOTHING;


-- =========================================================
-- 7. SPECIALITES DE TERMINALE
-- =========================================================
-- Dans le jeu 040, u000007 est affecté à la Terminale A.
-- Il reçoit exactement 2 spécialités.

INSERT INTO student_specialties (
    student_enrollment_id,
    subject_id
)
SELECT
    enrollment.id,
    subject.id
FROM student_enrollments AS enrollment
JOIN students AS student
    ON student.id = enrollment.student_id
JOIN accounts AS student_account
    ON student_account.id = student.account_id
JOIN classes AS school_class
    ON school_class.id = enrollment.class_id
JOIN class_levels AS class_level
    ON class_level.id = school_class.class_level_id
JOIN class_subjects AS class_subject
    ON class_subject.class_id = school_class.id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
WHERE student_account.registration_number = 'u000007'
  AND class_level.code = 'TERMINALE'
  AND subject.name IN (
      'Spécialité Mathématiques',
      'Spécialité Physique-Chimie'
  )
  AND subject.is_specialty = true
ON CONFLICT (
    student_enrollment_id,
    subject_id
) DO NOTHING;


COMMIT;
