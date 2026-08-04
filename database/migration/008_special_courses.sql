-- =========================================================
-- MIGRATION 008 : cours particuliers
-- =========================================================
-- Un cours particulier concerne un seul élève (pas toute la classe), et ne
-- peut avoir lieu qu'après les cours réguliers : 17h30-19h00 uniquement.
-- Contrairement à timetable_slots, il n'est pas rattaché à une
-- teacher_assignment (l'enseignant n'est pas toujours déterminé), mais à la
-- matière (subjects) directement.
-- =========================================================

BEGIN;

CREATE TABLE special_courses (
    id uuid
        CONSTRAINT pk_special_courses PRIMARY KEY
        DEFAULT gen_random_uuid(),
    student_enrollment_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    day_of_week smallint NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_special_courses_student_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_special_courses_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_special_courses_day_of_week
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT ck_special_courses_times
        CHECK (end_time > start_time),

    -- Les cours réguliers occupent déjà 8h00-17h30 : un cours particulier ne
    -- peut avoir lieu qu'après, jusqu'à la fermeture de l'établissement.
    CONSTRAINT ck_special_courses_after_regular_hours
        CHECK (start_time >= time '17:30' AND end_time <= time '19:00'),

    -- Un même élève ne peut pas avoir deux cours particuliers qui se
    -- chevauchent le même jour.
    CONSTRAINT ex_special_courses_no_student_overlap
        EXCLUDE USING gist (
            student_enrollment_id WITH =,
            day_of_week WITH =,
            timerange(start_time, end_time) WITH &&
        )
);

CREATE INDEX idx_special_courses_student_enrollment_id
    ON special_courses (student_enrollment_id);

CREATE INDEX idx_special_courses_subject_id
    ON special_courses (subject_id);

CREATE OR REPLACE FUNCTION protect_closed_special_course()
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
          FROM student_enrollments AS enrollment
          JOIN classes AS school_class ON school_class.id = enrollment.class_id
          JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
         WHERE enrollment.id = OLD.student_enrollment_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT school_year.closed_at IS NOT NULL
          INTO new_year_closed
          FROM student_enrollments AS enrollment
          JOIN classes AS school_class ON school_class.id = enrollment.class_id
          JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
         WHERE enrollment.id = NEW.student_enrollment_id;
    END IF;

    IF old_year_closed OR new_year_closed THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les cours particuliers d''une année clôturée sont immuables.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_special_courses_10_protect_closed_year
BEFORE INSERT OR UPDATE OR DELETE ON special_courses
FOR EACH ROW
EXECUTE FUNCTION protect_closed_special_course();

CREATE TRIGGER trg_special_courses_set_updated_at
BEFORE UPDATE ON special_courses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

GRANT SELECT ON TABLE special_courses TO blaise_app;

GRANT INSERT (student_enrollment_id, subject_id, day_of_week, start_time, end_time, note)
    ON special_courses TO blaise_app;
GRANT UPDATE (day_of_week, start_time, end_time, note)
    ON special_courses TO blaise_app;
GRANT DELETE ON TABLE special_courses TO blaise_app;

COMMIT;
