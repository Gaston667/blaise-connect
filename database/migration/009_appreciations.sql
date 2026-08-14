-- =========================================================
-- MIGRATION 009 : Appréciations de période
-- =========================================================

BEGIN;

CREATE TABLE student_subject_appreciations (
    id uuid CONSTRAINT pk_student_subject_appreciations PRIMARY KEY DEFAULT gen_random_uuid(),
    student_enrollment_id uuid NOT NULL,
    class_subject_id uuid NOT NULL,
    reporting_period_id uuid NOT NULL,
    comment text NOT NULL,
    created_by_teacher_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_student_subject_appreciations_enrollment
        FOREIGN KEY (student_enrollment_id) REFERENCES student_enrollments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_student_subject_appreciations_class_subject
        FOREIGN KEY (class_subject_id) REFERENCES class_subjects(id) ON DELETE RESTRICT,
    CONSTRAINT fk_student_subject_appreciations_period
        FOREIGN KEY (reporting_period_id) REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    CONSTRAINT fk_student_subject_appreciations_teacher
        FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT,
    CONSTRAINT uq_student_subject_appreciations_context
        UNIQUE (student_enrollment_id, class_subject_id, reporting_period_id),
    CONSTRAINT ck_student_subject_appreciations_comment
        CHECK (char_length(btrim(comment)) BETWEEN 1 AND 2000)
);

CREATE INDEX idx_student_subject_appreciations_class_subject_period
    ON student_subject_appreciations (class_subject_id, reporting_period_id);

CREATE TABLE student_overall_appreciations (
    id uuid CONSTRAINT pk_student_overall_appreciations PRIMARY KEY DEFAULT gen_random_uuid(),
    student_enrollment_id uuid NOT NULL,
    reporting_period_id uuid NOT NULL,
    comment text NOT NULL,
    created_by_teacher_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_student_overall_appreciations_enrollment
        FOREIGN KEY (student_enrollment_id) REFERENCES student_enrollments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_student_overall_appreciations_period
        FOREIGN KEY (reporting_period_id) REFERENCES reporting_periods(id) ON DELETE RESTRICT,
    CONSTRAINT fk_student_overall_appreciations_teacher
        FOREIGN KEY (created_by_teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT,
    CONSTRAINT uq_student_overall_appreciations_context
        UNIQUE (student_enrollment_id, reporting_period_id),
    CONSTRAINT ck_student_overall_appreciations_comment
        CHECK (char_length(btrim(comment)) BETWEEN 1 AND 2000)
);

CREATE INDEX idx_student_overall_appreciations_period
    ON student_overall_appreciations (reporting_period_id);

CREATE TRIGGER trg_student_subject_appreciations_set_updated_at
BEFORE UPDATE ON student_subject_appreciations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_student_overall_appreciations_set_updated_at
BEFORE UPDATE ON student_overall_appreciations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT ON student_subject_appreciations, student_overall_appreciations TO blaise_app;
GRANT INSERT (student_enrollment_id, class_subject_id, reporting_period_id, comment, created_by_teacher_id)
    ON student_subject_appreciations TO blaise_app;
GRANT UPDATE (comment, created_by_teacher_id)
    ON student_subject_appreciations TO blaise_app;
GRANT INSERT (student_enrollment_id, reporting_period_id, comment, created_by_teacher_id)
    ON student_overall_appreciations TO blaise_app;
GRANT UPDATE (comment, created_by_teacher_id)
    ON student_overall_appreciations TO blaise_app;

COMMIT;
