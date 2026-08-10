-- =========================================================
-- 060 - DONNEES DE TEST POUR LA MIGRATION 006
-- Bulletins scolaires et audit de suppression d'année
-- =========================================================
-- Dépend de :
--   001_db_access.sql
--   002_accounts_and_profiles.sql
--   003_relationships_and_documents.sql
--   004_school_structure.sql
--   005_academic_activity.sql
--   006_report_cards_year_deletion.sql
--   020_accounts_and_profiles_test_data.sql
--   030_relationships_and_documents_test_data.sql
--   040_school_structure_test_data.sql
--   050_academic_activity_test_data.sql
--
-- Script idempotent : peut être rejoué sans créer de doublons.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. BULLETINS PROVISOIRES - PERIODE 1
-- =========================================================

WITH subject_averages AS (
    SELECT
        grade.student_enrollment_id,
        class_subject.id AS class_subject_id,
        class_subject.coefficient AS subject_coefficient,
        round(
            sum(
                CASE
                    WHEN grade.result_type = 'SCORED'
                    THEN (grade.score / assessment.maximum_score) * 20 * assessment.coefficient
                    WHEN grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                    THEN 0
                    ELSE NULL
                END
            )
            / NULLIF(
                sum(
                    CASE
                        WHEN grade.result_type = 'SCORED'
                          OR grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                        THEN assessment.coefficient
                        ELSE 0
                    END
                ),
                0
            ),
            2
        ) AS subject_average
    FROM grades AS grade
    JOIN assessments AS assessment
        ON assessment.id = grade.assessment_id
    JOIN teacher_assignments AS assignment
        ON assignment.id = assessment.teacher_assignment_id
    JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
    JOIN reporting_periods AS period
        ON assessment.assessment_date BETWEEN period.start_date AND period.end_date
    JOIN school_years AS school_year
        ON school_year.id = period.school_year_id
    WHERE school_year.name = '2026-2027'
      AND period.name = 'Période 1'
    GROUP BY
        grade.student_enrollment_id,
        class_subject.id,
        class_subject.coefficient
),
general_averages AS (
    SELECT
        subject_average.student_enrollment_id,
        round(
            sum(subject_average.subject_average * subject_average.subject_coefficient)
            / NULLIF(sum(subject_average.subject_coefficient), 0),
            2
        ) AS general_average
    FROM subject_averages AS subject_average
    WHERE subject_average.subject_average IS NOT NULL
    GROUP BY subject_average.student_enrollment_id
)
INSERT INTO report_cards (
    student_enrollment_id,
    reporting_period_id,
    version,
    general_average,
    overall_comment,
    generated_by_account_id,
    generated_at
)
SELECT
    general_average.student_enrollment_id,
    period.id,
    1,
    general_average.general_average,
    'Bulletin provisoire fictif de développement.',
    administrator.id,
    TIMESTAMPTZ '2026-12-19 08:00:00+00'
FROM general_averages AS general_average
CROSS JOIN (
    SELECT reporting_period.id
    FROM reporting_periods AS reporting_period
    JOIN school_years AS school_year
        ON school_year.id = reporting_period.school_year_id
    WHERE school_year.name = '2026-2027'
      AND reporting_period.name = 'Période 1'
) AS period
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator
ON CONFLICT (
    student_enrollment_id,
    reporting_period_id,
    version
) DO NOTHING;


-- =========================================================
-- 2. MATIERES ET MOYENNES DE CHAQUE BULLETIN
-- =========================================================

WITH subject_averages AS (
    SELECT
        grade.student_enrollment_id,
        class_subject.id AS class_subject_id,
        class_subject.coefficient AS subject_coefficient,
        round(
            sum(
                CASE
                    WHEN grade.result_type = 'SCORED'
                    THEN (grade.score / assessment.maximum_score) * 20 * assessment.coefficient
                    WHEN grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                    THEN 0
                    ELSE NULL
                END
            )
            / NULLIF(
                sum(
                    CASE
                        WHEN grade.result_type = 'SCORED'
                          OR grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                        THEN assessment.coefficient
                        ELSE 0
                    END
                ),
                0
            ),
            2
        ) AS subject_average
    FROM grades AS grade
    JOIN assessments AS assessment
        ON assessment.id = grade.assessment_id
    JOIN teacher_assignments AS assignment
        ON assignment.id = assessment.teacher_assignment_id
    JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
    JOIN reporting_periods AS period
        ON assessment.assessment_date BETWEEN period.start_date AND period.end_date
    JOIN school_years AS school_year
        ON school_year.id = period.school_year_id
    WHERE school_year.name = '2026-2027'
      AND period.name = 'Période 1'
    GROUP BY
        grade.student_enrollment_id,
        class_subject.id,
        class_subject.coefficient
)
INSERT INTO report_card_subjects (
    report_card_id,
    class_subject_id,
    subject_average,
    applied_coefficient,
    teacher_comment
)
SELECT
    report_card.id,
    subject_average.class_subject_id,
    subject_average.subject_average,
    subject_average.subject_coefficient,
    'Appréciation fictive de développement.'
FROM subject_averages AS subject_average
JOIN report_cards AS report_card
    ON report_card.student_enrollment_id = subject_average.student_enrollment_id
JOIN reporting_periods AS period
    ON period.id = report_card.reporting_period_id
WHERE report_card.version = 1
  AND period.name = 'Période 1'
  AND subject_average.subject_average IS NOT NULL
ON CONFLICT (
    report_card_id,
    class_subject_id
) DO NOTHING;


-- =========================================================
-- 3. NOTES UTILISEES DANS LES BULLETINS
-- =========================================================

INSERT INTO report_card_grades (
    report_card_id,
    grade_id
)
SELECT
    report_card.id,
    grade.id
FROM report_cards AS report_card
JOIN reporting_periods AS period
    ON period.id = report_card.reporting_period_id
JOIN grades AS grade
    ON grade.student_enrollment_id = report_card.student_enrollment_id
JOIN assessments AS assessment
    ON assessment.id = grade.assessment_id
WHERE report_card.version = 1
  AND assessment.assessment_date BETWEEN period.start_date AND period.end_date
ON CONFLICT (
    report_card_id,
    grade_id
) DO NOTHING;


-- =========================================================
-- 4. DOCUMENT PDF FICTIF POUR LE BULLETIN
-- =========================================================
-- Le PDF est créé et rattaché AVANT validation, car un bulletin
-- validé devient immuable dans la migration 006.

INSERT INTO documents (
    document_type_id,
    title,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    sha256,
    uploaded_by_account_id
)
SELECT
    document_type.id,
    'Bulletin Période 1 - u000001',
    'students/u000001/bulletins/2026-2027-periode-1-v1.pdf',
    'bulletin-2026-2027-periode-1-v1.pdf',
    'application/pdf',
    409600,
    repeat('6', 64),
    administrator.id
FROM document_types AS document_type
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator
WHERE document_type.code = 'REPORT_CARD'
ON CONFLICT (storage_path) DO NOTHING;


UPDATE report_cards AS report_card
SET pdf_document_id = document.id
FROM documents AS document
JOIN student_enrollments AS enrollment
    ON true
JOIN students AS student
    ON student.id = enrollment.student_id
JOIN accounts AS student_account
    ON student_account.id = student.account_id
WHERE report_card.student_enrollment_id = enrollment.id
  AND student_account.registration_number = 'u000001'
  AND report_card.version = 1
  AND document.storage_path =
      'students/u000001/bulletins/2026-2027-periode-1-v1.pdf'
  AND report_card.pdf_document_id IS NULL
  AND report_card.validated_at IS NULL;


-- =========================================================
-- 5. VALIDATION D'UN BULLETIN DE TEST
-- =========================================================
-- Un seul bulletin est validé afin de tester l'immuabilité.

UPDATE report_cards AS report_card
SET
    validated_by_account_id = administrator.id,
    validated_at = TIMESTAMPTZ '2026-12-20 10:00:00+00'
FROM accounts AS administrator
JOIN student_enrollments AS enrollment
    ON true
JOIN students AS student
    ON student.id = enrollment.student_id
JOIN accounts AS student_account
    ON student_account.id = student.account_id
WHERE administrator.registration_number = 'a000001'
  AND report_card.student_enrollment_id = enrollment.id
  AND student_account.registration_number = 'u000001'
  AND report_card.version = 1
  AND report_card.validated_at IS NULL;


-- =========================================================
-- 6. AUDIT FICTIF DE SUPPRESSION D'ANNEE
-- =========================================================
-- On n'efface PAS réellement 2026-2027.
-- Cette ligne sert seulement à tester l'affichage de l'historique d'audit.

INSERT INTO school_year_deletion_audits (
    school_year_id,
    school_year_name,
    deleted_by_account_id,
    deleted_at
)
SELECT
    '00000000-0000-0000-0000-000000000001'::uuid,
    '2024-2025',
    administrator.id,
    TIMESTAMPTZ '2026-07-01 09:00:00+00'
FROM accounts AS administrator
WHERE administrator.registration_number = 'a000001'
  AND NOT EXISTS (
      SELECT 1
      FROM school_year_deletion_audits AS audit
      WHERE audit.school_year_name = '2024-2025'
        AND audit.deleted_at = TIMESTAMPTZ '2026-07-01 09:00:00+00'
  );


COMMIT;
