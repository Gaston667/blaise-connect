-- =========================================================
-- MIGRATION 006 : affectations pedagogiques des enseignants
-- =========================================================
-- Relie un enseignant a une matiere deja associee a une classe.
-- Une desaffectation conserve l'historique en renseignant end_date.
-- =========================================================

BEGIN;

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

    CONSTRAINT ex_teacher_assignments_no_overlap
        EXCLUDE USING gist (
            teacher_id WITH =,
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
    SELECT sy.start_date, sy.end_date
      INTO year_start, year_end
      FROM class_subjects AS cs
      JOIN classes AS c ON c.id = cs.class_id
      JOIN school_years AS sy ON sy.id = c.school_year_id
     WHERE cs.id = NEW.class_subject_id;

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
        SELECT sy.closed_at IS NOT NULL
          INTO old_year_closed
          FROM class_subjects AS cs
          JOIN classes AS c ON c.id = cs.class_id
          JOIN school_years AS sy ON sy.id = c.school_year_id
         WHERE cs.id = OLD.class_subject_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT sy.closed_at IS NOT NULL
          INTO new_year_closed
          FROM class_subjects AS cs
          JOIN classes AS c ON c.id = cs.class_id
          JOIN school_years AS sy ON sy.id = c.school_year_id
         WHERE cs.id = NEW.class_subject_id;
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
        UPDATE teacher_assignments AS ta
           SET end_date = NEW.end_date
          FROM class_subjects AS cs
          JOIN classes AS c ON c.id = cs.class_id
         WHERE ta.class_subject_id = cs.id
           AND c.school_year_id = NEW.id
           AND ta.end_date IS NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_school_years_15_close_teacher_assignments
BEFORE UPDATE OF closed_at ON school_years
FOR EACH ROW
EXECUTE FUNCTION close_open_teacher_assignments_for_school_year();

GRANT SELECT ON TABLE teacher_assignments TO blaise_app;
GRANT INSERT (teacher_id, class_subject_id, start_date, end_date)
    ON teacher_assignments TO blaise_app;
GRANT UPDATE (end_date)
    ON teacher_assignments TO blaise_app;

COMMIT;
