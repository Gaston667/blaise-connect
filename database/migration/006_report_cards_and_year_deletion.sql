-- =========================================================
-- MIGRATION 006 : bulletins et suppression contrôlée d'année
-- =========================================================
-- Les valeurs du bulletin sont des instantanés historiques. Une fois validé,
-- le bulletin, ses matières et les notes utilisées deviennent immuables.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. BULLETINS
-- =========================================================

CREATE TABLE report_cards (
    id uuid
        CONSTRAINT pk_report_cards PRIMARY KEY
        DEFAULT gen_random_uuid(),
    student_enrollment_id uuid NOT NULL,
    reporting_period_id uuid NOT NULL,
    general_average numeric(6,2) NOT NULL,
    overall_comment text,
    generated_by_account_id uuid NOT NULL,
    generated_at timestamptz NOT NULL DEFAULT now(),
    validated_by_account_id uuid,
    validated_at timestamptz,
    pdf_document_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_report_cards_student_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_report_cards_reporting_period
        FOREIGN KEY (reporting_period_id)
        REFERENCES reporting_periods(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_report_cards_generated_by_account
        FOREIGN KEY (generated_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_report_cards_validated_by_account
        FOREIGN KEY (validated_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_report_cards_pdf_document
        FOREIGN KEY (pdf_document_id)
        REFERENCES documents(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_report_cards_enrollment_period
        UNIQUE (student_enrollment_id, reporting_period_id),

    CONSTRAINT uq_report_cards_pdf_document
        UNIQUE (pdf_document_id),

    CONSTRAINT ck_report_cards_general_average
        CHECK (general_average >= 0),

    CONSTRAINT ck_report_cards_validation_pair
        CHECK (
            (validated_by_account_id IS NULL AND validated_at IS NULL)
            OR
            (validated_by_account_id IS NOT NULL AND validated_at IS NOT NULL)
        ),

    CONSTRAINT ck_report_cards_validation_date
        CHECK (validated_at IS NULL OR validated_at >= generated_at)
);

CREATE INDEX idx_report_cards_student_enrollment_id
    ON report_cards (student_enrollment_id);

CREATE INDEX idx_report_cards_reporting_period_id
    ON report_cards (reporting_period_id);

CREATE INDEX idx_report_cards_generated_by_account_id
    ON report_cards (generated_by_account_id);

CREATE INDEX idx_report_cards_validated_by_account_id
    ON report_cards (validated_by_account_id)
    WHERE validated_by_account_id IS NOT NULL;

CREATE INDEX idx_report_cards_pdf_document_id
    ON report_cards (pdf_document_id)
    WHERE pdf_document_id IS NOT NULL;

CREATE TABLE report_card_subjects (
    report_card_id uuid NOT NULL,
    class_subject_id uuid NOT NULL,
    subject_average numeric(6,2) NOT NULL,
    applied_coefficient numeric(6,2) NOT NULL,
    teacher_comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_report_card_subjects
        PRIMARY KEY (report_card_id, class_subject_id),

    CONSTRAINT fk_report_card_subjects_report_card
        FOREIGN KEY (report_card_id)
        REFERENCES report_cards(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_report_card_subjects_class_subject
        FOREIGN KEY (class_subject_id)
        REFERENCES class_subjects(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_report_card_subjects_average
        CHECK (subject_average >= 0),

    CONSTRAINT ck_report_card_subjects_coefficient
        CHECK (applied_coefficient > 0)
);

CREATE INDEX idx_report_card_subjects_class_subject_id
    ON report_card_subjects (class_subject_id);

CREATE TABLE report_card_grades (
    report_card_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_report_card_grades
        PRIMARY KEY (report_card_id, grade_id),

    CONSTRAINT fk_report_card_grades_report_card
        FOREIGN KEY (report_card_id)
        REFERENCES report_cards(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_report_card_grades_grade
        FOREIGN KEY (grade_id)
        REFERENCES grades(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_report_card_grades_grade_id
    ON report_card_grades (grade_id);

-- =========================================================
-- 2. COHÉRENCE ET IMMUTABILITÉ DES BULLETINS
-- =========================================================

CREATE OR REPLACE FUNCTION controlled_year_deletion_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT
        current_setting('blaiseconnect.school_year_deletion', true) = 'on'
        AND current_user <> 'blaise_app';
$$;

CREATE OR REPLACE FUNCTION check_report_card_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    enrollment_year_id uuid;
    period_year_id uuid;
    document_type_code varchar(50);
BEGIN
    SELECT school_class.school_year_id
      INTO enrollment_year_id
      FROM student_enrollments AS enrollment
      JOIN classes AS school_class ON school_class.id = enrollment.class_id
     WHERE enrollment.id = NEW.student_enrollment_id;

    SELECT period.school_year_id
      INTO period_year_id
      FROM reporting_periods AS period
     WHERE period.id = NEW.reporting_period_id;

    IF enrollment_year_id IS NULL OR period_year_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'L''inscription ou la période du bulletin est introuvable.';
    END IF;

    IF enrollment_year_id IS DISTINCT FROM period_year_id THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'L''inscription et la période du bulletin doivent appartenir à la même année.';
    END IF;

    IF NEW.pdf_document_id IS NOT NULL THEN
        SELECT document_type.code
          INTO document_type_code
         FROM documents AS document
          JOIN document_types AS document_type
            ON document_type.id = document.document_type_id
         WHERE document.id = NEW.pdf_document_id;

        IF EXISTS (
            SELECT 1
              FROM documents AS document
             WHERE document.id = NEW.pdf_document_id
               AND document.archived_at IS NOT NULL
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'Un document archivé ne peut pas devenir le PDF du bulletin.';
        END IF;

        IF document_type_code IS DISTINCT FROM 'REPORT_CARD' THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'Le PDF du bulletin doit utiliser le type de document REPORT_CARD.';
        END IF;
    END IF;

    IF NEW.validated_at IS NOT NULL AND EXISTS (
        SELECT 1
          FROM grades AS grade
          JOIN assessments AS assessment ON assessment.id = grade.assessment_id
          JOIN reporting_periods AS period ON period.id = NEW.reporting_period_id
         WHERE grade.student_enrollment_id = NEW.student_enrollment_id
           AND assessment.assessment_date BETWEEN period.start_date AND period.end_date
           AND grade.result_type = 'ABSENT'
           AND grade.justification_status = 'PENDING'
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Le bulletin ne peut pas être validé tant qu''une absence à une évaluation est en attente.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_report_cards_check_context
AFTER INSERT OR UPDATE ON report_cards
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_report_card_context();

CREATE OR REPLACE FUNCTION check_report_card_subject_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    expected_class_id uuid;
    actual_class_id uuid;
BEGIN
    SELECT enrollment.class_id
      INTO expected_class_id
      FROM report_cards AS report_card
      JOIN student_enrollments AS enrollment
        ON enrollment.id = report_card.student_enrollment_id
     WHERE report_card.id = NEW.report_card_id;

    SELECT class_subject.class_id
      INTO actual_class_id
      FROM class_subjects AS class_subject
     WHERE class_subject.id = NEW.class_subject_id;

    IF expected_class_id IS NULL OR actual_class_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'Le bulletin ou la matière de classe est introuvable.';
    END IF;

    IF expected_class_id IS DISTINCT FROM actual_class_id THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'La matière du bulletin doit appartenir à la classe de l''élève.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_report_card_subjects_check_context
AFTER INSERT OR UPDATE ON report_card_subjects
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_report_card_subject_context();

CREATE OR REPLACE FUNCTION check_report_card_grade_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    expected_enrollment_id uuid;
    expected_class_id uuid;
    period_start date;
    period_end date;
    actual_enrollment_id uuid;
    actual_class_id uuid;
    evaluation_date date;
BEGIN
    SELECT
        report_card.student_enrollment_id,
        enrollment.class_id,
        period.start_date,
        period.end_date
      INTO
        expected_enrollment_id,
        expected_class_id,
        period_start,
        period_end
      FROM report_cards AS report_card
      JOIN student_enrollments AS enrollment
        ON enrollment.id = report_card.student_enrollment_id
      JOIN reporting_periods AS period
        ON period.id = report_card.reporting_period_id
     WHERE report_card.id = NEW.report_card_id;

    SELECT
        grade.student_enrollment_id,
        class_subject.class_id,
        assessment.assessment_date
      INTO actual_enrollment_id, actual_class_id, evaluation_date
      FROM grades AS grade
      JOIN assessments AS assessment ON assessment.id = grade.assessment_id
      JOIN teacher_assignments AS assignment
        ON assignment.id = assessment.teacher_assignment_id
      JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
     WHERE grade.id = NEW.grade_id;

    IF expected_enrollment_id IS NULL OR actual_enrollment_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'Le bulletin ou la note utilisée est introuvable.';
    END IF;

    IF expected_enrollment_id IS DISTINCT FROM actual_enrollment_id
       OR expected_class_id IS DISTINCT FROM actual_class_id
       OR evaluation_date NOT BETWEEN period_start AND period_end
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'La note utilisée doit appartenir au bon élève, à sa classe et à la période du bulletin.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_report_card_grades_check_context
AFTER INSERT OR UPDATE ON report_card_grades
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_report_card_grade_context();

CREATE OR REPLACE FUNCTION protect_validated_report_card()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF controlled_year_deletion_is_active() THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    IF OLD.validated_at IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Un bulletin validé est immuable.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_report_cards_10_protect_validated
BEFORE UPDATE OR DELETE ON report_cards
FOR EACH ROW
EXECUTE FUNCTION protect_validated_report_card();

CREATE OR REPLACE FUNCTION protect_validated_report_card_line()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_report_card_id uuid;
BEGIN
    IF controlled_year_deletion_is_active() THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    target_report_card_id := CASE
        WHEN TG_OP = 'DELETE' THEN OLD.report_card_id
        ELSE NEW.report_card_id
    END;

    IF EXISTS (
        SELECT 1
          FROM report_cards AS report_card
         WHERE report_card.id = target_report_card_id
           AND report_card.validated_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les lignes d''un bulletin validé sont immuables.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_report_card_subjects_10_protect_validated
BEFORE INSERT OR UPDATE OR DELETE ON report_card_subjects
FOR EACH ROW
EXECUTE FUNCTION protect_validated_report_card_line();

CREATE TRIGGER trg_report_card_grades_10_protect_validated
BEFORE INSERT OR UPDATE OR DELETE ON report_card_grades
FOR EACH ROW
EXECUTE FUNCTION protect_validated_report_card_line();

CREATE OR REPLACE FUNCTION protect_grade_used_by_validated_report_card()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF controlled_year_deletion_is_active() THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM report_card_grades AS report_card_grade
          JOIN report_cards AS report_card
            ON report_card.id = report_card_grade.report_card_id
         WHERE report_card_grade.grade_id = OLD.id
           AND report_card.validated_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Une note utilisée dans un bulletin validé est immuable.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_grades_10_protect_validated_report_card
BEFORE UPDATE OR DELETE ON grades
FOR EACH ROW
EXECUTE FUNCTION protect_grade_used_by_validated_report_card();

CREATE OR REPLACE FUNCTION protect_period_used_by_validated_report_card()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF controlled_year_deletion_is_active() THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    IF EXISTS (
        SELECT 1
          FROM report_cards AS report_card
         WHERE report_card.reporting_period_id = OLD.id
           AND report_card.validated_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Une période utilisée par un bulletin validé est immuable.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_reporting_periods_05_protect_validated_report_card
BEFORE UPDATE OR DELETE ON reporting_periods
FOR EACH ROW
EXECUTE FUNCTION protect_period_used_by_validated_report_card();

CREATE TRIGGER trg_report_cards_set_updated_at
BEFORE UPDATE ON report_cards
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_report_card_subjects_set_updated_at
BEFORE UPDATE ON report_card_subjects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 3. SUPPRESSION CONTRÔLÉE D'UNE ANNÉE OUVERTE
-- =========================================================

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
    deleted_periods integer := 0;
    deleted_report_card_grades integer := 0;
    deleted_report_card_subjects integer := 0;
    deleted_report_cards integer := 0;
    deleted_attendance_change_requests integer := 0;
    deleted_attendance_history integer := 0;
    deleted_attendance_records integer := 0;
    deleted_attendance_events integer := 0;
    deleted_grade_change_requests integer := 0;
    deleted_grades integer := 0;
    deleted_assessments integer := 0;
    deleted_teacher_assignments integer := 0;
    deleted_class_subjects integer := 0;
    deleted_enrollments integer := 0;
    deleted_classes integer := 0;
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

    PERFORM set_config('blaiseconnect.school_year_deletion', 'on', true);

    DELETE FROM public.report_card_grades AS report_card_grade
     USING public.report_cards AS report_card,
           public.student_enrollments AS enrollment,
           public.classes AS school_class
     WHERE report_card_grade.report_card_id = report_card.id
       AND report_card.student_enrollment_id = enrollment.id
       AND enrollment.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_report_card_grades = ROW_COUNT;

    DELETE FROM public.report_card_subjects AS report_card_subject
     USING public.report_cards AS report_card,
           public.student_enrollments AS enrollment,
           public.classes AS school_class
     WHERE report_card_subject.report_card_id = report_card.id
       AND report_card.student_enrollment_id = enrollment.id
       AND enrollment.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_report_card_subjects = ROW_COUNT;

    DELETE FROM public.report_cards AS report_card
     USING public.student_enrollments AS enrollment,
           public.classes AS school_class
     WHERE report_card.student_enrollment_id = enrollment.id
       AND enrollment.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_report_cards = ROW_COUNT;

    DELETE FROM public.attendance_change_requests AS change_request
     USING public.attendance_records AS attendance_record,
           public.student_enrollments AS enrollment,
           public.classes AS school_class
     WHERE change_request.attendance_record_id = attendance_record.id
       AND attendance_record.student_enrollment_id = enrollment.id
       AND enrollment.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_attendance_change_requests = ROW_COUNT;

    DELETE FROM public.attendance_record_history AS history
     USING public.attendance_records AS attendance_record,
           public.student_enrollments AS enrollment,
           public.classes AS school_class
     WHERE history.attendance_record_id = attendance_record.id
       AND attendance_record.student_enrollment_id = enrollment.id
       AND enrollment.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_attendance_history = ROW_COUNT;

    DELETE FROM public.attendance_records AS attendance_record
     USING public.student_enrollments AS enrollment,
           public.classes AS school_class
     WHERE attendance_record.student_enrollment_id = enrollment.id
       AND enrollment.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_attendance_records = ROW_COUNT;

    DELETE FROM public.attendance_events AS event
     USING public.teacher_assignments AS assignment,
           public.class_subjects AS class_subject,
           public.classes AS school_class
     WHERE event.teacher_assignment_id = assignment.id
       AND assignment.class_subject_id = class_subject.id
       AND class_subject.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_attendance_events = ROW_COUNT;

    DELETE FROM public.grade_change_requests AS change_request
     USING public.grades AS grade,
           public.student_enrollments AS enrollment,
           public.classes AS school_class
     WHERE change_request.grade_id = grade.id
       AND grade.student_enrollment_id = enrollment.id
       AND enrollment.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_grade_change_requests = ROW_COUNT;

    DELETE FROM public.grades AS grade
     USING public.student_enrollments AS enrollment,
           public.classes AS school_class
     WHERE grade.student_enrollment_id = enrollment.id
       AND enrollment.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_grades = ROW_COUNT;

    DELETE FROM public.assessments AS assessment
     USING public.teacher_assignments AS assignment,
           public.class_subjects AS class_subject,
           public.classes AS school_class
     WHERE assessment.teacher_assignment_id = assignment.id
       AND assignment.class_subject_id = class_subject.id
       AND class_subject.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_assessments = ROW_COUNT;

    DELETE FROM public.teacher_assignments AS assignment
     USING public.class_subjects AS class_subject,
           public.classes AS school_class
     WHERE assignment.class_subject_id = class_subject.id
       AND class_subject.class_id = school_class.id
       AND school_class.school_year_id = target_school_year_id;
    GET DIAGNOSTICS deleted_teacher_assignments = ROW_COUNT;

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
        'reporting_periods', deleted_periods,
        'report_card_grades', deleted_report_card_grades,
        'report_card_subjects', deleted_report_card_subjects,
        'report_cards', deleted_report_cards,
        'attendance_change_requests', deleted_attendance_change_requests,
        'attendance_record_history', deleted_attendance_history,
        'attendance_records', deleted_attendance_records,
        'attendance_events', deleted_attendance_events,
        'grade_change_requests', deleted_grade_change_requests,
        'grades', deleted_grades,
        'assessments', deleted_assessments,
        'teacher_assignments', deleted_teacher_assignments,
        'class_subjects', deleted_class_subjects,
        'student_enrollments', deleted_enrollments,
        'classes', deleted_classes
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

-- =========================================================
-- 4. DROITS APPLICATIFS
-- =========================================================

GRANT SELECT ON TABLE
    report_cards,
    report_card_subjects,
    report_card_grades,
    school_year_deletion_audits
TO blaise_app;

GRANT INSERT (
    student_enrollment_id,
    reporting_period_id,
    general_average,
    overall_comment,
    generated_by_account_id,
    generated_at,
    pdf_document_id
) ON report_cards TO blaise_app;
GRANT UPDATE (
    general_average,
    overall_comment,
    validated_by_account_id,
    validated_at,
    pdf_document_id
) ON report_cards TO blaise_app;

GRANT INSERT (
    report_card_id,
    class_subject_id,
    subject_average,
    applied_coefficient,
    teacher_comment
) ON report_card_subjects TO blaise_app;
GRANT UPDATE (
    subject_average,
    applied_coefficient,
    teacher_comment
) ON report_card_subjects TO blaise_app;

GRANT INSERT (report_card_id, grade_id)
    ON report_card_grades TO blaise_app;

REVOKE DELETE ON TABLE
    report_cards,
    report_card_subjects,
    report_card_grades
FROM blaise_app;

REVOKE ALL ON FUNCTION delete_open_school_year(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_open_school_year(uuid, text, uuid) TO blaise_app;

REVOKE ALL ON TABLE school_year_deletion_audits FROM PUBLIC;
GRANT SELECT ON TABLE school_year_deletion_audits TO blaise_app;

COMMIT;
