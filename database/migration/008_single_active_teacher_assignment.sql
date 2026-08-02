-- =========================================================
-- MIGRATION 008 : un enseignant actif par matiere de classe
-- =========================================================
-- Une matiere configuree dans une classe ne peut avoir qu'un seul
-- enseignant sur une meme plage de dates. Les anciennes affectations
-- restent conservees avec leur date de fin.
-- =========================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM teacher_assignments AS first_assignment
        JOIN teacher_assignments AS second_assignment
          ON second_assignment.class_subject_id = first_assignment.class_subject_id
         AND second_assignment.id > first_assignment.id
         AND daterange(
                second_assignment.start_date,
                COALESCE(second_assignment.end_date, 'infinity'::date),
                '[]'
             ) && daterange(
                first_assignment.start_date,
                COALESCE(first_assignment.end_date, 'infinity'::date),
                '[]'
             )
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23505',
            MESSAGE = 'Des affectations enseignantes se chevauchent pour une même matière de classe.';
    END IF;
END;
$$;

ALTER TABLE teacher_assignments
    DROP CONSTRAINT ex_teacher_assignments_no_overlap;

ALTER TABLE teacher_assignments
    ADD CONSTRAINT ex_teacher_assignments_no_class_subject_overlap
    EXCLUDE USING gist (
        class_subject_id WITH =,
        daterange(
            start_date,
            COALESCE(end_date, 'infinity'::date),
            '[]'
        ) WITH &&
    );

COMMIT;
