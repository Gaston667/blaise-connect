-- =========================================================
-- MIGRATION 008 : Appels, absences, retards et justificatifs
-- =========================================================

BEGIN;

CREATE TYPE attendance_incident_type_enum AS ENUM (
    'ABSENT',
    'LATE'
);

CREATE TYPE attendance_change_action_enum AS ENUM (
    'UPDATE',
    'DELETE'
);

CREATE TYPE attendance_request_status_enum AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


-- Un événement représente un appel effectué pendant un cours précis.
CREATE TABLE attendance_events (
    id uuid
        CONSTRAINT pk_attendance_events PRIMARY KEY
        DEFAULT gen_random_uuid(),
    teacher_assignment_id uuid NOT NULL,
    attendance_date date NOT NULL,
    course_start_time time NOT NULL,
    course_end_time time NOT NULL,
    created_by_account_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_events_teacher_assignment
        FOREIGN KEY (teacher_assignment_id)
        REFERENCES teacher_assignments(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_attendance_events_created_by
        FOREIGN KEY (created_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_attendance_events_course
        UNIQUE (
            teacher_assignment_id,
            attendance_date,
            course_start_time,
            course_end_time
        ),
    CONSTRAINT ck_attendance_events_times
        CHECK (course_end_time > course_start_time)
);

CREATE INDEX idx_attendance_events_assignment
    ON attendance_events (teacher_assignment_id);

CREATE INDEX idx_attendance_events_date
    ON attendance_events (attendance_date);

CREATE TRIGGER trg_attendance_events_set_updated_at
BEFORE UPDATE ON attendance_events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- La présence est implicite : seules les absences et les retards sont stockés.
CREATE TABLE attendance_records (
    id uuid
        CONSTRAINT pk_attendance_records PRIMARY KEY
        DEFAULT gen_random_uuid(),
    attendance_event_id uuid NOT NULL,
    student_enrollment_id uuid NOT NULL,
    incident_type attendance_incident_type_enum NOT NULL,
    late_minutes smallint,
    reason text,
    justification_status justification_status_enum NOT NULL DEFAULT 'UNJUSTIFIED',
    recorded_by_account_id uuid NOT NULL,
    reviewed_by_account_id uuid,
    reviewed_at timestamptz,
    updated_by_account_id uuid,
    last_change_reason text,
    deleted_at timestamptz,
    deleted_by_account_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_records_event
        FOREIGN KEY (attendance_event_id)
        REFERENCES attendance_events(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_attendance_records_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_attendance_records_recorded_by
        FOREIGN KEY (recorded_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_records_reviewed_by
        FOREIGN KEY (reviewed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_records_updated_by
        FOREIGN KEY (updated_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_records_deleted_by
        FOREIGN KEY (deleted_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,
    CONSTRAINT uq_attendance_records_event_enrollment
        UNIQUE (attendance_event_id, student_enrollment_id),
    CONSTRAINT ck_attendance_records_late_minutes
        CHECK (
            (
                incident_type = 'ABSENT'
                AND late_minutes IS NULL
            )
            OR
            (
                incident_type = 'LATE'
                AND late_minutes > 0
            )
        ),
    CONSTRAINT ck_attendance_records_reason
        CHECK (reason IS NULL OR char_length(btrim(reason)) > 0),
    CONSTRAINT ck_attendance_records_review
        CHECK (
            (reviewed_by_account_id IS NULL AND reviewed_at IS NULL)
            OR
            (reviewed_by_account_id IS NOT NULL AND reviewed_at IS NOT NULL)
        ),
    CONSTRAINT ck_attendance_records_deletion
        CHECK (
            (deleted_at IS NULL AND deleted_by_account_id IS NULL)
            OR
            (deleted_at IS NOT NULL AND deleted_by_account_id IS NOT NULL)
        )
);

CREATE INDEX idx_attendance_records_event
    ON attendance_records (attendance_event_id);

CREATE INDEX idx_attendance_records_enrollment
    ON attendance_records (student_enrollment_id);

CREATE INDEX idx_attendance_records_pending
    ON attendance_records (justification_status)
    WHERE justification_status = 'PENDING' AND deleted_at IS NULL;

CREATE TRIGGER trg_attendance_records_set_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- Les enseignants signalent une correction ; un administrateur la traite.
CREATE TABLE attendance_change_requests (
    id uuid
        CONSTRAINT pk_attendance_change_requests PRIMARY KEY
        DEFAULT gen_random_uuid(),
    attendance_record_id uuid NOT NULL,
    requested_by_account_id uuid NOT NULL,
    requested_action attendance_change_action_enum NOT NULL,
    proposed_incident_type attendance_incident_type_enum,
    proposed_late_minutes smallint,
    proposed_reason text,
    request_reason text NOT NULL,
    status attendance_request_status_enum NOT NULL DEFAULT 'PENDING',
    reviewed_by_account_id uuid,
    reviewed_at timestamptz,
    review_comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_change_requests_record
        FOREIGN KEY (attendance_record_id)
        REFERENCES attendance_records(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_attendance_change_requests_requested_by
        FOREIGN KEY (requested_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_attendance_change_requests_reviewed_by
        FOREIGN KEY (reviewed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_attendance_change_requests_reason
        CHECK (char_length(btrim(request_reason)) >= 3),
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
                AND proposed_incident_type IS NOT NULL
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
                status IN ('APPROVED', 'REJECTED')
                AND reviewed_by_account_id IS NOT NULL
                AND reviewed_at IS NOT NULL
            )
        )
);

CREATE UNIQUE INDEX uq_attendance_change_requests_one_pending
    ON attendance_change_requests (attendance_record_id)
    WHERE status = 'PENDING';

CREATE INDEX idx_attendance_change_requests_status
    ON attendance_change_requests (status, created_at DESC);

CREATE TRIGGER trg_attendance_change_requests_set_updated_at
BEFORE UPDATE ON attendance_change_requests
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- Historique immuable des corrections réellement appliquées.
CREATE TABLE attendance_record_history (
    id uuid
        CONSTRAINT pk_attendance_record_history PRIMARY KEY
        DEFAULT gen_random_uuid(),
    attendance_record_id uuid NOT NULL,
    change_action attendance_change_action_enum NOT NULL,
    old_incident_type attendance_incident_type_enum NOT NULL,
    new_incident_type attendance_incident_type_enum,
    old_late_minutes smallint,
    new_late_minutes smallint,
    old_reason text,
    new_reason text,
    old_justification_status justification_status_enum NOT NULL,
    new_justification_status justification_status_enum,
    changed_by_account_id uuid NOT NULL,
    change_reason text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_record_history_record
        FOREIGN KEY (attendance_record_id)
        REFERENCES attendance_records(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_attendance_record_history_changed_by
        FOREIGN KEY (changed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_attendance_record_history_reason
        CHECK (char_length(btrim(change_reason)) >= 3)
);

CREATE INDEX idx_attendance_record_history_record
    ON attendance_record_history (attendance_record_id, changed_at DESC);


-- Un justificatif peut être réutilisé sans stocker son contenu dans PostgreSQL.
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

CREATE INDEX idx_attendance_record_documents_document
    ON attendance_record_documents (document_id);


-- Vérifie que le cours se trouve dans l'affectation et l'année de la classe.
CREATE OR REPLACE FUNCTION check_attendance_event_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    assignment_start date;
    assignment_end date;
    school_year_start date;
    school_year_end date;
BEGIN
    SELECT teacher_assignment.start_date,
           teacher_assignment.end_date,
           school_year.start_date,
           school_year.end_date
      INTO assignment_start,
           assignment_end,
           school_year_start,
           school_year_end
      FROM teacher_assignments AS teacher_assignment
      JOIN class_subjects AS class_subject
        ON class_subject.id = teacher_assignment.class_subject_id
      JOIN classes AS school_class
        ON school_class.id = class_subject.class_id
      JOIN school_years AS school_year
        ON school_year.id = school_class.school_year_id
     WHERE teacher_assignment.id = NEW.teacher_assignment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'L''affectation enseignante est introuvable.';
    END IF;

    IF NEW.attendance_date < assignment_start
       OR (assignment_end IS NOT NULL AND NEW.attendance_date > assignment_end)
       OR NEW.attendance_date < school_year_start
       OR NEW.attendance_date > school_year_end
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La date de l''appel est hors de la période de l''affectation.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_attendance_events_check_context
AFTER INSERT OR UPDATE ON attendance_events
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_attendance_event_context();


-- Vérifie que l'élève appartenait bien à la classe au moment du cours.
CREATE OR REPLACE FUNCTION check_attendance_record_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    event_class_id uuid;
    event_date date;
    event_duration_minutes integer;
    enrollment_class_id uuid;
    enrollment_start date;
    enrollment_end date;
BEGIN
    SELECT class_subject.class_id,
           attendance_event.attendance_date,
           EXTRACT(
               EPOCH FROM (
                   attendance_event.course_end_time
                   - attendance_event.course_start_time
               )
           )::integer / 60
      INTO event_class_id,
           event_date,
           event_duration_minutes
      FROM attendance_events AS attendance_event
      JOIN teacher_assignments AS teacher_assignment
        ON teacher_assignment.id = attendance_event.teacher_assignment_id
      JOIN class_subjects AS class_subject
        ON class_subject.id = teacher_assignment.class_subject_id
     WHERE attendance_event.id = NEW.attendance_event_id;

    SELECT enrollment.class_id,
           enrollment.start_date,
           enrollment.end_date
      INTO enrollment_class_id,
           enrollment_start,
           enrollment_end
      FROM student_enrollments AS enrollment
     WHERE enrollment.id = NEW.student_enrollment_id;

    IF event_class_id IS NULL OR enrollment_class_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'Le cours ou l''inscription est introuvable.';
    END IF;

    IF enrollment_class_id IS DISTINCT FROM event_class_id
       OR event_date < enrollment_start
       OR (enrollment_end IS NOT NULL AND event_date > enrollment_end)
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'L''élève n''était pas inscrit dans cette classe à la date du cours.';
    END IF;

    IF NEW.incident_type = 'LATE'
       AND NEW.late_minutes > event_duration_minutes
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La durée du retard dépasse la durée du cours.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_attendance_records_check_context
AFTER INSERT OR UPDATE ON attendance_records
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_attendance_record_context();


-- Les tables d'historique ne sont jamais modifiées par le rôle applicatif.
GRANT SELECT ON TABLE
    attendance_events,
    attendance_records,
    attendance_change_requests,
    attendance_record_history,
    attendance_record_documents
TO blaise_app;

GRANT INSERT (
    teacher_assignment_id,
    attendance_date,
    course_start_time,
    course_end_time,
    created_by_account_id
) ON attendance_events TO blaise_app;

GRANT INSERT (
    attendance_event_id,
    student_enrollment_id,
    incident_type,
    late_minutes,
    reason,
    justification_status,
    recorded_by_account_id
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
    review_comment
) ON attendance_change_requests TO blaise_app;

GRANT INSERT (
    attendance_record_id,
    change_action,
    old_incident_type,
    new_incident_type,
    old_late_minutes,
    new_late_minutes,
    old_reason,
    new_reason,
    old_justification_status,
    new_justification_status,
    changed_by_account_id,
    change_reason
) ON attendance_record_history TO blaise_app;

GRANT INSERT (attendance_record_id, document_id)
ON attendance_record_documents TO blaise_app;

REVOKE DELETE ON TABLE
    attendance_events,
    attendance_records,
    attendance_change_requests,
    attendance_record_history,
    attendance_record_documents
FROM blaise_app;

COMMIT;
