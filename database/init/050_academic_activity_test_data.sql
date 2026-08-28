-- =========================================================
-- 050 - DONNEES DE DEMONSTRATION : activité pédagogique 2026-2027
-- 10 évaluations par matière et par période, puis les notes associées.
-- =========================================================

BEGIN;

-- Une affectation active pour chaque matière de chaque classe.
INSERT INTO teacher_assignments (teacher_id, class_subject_id, start_date)
SELECT teacher.id, class_subject.id, school_year.start_date
FROM class_subjects AS class_subject
JOIN classes AS school_class ON school_class.id = class_subject.class_id
JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
JOIN subjects AS subject ON subject.id = class_subject.subject_id
JOIN accounts AS teacher_account ON teacher_account.registration_number =
    CASE subject.name
        WHEN 'Mathématiques' THEN 'e000001'
        WHEN 'Spécialité Mathématiques' THEN 'e000001'
        WHEN 'Français' THEN 'e000002'
        WHEN 'Anglais' THEN 'e000003'
        WHEN 'Histoire-Géographie' THEN 'e000004'
        WHEN 'Sciences' THEN 'e000005'
        WHEN 'SVT' THEN 'e000005'
        WHEN 'Informatique' THEN 'e000006'
        WHEN 'Spécialité NSI' THEN 'e000006'
        WHEN 'Physique-Chimie' THEN 'e000007'
        WHEN 'Spécialité Physique-Chimie' THEN 'e000007'
        WHEN 'Éducation physique et sportive' THEN 'e000008'
        WHEN 'EMC' THEN 'e000008'
        WHEN 'Spécialité SES' THEN 'e000009'
        WHEN 'Spécialité SVT' THEN 'e000010'
    END
JOIN teachers AS teacher ON teacher.account_id = teacher_account.id
WHERE school_year.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1 FROM teacher_assignments AS existing_assignment
      WHERE existing_assignment.class_subject_id = class_subject.id
        AND existing_assignment.end_date IS NULL
  );

-- Chaque élève de Première reçoit exactement trois spécialités parmi les cinq proposées.
INSERT INTO student_specialties (student_enrollment_id, subject_id)
SELECT enrollment.id, subject.id
FROM student_enrollments AS enrollment
JOIN classes AS school_class ON school_class.id = enrollment.class_id
JOIN class_levels AS class_level ON class_level.id = school_class.class_level_id
JOIN students AS student ON student.id = enrollment.student_id
JOIN accounts AS student_account ON student_account.id = student.account_id
JOIN subjects AS subject ON subject.is_specialty = true
WHERE class_level.code = 'PREMIERE'
  AND (
      (substring(student_account.registration_number FROM 2)::integer % 5 = 0
       AND subject.name IN ('Spécialité Mathématiques', 'Spécialité Physique-Chimie', 'Spécialité SVT'))
      OR
      (substring(student_account.registration_number FROM 2)::integer % 5 = 1
       AND subject.name IN ('Spécialité Mathématiques', 'Spécialité SES', 'Spécialité NSI'))
      OR
      (substring(student_account.registration_number FROM 2)::integer % 5 = 2
       AND subject.name IN ('Spécialité Physique-Chimie', 'Spécialité SVT', 'Spécialité SES'))
      OR
      (substring(student_account.registration_number FROM 2)::integer % 5 = 3
       AND subject.name IN ('Spécialité Mathématiques', 'Spécialité SVT', 'Spécialité NSI'))
      OR
      (substring(student_account.registration_number FROM 2)::integer % 5 = 4
       AND subject.name IN ('Spécialité Physique-Chimie', 'Spécialité SES', 'Spécialité NSI'))
  )
  AND EXISTS (
      SELECT 1 FROM class_subjects
      WHERE class_subjects.class_id = school_class.id
        AND class_subjects.subject_id = subject.id
  )
ON CONFLICT (student_enrollment_id, subject_id) DO NOTHING;

-- Dix évaluations par matière et par période, toutes sur 20.
INSERT INTO assessments (
    teacher_assignment_id, title, description, assessment_date, maximum_score, coefficient
)
SELECT
    assignment.id,
    format('%s - évaluation %s', period.name, evaluation.number),
    format('Évaluation de démonstration %s pour %s.', evaluation.number, period.name),
    period.start_date + (evaluation.number * 7),
    20.00::numeric,
    CASE WHEN evaluation.number IN (5, 10) THEN 2.00::numeric ELSE 1.00::numeric END
FROM teacher_assignments AS assignment
JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
JOIN classes AS school_class ON school_class.id = class_subject.class_id
JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
JOIN reporting_periods AS period ON period.school_year_id = school_year.id
CROSS JOIN generate_series(1, 10) AS evaluation(number)
WHERE school_year.name = '2026-2027'
  AND period.start_date + (evaluation.number * 7) <= period.end_date
ON CONFLICT (teacher_assignment_id, title, assessment_date) DO NOTHING;

-- Tous les inscrits reçoivent les notes du tronc commun. Les notes de spécialité
-- sont créées uniquement pour les élèves ayant sélectionné la spécialité concernée.
INSERT INTO grades (
    assessment_id, student_enrollment_id, result_type, score, comment,
    justification_status, reviewed_by_account_id, reviewed_at
)
SELECT
    assessment.id,
    enrollment.id,
    CASE
        WHEN assessment.title = 'Période 1 - évaluation 1'
         AND student_account.registration_number = 'u000001'
         AND subject.name = 'Mathématiques'
        THEN 'ABSENT'::grade_result_type_enum
        ELSE 'SCORED'::grade_result_type_enum
    END,
    CASE
        WHEN assessment.title = 'Période 1 - évaluation 1'
         AND student_account.registration_number = 'u000001'
         AND subject.name = 'Mathématiques'
        THEN NULL
        ELSE round((8 + mod(abs(hashtext(
            student_account.registration_number || assessment.id::text
        )), 1200) / 100.0)::numeric, 2)
    END,
    'Note de démonstration.',
    CASE
        WHEN assessment.title = 'Période 1 - évaluation 1'
         AND student_account.registration_number = 'u000001'
         AND subject.name = 'Mathématiques'
        THEN 'JUSTIFIED'::justification_status_enum
        ELSE NULL
    END,
    CASE
        WHEN assessment.title = 'Période 1 - évaluation 1'
         AND student_account.registration_number = 'u000001'
         AND subject.name = 'Mathématiques'
        THEN administrator.id
        ELSE NULL
    END,
    CASE
        WHEN assessment.title = 'Période 1 - évaluation 1'
         AND student_account.registration_number = 'u000001'
         AND subject.name = 'Mathématiques'
        THEN TIMESTAMPTZ '2026-10-01 09:00:00+00'
        ELSE NULL
    END
FROM assessments AS assessment
JOIN teacher_assignments AS assignment ON assignment.id = assessment.teacher_assignment_id
JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
JOIN subjects AS subject ON subject.id = class_subject.subject_id
JOIN student_enrollments AS enrollment ON enrollment.class_id = class_subject.class_id
JOIN students AS student ON student.id = enrollment.student_id
JOIN accounts AS student_account ON student_account.id = student.account_id
CROSS JOIN (SELECT id FROM accounts WHERE registration_number = 'a000001') AS administrator
WHERE NOT subject.is_specialty
   OR EXISTS (
       SELECT 1 FROM student_specialties AS specialty
       WHERE specialty.student_enrollment_id = enrollment.id
         AND specialty.subject_id = subject.id
   )
ON CONFLICT (assessment_id, student_enrollment_id) DO NOTHING;

COMMIT;
