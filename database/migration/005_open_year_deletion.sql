-- =========================================================
-- MIGRATION 005 : suppression contrôlée d'une année ouverte
-- =========================================================
-- La fonction centralize la cascade sans accorder DELETE à
-- blaise_app. Elle exige la confirmation du nom de l'année
-- et enregistre un audit avant chaque suppression.
-- =========================================================

BEGIN;

CREATE TABLE school_year_deletion_audits (
    id uuid
        CONSTRAINT pk_school_year_deletion_audits PRIMARY KEY
        DEFAULT gen_random_uuid(),
    school_year_id uuid NOT NULL,
    school_year_name varchar(20) NOT NULL,
    deleted_by_account_id uuid NOT NULL,
    deleted_counts jsonb NOT NULL,
    deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_school_year_deletion_audits_deleted_at
    ON school_year_deletion_audits (deleted_at);

CREATE OR REPLACE FUNCTION delete_open_school_year(
    target_school_year_id uuid,
    confirmation_name text,
    administrator_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    target_year_name varchar(20);
    target_closed_at timestamptz;
    deleted_periods integer;
    deleted_report_card_grades integer := 0;
    deleted_report_card_subjects integer := 0;
    deleted_report_cards integer := 0;
    deleted_attendance_records integer := 0;
    deleted_attendance_events integer := 0;
    deleted_grades integer := 0;
    deleted_assessments integer := 0;
    deleted_teacher_assignments integer := 0;
    deleted_class_subjects integer;
    deleted_enrollments integer;
    deleted_classes integer;
    deleted_counts jsonb;
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM public.accounts AS account
         WHERE account.id = administrator_account_id
           AND account.role = 'ADMIN'
           AND account.is_active = true
           AND account.archived_at IS NULL
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Seul un administrateur actif peut supprimer une année scolaire.';
    END IF;

    SELECT school_year.name, school_year.closed_at
      INTO target_year_name, target_closed_at
      FROM public.school_years AS school_year
     WHERE school_year.id = target_school_year_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0002',
            MESSAGE = 'Année scolaire introuvable.';
    END IF;

    IF target_closed_at IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Une année scolaire clôturée ne peut jamais être supprimée.';
    END IF;

    IF confirmation_name IS DISTINCT FROM target_year_name THEN
        RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'Le nom de confirmation ne correspond pas à l''année scolaire.';
    END IF;

    -- Ces tables appartiennent à des US ultérieures. Les blocs sont activés
    -- automatiquement lorsqu'elles existent dans le schéma.
    IF to_regclass('public.report_card_grades') IS NOT NULL THEN
        EXECUTE
            'DELETE FROM public.report_card_grades AS line
              USING public.report_cards AS card,
                    public.student_enrollments AS enrollment,
                    public.classes AS school_class
              WHERE line.report_card_id = card.id
                AND card.student_enrollment_id = enrollment.id
                AND enrollment.class_id = school_class.id
                AND school_class.school_year_id = $1'
            USING target_school_year_id;
        GET DIAGNOSTICS deleted_report_card_grades = ROW_COUNT;
    END IF;

    IF to_regclass('public.report_card_subjects') IS NOT NULL THEN
        EXECUTE
            'DELETE FROM public.report_card_subjects AS line
              USING public.report_cards AS card,
                    public.student_enrollments AS enrollment,
                    public.classes AS school_class
              WHERE line.report_card_id = card.id
                AND card.student_enrollment_id = enrollment.id
                AND enrollment.class_id = school_class.id
                AND school_class.school_year_id = $1'
            USING target_school_year_id;
        GET DIAGNOSTICS deleted_report_card_subjects = ROW_COUNT;
    END IF;

    IF to_regclass('public.report_cards') IS NOT NULL THEN
        EXECUTE
            'DELETE FROM public.report_cards AS card
              USING public.student_enrollments AS enrollment,
                    public.classes AS school_class
              WHERE card.student_enrollment_id = enrollment.id
                AND enrollment.class_id = school_class.id
                AND school_class.school_year_id = $1'
            USING target_school_year_id;
        GET DIAGNOSTICS deleted_report_cards = ROW_COUNT;
    END IF;

    IF to_regclass('public.attendance_records') IS NOT NULL THEN
        EXECUTE
            'DELETE FROM public.attendance_records AS record
              USING public.student_enrollments AS enrollment,
                    public.classes AS school_class
              WHERE record.student_enrollment_id = enrollment.id
                AND enrollment.class_id = school_class.id
                AND school_class.school_year_id = $1'
            USING target_school_year_id;
        GET DIAGNOSTICS deleted_attendance_records = ROW_COUNT;
    END IF;

    IF to_regclass('public.grades') IS NOT NULL THEN
        EXECUTE
            'DELETE FROM public.grades AS grade
              USING public.student_enrollments AS enrollment,
                    public.classes AS school_class
              WHERE grade.student_enrollment_id = enrollment.id
                AND enrollment.class_id = school_class.id
                AND school_class.school_year_id = $1'
            USING target_school_year_id;
        GET DIAGNOSTICS deleted_grades = ROW_COUNT;
    END IF;

    IF to_regclass('public.attendance_events') IS NOT NULL THEN
        EXECUTE
            'DELETE FROM public.attendance_events AS event
              USING public.teacher_assignments AS assignment,
                    public.class_subjects AS class_subject,
                    public.classes AS school_class
              WHERE event.teacher_assignment_id = assignment.id
                AND assignment.class_subject_id = class_subject.id
                AND class_subject.class_id = school_class.id
                AND school_class.school_year_id = $1'
            USING target_school_year_id;
        GET DIAGNOSTICS deleted_attendance_events = ROW_COUNT;
    END IF;

    IF to_regclass('public.assessments') IS NOT NULL THEN
        EXECUTE
            'DELETE FROM public.assessments AS assessment
              USING public.teacher_assignments AS assignment,
                    public.class_subjects AS class_subject,
                    public.classes AS school_class
              WHERE assessment.teacher_assignment_id = assignment.id
                AND assignment.class_subject_id = class_subject.id
                AND class_subject.class_id = school_class.id
                AND school_class.school_year_id = $1'
            USING target_school_year_id;
        GET DIAGNOSTICS deleted_assessments = ROW_COUNT;
    END IF;

    IF to_regclass('public.teacher_assignments') IS NOT NULL THEN
        EXECUTE
            'DELETE FROM public.teacher_assignments AS assignment
              USING public.class_subjects AS class_subject,
                    public.classes AS school_class
              WHERE assignment.class_subject_id = class_subject.id
                AND class_subject.class_id = school_class.id
                AND school_class.school_year_id = $1'
            USING target_school_year_id;
        GET DIAGNOSTICS deleted_teacher_assignments = ROW_COUNT;
    END IF;

    DELETE FROM public.class_subjects AS class_subject
     USING public.classes AS school_class
     WHERE class_subject.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_class_subjects = ROW_COUNT;

    DELETE FROM public.student_enrollments AS enrollment
     USING public.classes AS school_class
     WHERE enrollment.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_enrollments = ROW_COUNT;

    DELETE FROM public.classes
     WHERE school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_classes = ROW_COUNT;

    DELETE FROM public.reporting_periods
     WHERE school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_periods = ROW_COUNT;

    deleted_counts = jsonb_build_object(
        'reporting_periods',    deleted_periods,
        'report_card_grades',   deleted_report_card_grades,
        'report_card_subjects', deleted_report_card_subjects,
        'report_cards',         deleted_report_cards,
        'attendance_records',   deleted_attendance_records,
        'attendance_events',    deleted_attendance_events,
        'grades',               deleted_grades,
        'assessments',          deleted_assessments,
        'teacher_assignments',  deleted_teacher_assignments,
        'class_subjects',       deleted_class_subjects,
        'student_enrollments',  deleted_enrollments,
        'classes',              deleted_classes
    );

    INSERT INTO public.school_year_deletion_audits (
        school_year_id,
        school_year_name,
        deleted_by_account_id,
        deleted_counts
    )
    VALUES (
        target_school_year_id,
        target_year_name,
        administrator_account_id,
        deleted_counts
    );

    DELETE FROM public.school_years
     WHERE id = target_school_year_id;

    RETURN deleted_counts;
END;
$$;

-- Seul le rôle applicatif peut exécuter la suppression.
REVOKE ALL ON FUNCTION delete_open_school_year(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_open_school_year(uuid, text, uuid) TO blaise_app;

-- La table d'audit n'est accessible qu'en lecture au rôle applicatif.
REVOKE ALL ON TABLE school_year_deletion_audits FROM PUBLIC;
GRANT SELECT ON TABLE school_year_deletion_audits TO blaise_app;

COMMIT;
