-- =========================================================
-- MIGRATION 005 : activité pédagogique
-- =========================================================
-- Affectations, évaluations, notes, appels, justificatifs et audits.
-- Une absence injustifiée à une évaluation reste enregistrée comme ABSENT,
-- mais le service de calcul lui applique une valeur effective de zéro.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. AFFECTATIONS DES ENSEIGNANTS
-- =========================================================

CREATE TABLE teacher_assignments (
    id uuid
        CONSTRAINT pk_teacher_assignments PRIMARY KEY
        DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL,
    class_subject_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_teacher_assignments_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_teacher_assignments_class_subject
        FOREIGN KEY (class_subject_id)
        REFERENCES class_subjects(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_teacher_assignments_dates
        CHECK (end_date IS NULL OR end_date >= start_date),

    CONSTRAINT ex_teacher_assignments_no_class_subject_overlap
        EXCLUDE USING gist (
            class_subject_id WITH =,
            daterange(
                start_date,
                COALESCE(end_date, 'infinity'::date),
                '[]'
            ) WITH &&
        )
);

CREATE INDEX idx_teacher_assignments_teacher_id
    ON teacher_assignments (teacher_id);

CREATE INDEX idx_teacher_assignments_class_subject_id
    ON teacher_assignments (class_subject_id);

CREATE OR REPLACE FUNCTION check_teacher_assignment_within_class_year()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    year_start date;
    year_end date;
BEGIN
    SELECT school_year.start_date, school_year.end_date
      INTO year_start, year_end
      FROM class_subjects AS class_subject
      JOIN classes AS school_class ON school_class.id = class_subject.class_id
      JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
     WHERE class_subject.id = NEW.class_subject_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'La matière de classe de cette affectation est introuvable.';
    END IF;

    IF NEW.start_date < year_start
       OR NEW.start_date > year_end
       OR (NEW.end_date IS NOT NULL AND NEW.end_date > year_end)
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les dates de l''affectation doivent rester dans l''année scolaire de la classe.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_teacher_assignments_check_year_bounds
AFTER INSERT OR UPDATE ON teacher_assignments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_teacher_assignment_within_class_year();

CREATE OR REPLACE FUNCTION protect_closed_teacher_assignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    old_year_closed boolean := false;
    new_year_closed boolean := false;
BEGIN
    IF TG_OP <> 'INSERT' THEN
        SELECT school_year.closed_at IS NOT NULL
          INTO old_year_closed
          FROM class_subjects AS class_subject
          JOIN classes AS school_class ON school_class.id = class_subject.class_id
          JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
         WHERE class_subject.id = OLD.class_subject_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT school_year.closed_at IS NOT NULL
          INTO new_year_closed
          FROM class_subjects AS class_subject
          JOIN classes AS school_class ON school_class.id = class_subject.class_id
          JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
         WHERE class_subject.id = NEW.class_subject_id;
    END IF;

    IF old_year_closed OR new_year_closed THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les affectations d''une année clôturée sont immuables.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_teacher_assignments_10_protect_closed_year
BEFORE INSERT OR UPDATE OR DELETE ON teacher_assignments
FOR EACH ROW
EXECUTE FUNCTION protect_closed_teacher_assignment();

CREATE TRIGGER trg_teacher_assignments_set_updated_at
BEFORE UPDATE ON teacher_assignments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION close_open_teacher_assignments_for_school_year()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL THEN
        UPDATE teacher_assignments AS assignment
           SET end_date = NEW.end_date
          FROM class_subjects AS class_subject
          JOIN classes AS school_class ON school_class.id = class_subject.class_id
         WHERE assignment.class_subject_id = class_subject.id
           AND school_class.school_year_id = NEW.id
           AND assignment.end_date IS NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_school_years_15_close_teacher_assignments
BEFORE UPDATE OF closed_at ON school_years
FOR EACH ROW
EXECUTE FUNCTION close_open_teacher_assignments_for_school_year();

-- =========================================================
-- 2. ÉVALUATIONS ET NOTES
-- =========================================================

CREATE TABLE assessments (
    id uuid
        CONSTRAINT pk_assessments PRIMARY KEY
        DEFAULT gen_random_uuid(),
    teacher_assignment_id uuid NOT NULL,
    title varchar(150) NOT NULL,
    description text,
    assessment_date date NOT NULL,
    maximum_score numeric(6,2) NOT NULL,
    coefficient numeric(6,2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_assessments_teacher_assignment
        FOREIGN KEY (teacher_assignment_id)
        REFERENCES teacher_assignments(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_assessments_assignment_title_date
        UNIQUE (teacher_assignment_id, title, assessment_date),

    CONSTRAINT ck_assessments_title_not_blank
        CHECK (char_length(btrim(title)) > 0),
    CONSTRAINT ck_assessments_maximum_score_positive
        CHECK (maximum_score > 0),
    CONSTRAINT ck_assessments_coefficient_positive
        CHECK (coefficient > 0)
);

CREATE INDEX idx_assessments_teacher_assignment_id
    ON assessments (teacher_assignment_id);

CREATE INDEX idx_assessments_assessment_date
    ON assessments (assessment_date);

CREATE TABLE grades (
    id uuid
        CONSTRAINT pk_grades PRIMARY KEY
        DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL,
    student_enrollment_id uuid NOT NULL,
    result_type varchar(10) NOT NULL,
    score numeric(6,2),
    comment text,
    justification_status varchar(20),
    reviewed_by_account_id uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_grades_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_grades_student_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_grades_reviewed_by_account
        FOREIGN KEY (reviewed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_grades_assessment_enrollment
        UNIQUE (assessment_id, student_enrollment_id),

    CONSTRAINT ck_grades_result
        CHECK (
            (
                result_type = 'SCORED'
                AND score IS NOT NULL
                AND score >= 0
                AND justification_status IS NULL
                AND reviewed_by_account_id IS NULL
                AND reviewed_at IS NULL
            )
            OR
            (
                result_type = 'ABSENT'
                AND score IS NULL
                AND justification_status IN (
                    'UNJUSTIFIED',
                    'PENDING',
                    'JUSTIFIED',
                    'REJECTED'
                )
            )
        ),

    CONSTRAINT ck_grades_review_pair
        CHECK (
            (reviewed_by_account_id IS NULL AND reviewed_at IS NULL)
            OR
            (reviewed_by_account_id IS NOT NULL AND reviewed_at IS NOT NULL)
        ),

    CONSTRAINT ck_grades_final_review
        CHECK (
            justification_status NOT IN ('JUSTIFIED', 'REJECTED')
            OR (reviewed_by_account_id IS NOT NULL AND reviewed_at IS NOT NULL)
        )
);

COMMENT ON COLUMN grades.justification_status IS
    'Pour ABSENT : JUSTIFIED est exclu du calcul, UNJUSTIFIED ou REJECTED vaut zéro, PENDING bloque la validation du bulletin.';

CREATE INDEX idx_grades_assessment_id
    ON grades (assessment_id);

CREATE INDEX idx_grades_student_enrollment_id
    ON grades (student_enrollment_id);

CREATE INDEX idx_grades_reviewed_by_account_id
    ON grades (reviewed_by_account_id)
    WHERE reviewed_by_account_id IS NOT NULL;

CREATE TABLE grade_change_requests (
    id uuid
        CONSTRAINT pk_grade_change_requests PRIMARY KEY
        DEFAULT gen_random_uuid(),
    grade_id uuid NOT NULL,
    requested_by_account_id uuid NOT NULL,
    previous_result_type varchar(10) NOT NULL,
    previous_score numeric(6,2),
    previous_justification_status varchar(20),
    proposed_result_type varchar(10) NOT NULL,
    proposed_score numeric(6,2),
    proposed_justification_status varchar(20),
    request_reason text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by_account_id uuid,
    reviewed_at timestamptz,
    decision_comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_grade_change_requests_grade
        FOREIGN KEY (grade_id)
        REFERENCES grades(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_grade_change_requests_requested_by_account
        FOREIGN KEY (requested_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_grade_change_requests_reviewed_by_account
        FOREIGN KEY (reviewed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_grade_change_requests_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

    CONSTRAINT ck_grade_change_requests_reason_not_blank
        CHECK (char_length(btrim(request_reason)) > 0),

    CONSTRAINT ck_grade_change_requests_previous_result
        CHECK (
            (
                previous_result_type = 'SCORED'
                AND previous_score IS NOT NULL
                AND previous_score >= 0
                AND previous_justification_status IS NULL
            )
            OR
            (
                previous_result_type = 'ABSENT'
                AND previous_score IS NULL
                AND previous_justification_status IN (
                    'UNJUSTIFIED',
                    'PENDING',
                    'JUSTIFIED',
                    'REJECTED'
                )
            )
        ),

    CONSTRAINT ck_grade_change_requests_proposed_result
        CHECK (
            (
                proposed_result_type = 'SCORED'
                AND proposed_score IS NOT NULL
                AND proposed_score >= 0
                AND proposed_justification_status IS NULL
            )
            OR
            (
                proposed_result_type = 'ABSENT'
                AND proposed_score IS NULL
                AND proposed_justification_status IN (
                    'UNJUSTIFIED',
                    'PENDING',
                    'JUSTIFIED',
                    'REJECTED'
                )
            )
        ),

    CONSTRAINT ck_grade_change_requests_review
        CHECK (
            (
                status = 'PENDING'
                AND reviewed_by_account_id IS NULL
                AND reviewed_at IS NULL
            )
            OR
            (
                status <> 'PENDING'
                AND reviewed_by_account_id IS NOT NULL
                AND reviewed_at IS NOT NULL
            )
        )
);

CREATE INDEX idx_grade_change_requests_grade_id
    ON grade_change_requests (grade_id);

CREATE INDEX idx_grade_change_requests_requested_by_account_id
    ON grade_change_requests (requested_by_account_id);

CREATE INDEX idx_grade_change_requests_reviewed_by_account_id
    ON grade_change_requests (reviewed_by_account_id)
    WHERE reviewed_by_account_id IS NOT NULL;

CREATE UNIQUE INDEX uq_grade_change_requests_one_pending
    ON grade_change_requests (grade_id)
    WHERE status = 'PENDING';

CREATE TABLE grade_documents (
    grade_id uuid NOT NULL,
    document_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_grade_documents PRIMARY KEY (grade_id, document_id),
    CONSTRAINT fk_grade_documents_grade
        FOREIGN KEY (grade_id)
        REFERENCES grades(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_grade_documents_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_grade_documents_document_id
    ON grade_documents (document_id);

-- =========================================================
-- 3. APPELS, ABSENCES ET RETARDS
-- =========================================================

CREATE TABLE attendance_events (
    id uuid
        CONSTRAINT pk_attendance_events PRIMARY KEY
        DEFAULT gen_random_uuid(),
    teacher_assignment_id uuid NOT NULL,
    attendance_date date NOT NULL,
    course_start_time time NOT NULL,
    course_end_time time NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_events_teacher_assignment
        FOREIGN KEY (teacher_assignment_id)
        REFERENCES teacher_assignments(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_attendance_events_context
        UNIQUE (
            teacher_assignment_id,
            attendance_date,
            course_start_time,
            course_end_time
        ),

    CONSTRAINT ck_attendance_events_times
        CHECK (course_end_time > course_start_time)
);

CREATE INDEX idx_attendance_events_teacher_assignment_id
    ON attendance_events (teacher_assignment_id);

CREATE INDEX idx_attendance_events_attendance_date
    ON attendance_events (attendance_date);

CREATE TABLE attendance_records (
    id uuid
        CONSTRAINT pk_attendance_records PRIMARY KEY
        DEFAULT gen_random_uuid(),
    attendance_event_id uuid NOT NULL,
    student_enrollment_id uuid NOT NULL,
    incident_type varchar(10) NOT NULL,
    late_minutes smallint,
    reason text,
    justification_status varchar(20) NOT NULL DEFAULT 'PENDING',
    recorded_by_account_id uuid NOT NULL,
    reviewed_by_account_id uuid,
    reviewed_at timestamptz,
    updated_by_account_id uuid NOT NULL,
    last_change_reason text,
    deleted_at timestamptz,
    deleted_by_account_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_records_event
        FOREIGN KEY (attendance_event_id)
        REFERENCES attendance_events(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_records_student_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_records_recorded_by_account
        FOREIGN KEY (recorded_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_records_reviewed_by_account
        FOREIGN KEY (reviewed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_records_updated_by_account
        FOREIGN KEY (updated_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_records_deleted_by_account
        FOREIGN KEY (deleted_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_attendance_records_incident
        CHECK (
            (incident_type = 'ABSENT' AND late_minutes IS NULL)
            OR
            (incident_type = 'LATE' AND late_minutes > 0)
        ),

    CONSTRAINT ck_attendance_records_justification_status
        CHECK (
            justification_status IN (
                'UNJUSTIFIED',
                'PENDING',
                'JUSTIFIED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_attendance_records_review
        CHECK (
            (
                justification_status = 'PENDING'
                AND reviewed_by_account_id IS NULL
                AND reviewed_at IS NULL
            )
            OR
            (
                justification_status <> 'PENDING'
                AND reviewed_by_account_id IS NOT NULL
                AND reviewed_at IS NOT NULL
            )
        ),

    CONSTRAINT ck_attendance_records_deletion_pair
        CHECK (
            (deleted_at IS NULL AND deleted_by_account_id IS NULL)
            OR
            (deleted_at IS NOT NULL AND deleted_by_account_id IS NOT NULL)
        )
);

CREATE UNIQUE INDEX uq_attendance_records_active_event_enrollment
    ON attendance_records (attendance_event_id, student_enrollment_id)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_attendance_records_attendance_event_id
    ON attendance_records (attendance_event_id);

CREATE INDEX idx_attendance_records_student_enrollment_id
    ON attendance_records (student_enrollment_id);

CREATE INDEX idx_attendance_records_recorded_by_account_id
    ON attendance_records (recorded_by_account_id);

CREATE INDEX idx_attendance_records_reviewed_by_account_id
    ON attendance_records (reviewed_by_account_id)
    WHERE reviewed_by_account_id IS NOT NULL;

CREATE INDEX idx_attendance_records_updated_by_account_id
    ON attendance_records (updated_by_account_id);

CREATE INDEX idx_attendance_records_deleted_by_account_id
    ON attendance_records (deleted_by_account_id)
    WHERE deleted_by_account_id IS NOT NULL;

CREATE TABLE attendance_record_history (
    id uuid
        CONSTRAINT pk_attendance_record_history PRIMARY KEY
        DEFAULT gen_random_uuid(),
    attendance_record_id uuid NOT NULL,
    old_incident_type varchar(10) NOT NULL,
    new_incident_type varchar(10) NOT NULL,
    old_late_minutes smallint,
    new_late_minutes smallint,
    old_reason text,
    new_reason text,
    old_justification_status varchar(20) NOT NULL,
    new_justification_status varchar(20) NOT NULL,
    old_reviewed_by_account_id uuid,
    new_reviewed_by_account_id uuid,
    old_reviewed_at timestamptz,
    new_reviewed_at timestamptz,
    old_deleted_at timestamptz,
    new_deleted_at timestamptz,
    old_deleted_by_account_id uuid,
    new_deleted_by_account_id uuid,
    changed_by_account_id uuid NOT NULL,
    change_reason text,
    changed_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_record_history_record
        FOREIGN KEY (attendance_record_id)
        REFERENCES attendance_records(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_record_history_changed_by_account
        FOREIGN KEY (changed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_record_history_old_reviewer
        FOREIGN KEY (old_reviewed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_record_history_new_reviewer
        FOREIGN KEY (new_reviewed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_record_history_old_deleted_by
        FOREIGN KEY (old_deleted_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_record_history_new_deleted_by
        FOREIGN KEY (new_deleted_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_attendance_record_history_record_id
    ON attendance_record_history (attendance_record_id);

CREATE INDEX idx_attendance_record_history_changed_at
    ON attendance_record_history (changed_at);

CREATE INDEX idx_attendance_record_history_changed_by_account_id
    ON attendance_record_history (changed_by_account_id);

CREATE INDEX idx_attendance_record_history_old_reviewer
    ON attendance_record_history (old_reviewed_by_account_id)
    WHERE old_reviewed_by_account_id IS NOT NULL;

CREATE INDEX idx_attendance_record_history_new_reviewer
    ON attendance_record_history (new_reviewed_by_account_id)
    WHERE new_reviewed_by_account_id IS NOT NULL;

CREATE INDEX idx_attendance_record_history_old_deleted_by
    ON attendance_record_history (old_deleted_by_account_id)
    WHERE old_deleted_by_account_id IS NOT NULL;

CREATE INDEX idx_attendance_record_history_new_deleted_by
    ON attendance_record_history (new_deleted_by_account_id)
    WHERE new_deleted_by_account_id IS NOT NULL;

CREATE TABLE attendance_change_requests (
    id uuid
        CONSTRAINT pk_attendance_change_requests PRIMARY KEY
        DEFAULT gen_random_uuid(),
    attendance_record_id uuid NOT NULL,
    requested_by_account_id uuid NOT NULL,
    requested_action varchar(10) NOT NULL,
    proposed_incident_type varchar(10),
    proposed_late_minutes smallint,
    proposed_reason text,
    request_reason text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'PENDING',
    reviewed_by_account_id uuid,
    reviewed_at timestamptz,
    decision_comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_change_requests_record
        FOREIGN KEY (attendance_record_id)
        REFERENCES attendance_records(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_change_requests_requested_by_account
        FOREIGN KEY (requested_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_change_requests_reviewed_by_account
        FOREIGN KEY (reviewed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_attendance_change_requests_action
        CHECK (requested_action IN ('UPDATE', 'DELETE')),

    CONSTRAINT ck_attendance_change_requests_status
        CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),

    CONSTRAINT ck_attendance_change_requests_reason_not_blank
        CHECK (char_length(btrim(request_reason)) > 0),

    CONSTRAINT ck_attendance_change_requests_proposal
        CHECK (
            (
                requested_action = 'DELETE'
                AND proposed_incident_type IS NULL
                AND proposed_late_minutes IS NULL
                AND proposed_reason IS NULL
            )
            OR
            (
                requested_action = 'UPDATE'
                AND (
                    (proposed_incident_type = 'ABSENT' AND proposed_late_minutes IS NULL)
                    OR
                    (proposed_incident_type = 'LATE' AND proposed_late_minutes > 0)
                )
            )
        ),

    CONSTRAINT ck_attendance_change_requests_review
        CHECK (
            (
                status = 'PENDING'
                AND reviewed_by_account_id IS NULL
                AND reviewed_at IS NULL
            )
            OR
            (
                status <> 'PENDING'
                AND reviewed_by_account_id IS NOT NULL
                AND reviewed_at IS NOT NULL
            )
        )
);

CREATE INDEX idx_attendance_change_requests_record_id
    ON attendance_change_requests (attendance_record_id);

CREATE INDEX idx_attendance_change_requests_requested_by_account_id
    ON attendance_change_requests (requested_by_account_id);

CREATE INDEX idx_attendance_change_requests_reviewed_by_account_id
    ON attendance_change_requests (reviewed_by_account_id)
    WHERE reviewed_by_account_id IS NOT NULL;

CREATE UNIQUE INDEX uq_attendance_change_requests_one_pending
    ON attendance_change_requests (attendance_record_id)
    WHERE status = 'PENDING';

CREATE TABLE attendance_record_documents (
    attendance_record_id uuid NOT NULL,
    document_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_attendance_record_documents
        PRIMARY KEY (attendance_record_id, document_id),
    CONSTRAINT fk_attendance_record_documents_record
        FOREIGN KEY (attendance_record_id)
        REFERENCES attendance_records(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_attendance_record_documents_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_attendance_record_documents_document_id
    ON attendance_record_documents (document_id);

-- =========================================================
-- 4. CONTRAINTES INTER-TABLES ET AUDIT
-- =========================================================

CREATE OR REPLACE FUNCTION check_assessment_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    assignment_start date;
    assignment_end date;
    year_start date;
    year_end date;
    year_closed_at timestamptz;
BEGIN
    SELECT
        assignment.start_date,
        assignment.end_date,
        school_year.start_date,
        school_year.end_date,
        school_year.closed_at
      INTO
        assignment_start,
        assignment_end,
        year_start,
        year_end,
        year_closed_at
      FROM teacher_assignments AS assignment
      JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
      JOIN classes AS school_class
        ON school_class.id = class_subject.class_id
      JOIN school_years AS school_year
        ON school_year.id = school_class.school_year_id
     WHERE assignment.id = NEW.teacher_assignment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'L''affectation de cette évaluation est introuvable.';
    END IF;

    IF year_closed_at IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Une évaluation d''une année clôturée ne peut pas être modifiée.';
    END IF;

    IF NEW.assessment_date < assignment_start
       OR NEW.assessment_date > COALESCE(assignment_end, year_end)
       OR NEW.assessment_date < year_start
       OR NEW.assessment_date > year_end
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'La date de l''évaluation doit appartenir à l''affectation et à l''année scolaire.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_assessments_check_context
AFTER INSERT OR UPDATE ON assessments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_assessment_context();

CREATE OR REPLACE FUNCTION check_grade_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    expected_class_id uuid;
    actual_class_id uuid;
    evaluation_date date;
    evaluation_maximum numeric(6,2);
    enrollment_start date;
    enrollment_end date;
    year_closed_at timestamptz;
BEGIN
    SELECT
        class_subject.class_id,
        assessment.assessment_date,
        assessment.maximum_score,
        school_year.closed_at
      INTO
        expected_class_id,
        evaluation_date,
        evaluation_maximum,
        year_closed_at
      FROM assessments AS assessment
      JOIN teacher_assignments AS assignment
        ON assignment.id = assessment.teacher_assignment_id
      JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
      JOIN classes AS school_class
        ON school_class.id = class_subject.class_id
      JOIN school_years AS school_year
        ON school_year.id = school_class.school_year_id
     WHERE assessment.id = NEW.assessment_id;

    SELECT enrollment.class_id, enrollment.start_date, enrollment.end_date
      INTO actual_class_id, enrollment_start, enrollment_end
      FROM student_enrollments AS enrollment
     WHERE enrollment.id = NEW.student_enrollment_id;

    IF expected_class_id IS NULL OR actual_class_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'L''évaluation ou l''inscription de la note est introuvable.';
    END IF;

    IF year_closed_at IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les notes d''une année clôturée sont immuables.';
    END IF;

    IF expected_class_id IS DISTINCT FROM actual_class_id
       OR evaluation_date < enrollment_start
       OR evaluation_date > COALESCE(enrollment_end, evaluation_date)
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'L''élève doit être inscrit dans la classe à la date de l''évaluation.';
    END IF;

    IF NEW.result_type = 'SCORED' AND NEW.score > evaluation_maximum THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'La note ne peut pas dépasser le barème de l''évaluation.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_grades_check_context
AFTER INSERT OR UPDATE ON grades
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_grade_context();

CREATE OR REPLACE FUNCTION check_grade_change_request_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    current_result_type varchar(10);
    current_score numeric(6,2);
    current_justification_status varchar(20);
    evaluation_maximum numeric(6,2);
BEGIN
    SELECT
        grade.result_type,
        grade.score,
        grade.justification_status,
        assessment.maximum_score
      INTO
        current_result_type,
        current_score,
        current_justification_status,
        evaluation_maximum
      FROM grades AS grade
      JOIN assessments AS assessment ON assessment.id = grade.assessment_id
     WHERE grade.id = NEW.grade_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'La note de la demande de modification est introuvable.';
    END IF;

    IF TG_OP = 'INSERT'
       AND (
            NEW.previous_result_type IS DISTINCT FROM current_result_type
            OR NEW.previous_score IS DISTINCT FROM current_score
            OR NEW.previous_justification_status IS DISTINCT FROM current_justification_status
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '40001',
            MESSAGE = 'La note a changé avant la création de la demande.';
    END IF;

    IF NEW.proposed_result_type = 'SCORED'
       AND NEW.proposed_score > evaluation_maximum
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'La note proposée dépasse le barème de l''évaluation.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_grade_change_requests_check_context
AFTER INSERT OR UPDATE ON grade_change_requests
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_grade_change_request_context();

CREATE OR REPLACE FUNCTION check_attendance_event_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    assignment_start date;
    assignment_end date;
    year_end date;
    year_closed_at timestamptz;
BEGIN
    SELECT
        assignment.start_date,
        assignment.end_date,
        school_year.end_date,
        school_year.closed_at
      INTO assignment_start, assignment_end, year_end, year_closed_at
      FROM teacher_assignments AS assignment
      JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
      JOIN classes AS school_class
        ON school_class.id = class_subject.class_id
      JOIN school_years AS school_year
        ON school_year.id = school_class.school_year_id
     WHERE assignment.id = NEW.teacher_assignment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'L''affectation de cet appel est introuvable.';
    END IF;

    IF year_closed_at IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Un appel d''une année clôturée ne peut pas être modifié.';
    END IF;

    IF NEW.attendance_date < assignment_start
       OR NEW.attendance_date > COALESCE(assignment_end, year_end)
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'La date de l''appel doit appartenir à la période d''affectation.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_attendance_events_check_context
AFTER INSERT OR UPDATE ON attendance_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_attendance_event_context();

CREATE OR REPLACE FUNCTION check_attendance_record_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    expected_class_id uuid;
    actual_class_id uuid;
    event_date date;
    enrollment_start date;
    enrollment_end date;
    course_duration_minutes integer;
    year_closed_at timestamptz;
BEGIN
    SELECT
        class_subject.class_id,
        event.attendance_date,
        floor(
            extract(epoch FROM (event.course_end_time - event.course_start_time)) / 60
        )::integer,
        school_year.closed_at
      INTO expected_class_id, event_date, course_duration_minutes, year_closed_at
      FROM attendance_events AS event
      JOIN teacher_assignments AS assignment
        ON assignment.id = event.teacher_assignment_id
      JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
      JOIN classes AS school_class
        ON school_class.id = class_subject.class_id
      JOIN school_years AS school_year
        ON school_year.id = school_class.school_year_id
     WHERE event.id = NEW.attendance_event_id;

    SELECT enrollment.class_id, enrollment.start_date, enrollment.end_date
      INTO actual_class_id, enrollment_start, enrollment_end
      FROM student_enrollments AS enrollment
     WHERE enrollment.id = NEW.student_enrollment_id;

    IF expected_class_id IS NULL OR actual_class_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'L''appel ou l''inscription de l''élève est introuvable.';
    END IF;

    IF year_closed_at IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les absences et retards d''une année clôturée sont immuables.';
    END IF;

    IF expected_class_id IS DISTINCT FROM actual_class_id
       OR event_date < enrollment_start
       OR event_date > COALESCE(enrollment_end, event_date)
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'L''élève doit être inscrit dans la classe à la date de l''appel.';
    END IF;

    IF NEW.incident_type = 'LATE'
       AND NEW.late_minutes > course_duration_minutes
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Le retard ne peut pas dépasser la durée du cours.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_attendance_records_check_context
AFTER INSERT OR UPDATE ON attendance_records
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_attendance_record_context();

CREATE OR REPLACE FUNCTION log_attendance_record_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF ROW(
        OLD.incident_type,
        OLD.late_minutes,
        OLD.reason,
        OLD.justification_status,
        OLD.reviewed_by_account_id,
        OLD.reviewed_at,
        OLD.deleted_at,
        OLD.deleted_by_account_id
    ) IS DISTINCT FROM ROW(
        NEW.incident_type,
        NEW.late_minutes,
        NEW.reason,
        NEW.justification_status,
        NEW.reviewed_by_account_id,
        NEW.reviewed_at,
        NEW.deleted_at,
        NEW.deleted_by_account_id
    ) THEN
        IF NEW.last_change_reason IS NULL
           OR char_length(btrim(NEW.last_change_reason)) = 0
           OR NEW.last_change_reason IS NOT DISTINCT FROM OLD.last_change_reason
        THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'Chaque correction d''assiduité doit indiquer un nouveau motif.';
        END IF;

        INSERT INTO attendance_record_history (
            attendance_record_id,
            old_incident_type,
            new_incident_type,
            old_late_minutes,
            new_late_minutes,
            old_reason,
            new_reason,
            old_justification_status,
            new_justification_status,
            old_reviewed_by_account_id,
            new_reviewed_by_account_id,
            old_reviewed_at,
            new_reviewed_at,
            old_deleted_at,
            new_deleted_at,
            old_deleted_by_account_id,
            new_deleted_by_account_id,
            changed_by_account_id,
            change_reason
        )
        VALUES (
            OLD.id,
            OLD.incident_type,
            NEW.incident_type,
            OLD.late_minutes,
            NEW.late_minutes,
            OLD.reason,
            NEW.reason,
            OLD.justification_status,
            NEW.justification_status,
            OLD.reviewed_by_account_id,
            NEW.reviewed_by_account_id,
            OLD.reviewed_at,
            NEW.reviewed_at,
            OLD.deleted_at,
            NEW.deleted_at,
            OLD.deleted_by_account_id,
            NEW.deleted_by_account_id,
            NEW.updated_by_account_id,
            NEW.last_change_reason
        );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attendance_records_log_change
AFTER UPDATE ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION log_attendance_record_change();

CREATE OR REPLACE FUNCTION check_grade_document_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM grades AS grade
         WHERE grade.id = NEW.grade_id
           AND grade.result_type = 'ABSENT'
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Un justificatif d''évaluation ne peut être lié qu''à une note ABSENT.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM documents AS document
          JOIN document_types AS document_type
            ON document_type.id = document.document_type_id
         WHERE document.id = NEW.document_id
           AND document.archived_at IS NULL
           AND document_type.code IN ('ASSESSMENT_JUSTIFICATION', 'OTHER')
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Le document doit être un justificatif d''évaluation.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_grade_documents_check_type
AFTER INSERT OR UPDATE ON grade_documents
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_grade_document_type();

CREATE OR REPLACE FUNCTION check_attendance_document_type()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM documents AS document
          JOIN document_types AS document_type
            ON document_type.id = document.document_type_id
         WHERE document.id = NEW.document_id
           AND document.archived_at IS NULL
           AND document_type.code IN ('ATTENDANCE_JUSTIFICATION', 'OTHER')
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Le document doit être un justificatif d''assiduité.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_attendance_record_documents_check_type
AFTER INSERT OR UPDATE ON attendance_record_documents
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_attendance_document_type();

CREATE TRIGGER trg_assessments_set_updated_at
BEFORE UPDATE ON assessments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_grades_set_updated_at
BEFORE UPDATE ON grades
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_grade_change_requests_set_updated_at
BEFORE UPDATE ON grade_change_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_attendance_events_set_updated_at
BEFORE UPDATE ON attendance_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_attendance_records_set_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_attendance_change_requests_set_updated_at
BEFORE UPDATE ON attendance_change_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 5. DROITS APPLICATIFS
-- =========================================================

GRANT SELECT ON TABLE
    teacher_assignments,
    assessments,
    grades,
    grade_change_requests,
    grade_documents,
    attendance_events,
    attendance_records,
    attendance_record_history,
    attendance_change_requests,
    attendance_record_documents
TO blaise_app;

GRANT INSERT (teacher_id, class_subject_id, start_date, end_date)
    ON teacher_assignments TO blaise_app;
GRANT UPDATE (end_date)
    ON teacher_assignments TO blaise_app;

GRANT INSERT (
    teacher_assignment_id,
    title,
    description,
    assessment_date,
    maximum_score,
    coefficient
) ON assessments TO blaise_app;
GRANT UPDATE (
    title,
    description,
    assessment_date,
    maximum_score,
    coefficient
) ON assessments TO blaise_app;

GRANT INSERT (
    assessment_id,
    student_enrollment_id,
    result_type,
    score,
    comment,
    justification_status,
    reviewed_by_account_id,
    reviewed_at
) ON grades TO blaise_app;
GRANT UPDATE (
    result_type,
    score,
    comment,
    justification_status,
    reviewed_by_account_id,
    reviewed_at
) ON grades TO blaise_app;

GRANT INSERT (
    grade_id,
    requested_by_account_id,
    previous_result_type,
    previous_score,
    previous_justification_status,
    proposed_result_type,
    proposed_score,
    proposed_justification_status,
    request_reason
) ON grade_change_requests TO blaise_app;
GRANT UPDATE (
    status,
    reviewed_by_account_id,
    reviewed_at,
    decision_comment
) ON grade_change_requests TO blaise_app;

GRANT INSERT, DELETE ON TABLE grade_documents TO blaise_app;

GRANT INSERT (
    teacher_assignment_id,
    attendance_date,
    course_start_time,
    course_end_time
) ON attendance_events TO blaise_app;
GRANT UPDATE (
    attendance_date,
    course_start_time,
    course_end_time
) ON attendance_events TO blaise_app;

GRANT INSERT (
    attendance_event_id,
    student_enrollment_id,
    incident_type,
    late_minutes,
    reason,
    justification_status,
    recorded_by_account_id,
    reviewed_by_account_id,
    reviewed_at,
    updated_by_account_id,
    last_change_reason
) ON attendance_records TO blaise_app;
GRANT UPDATE (
    incident_type,
    late_minutes,
    reason,
    justification_status,
    reviewed_by_account_id,
    reviewed_at,
    updated_by_account_id,
    last_change_reason,
    deleted_at,
    deleted_by_account_id
) ON attendance_records TO blaise_app;

GRANT INSERT (
    attendance_record_id,
    requested_by_account_id,
    requested_action,
    proposed_incident_type,
    proposed_late_minutes,
    proposed_reason,
    request_reason
) ON attendance_change_requests TO blaise_app;
GRANT UPDATE (
    status,
    reviewed_by_account_id,
    reviewed_at,
    decision_comment
) ON attendance_change_requests TO blaise_app;

GRANT INSERT, DELETE ON TABLE attendance_record_documents TO blaise_app;

REVOKE DELETE ON TABLE
    teacher_assignments,
    assessments,
    grades,
    grade_change_requests,
    attendance_events,
    attendance_records,
    attendance_record_history,
    attendance_change_requests
FROM blaise_app;

REVOKE INSERT, UPDATE, DELETE ON TABLE attendance_record_history FROM blaise_app;

COMMIT;
