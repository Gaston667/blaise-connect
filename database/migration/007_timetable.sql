-- =========================================================
-- MIGRATION 007 : emploi du temps
-- =========================================================
-- Tables : rooms, timetable_slots
-- Un créneau est hebdomadaire et récurrent (pas de date précise) :
-- il est rattaché à une teacher_assignment, qui porte déjà
-- teacher_id + class_subject_id + sa période de validité
-- (start_date/end_date) dans l'année scolaire.
-- =========================================================

BEGIN;

-- PostgreSQL ne fournit pas de type range natif pour "time" (seulement pour
-- date/int/numeric/timestamp) : on en déclare un pour exprimer les
-- chevauchements de créneaux avec l'opérateur && (EXCLUDE et triggers).
CREATE TYPE timerange AS RANGE (subtype = time);

-- =========================================================
-- 1. SALLES
-- =========================================================
-- Table séparée plutôt qu'un varchar libre sur timetable_slots :
-- évite la duplication/les fautes de frappe sur le nom de salle
-- et permet de retrouver tous les créneaux d'une salle sans
-- dépendre de la casse ou de l'orthographe saisie à la main.

CREATE TABLE rooms (
    id uuid
        CONSTRAINT pk_rooms PRIMARY KEY
        DEFAULT gen_random_uuid(),
    name varchar(50) NOT NULL,
    capacity smallint,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ck_rooms_name_normalized
        CHECK (
            char_length(btrim(name)) > 0
            AND name = btrim(name)
        ),

    CONSTRAINT ck_rooms_capacity_positive
        CHECK (capacity IS NULL OR capacity > 0)
);

CREATE UNIQUE INDEX uq_rooms_name_ci
    ON rooms (lower(name));

CREATE TRIGGER trg_rooms_set_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 2. CRENEAUX D'EMPLOI DU TEMPS
-- =========================================================

CREATE TABLE timetable_slots (
    id uuid
        CONSTRAINT pk_timetable_slots PRIMARY KEY
        DEFAULT gen_random_uuid(),
    teacher_assignment_id uuid NOT NULL,
    room_id uuid,
    day_of_week smallint NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_timetable_slots_teacher_assignment
        FOREIGN KEY (teacher_assignment_id)
        REFERENCES teacher_assignments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_timetable_slots_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_timetable_slots_day_of_week
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT ck_timetable_slots_times
        CHECK (end_time > start_time),

    -- Un même enseignement (teacher_assignment) ne peut pas avoir
    -- deux créneaux qui se chevauchent le même jour.
    CONSTRAINT ex_timetable_slots_no_assignment_overlap
        EXCLUDE USING gist (
            teacher_assignment_id WITH =,
            day_of_week WITH =,
            timerange(start_time, end_time) WITH &&
        )
);

CREATE INDEX idx_timetable_slots_teacher_assignment_id
    ON timetable_slots (teacher_assignment_id);

CREATE INDEX idx_timetable_slots_day_of_week
    ON timetable_slots (day_of_week);

CREATE INDEX idx_timetable_slots_room_id
    ON timetable_slots (room_id)
    WHERE room_id IS NOT NULL;

-- =========================================================
-- 3. REGLES INTER-TABLES
-- =========================================================
-- L'EXCLUDE ci-dessus ne protège que contre les doublons sur la
-- même teacher_assignment. Il faut en plus interdire :
--   - qu'un même enseignant se retrouve sur deux enseignements
--     différents en même temps (teacher_id partagé par plusieurs
--     teacher_assignments) ;
--   - qu'une même classe ait deux matières en même temps
--     (class_id atteint via class_subject_id) ;
--   - qu'une même salle soit occupée deux fois en même temps.
-- Ces vérifications nécessitent une jointure, donc un trigger
-- plutôt qu'une contrainte déclarative, sur le modèle de
-- check_grade_context() dans la migration 005.

CREATE OR REPLACE FUNCTION check_timetable_slot_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    slot_teacher_id uuid;
    slot_class_id uuid;
    conflicting_slot_id uuid;
BEGIN
    SELECT assignment.teacher_id, class_subject.class_id
      INTO slot_teacher_id, slot_class_id
      FROM teacher_assignments AS assignment
      JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
     WHERE assignment.id = NEW.teacher_assignment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'L''affectation de ce créneau est introuvable.';
    END IF;

    -- Conflit enseignant (toutes affectations confondues)
    SELECT slot.id INTO conflicting_slot_id
      FROM timetable_slots AS slot
      JOIN teacher_assignments AS assignment
        ON assignment.id = slot.teacher_assignment_id
     WHERE assignment.teacher_id = slot_teacher_id
       AND slot.day_of_week = NEW.day_of_week
       AND slot.id <> NEW.id
       AND timerange(slot.start_time, slot.end_time)
           && timerange(NEW.start_time, NEW.end_time)
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Cet enseignant a déjà un cours sur ce créneau.';
    END IF;

    -- Conflit classe (une classe ne peut pas avoir deux matières en même temps)
    SELECT slot.id INTO conflicting_slot_id
      FROM timetable_slots AS slot
      JOIN teacher_assignments AS assignment
        ON assignment.id = slot.teacher_assignment_id
      JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
     WHERE class_subject.class_id = slot_class_id
       AND slot.day_of_week = NEW.day_of_week
       AND slot.id <> NEW.id
       AND timerange(slot.start_time, slot.end_time)
           && timerange(NEW.start_time, NEW.end_time)
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Cette classe a déjà un cours sur ce créneau.';
    END IF;

    -- Conflit salle
    IF NEW.room_id IS NOT NULL THEN
        SELECT slot.id INTO conflicting_slot_id
          FROM timetable_slots AS slot
         WHERE slot.room_id = NEW.room_id
           AND slot.day_of_week = NEW.day_of_week
           AND slot.id <> NEW.id
           AND timerange(slot.start_time, slot.end_time)
               && timerange(NEW.start_time, NEW.end_time)
         LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'Cette salle est déjà occupée sur ce créneau.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_timetable_slots_check_conflicts
AFTER INSERT OR UPDATE ON timetable_slots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_timetable_slot_conflicts();

-- Un enseignement d'une année clôturée est immuable, comme pour
-- teacher_assignments/assessments/grades.
CREATE OR REPLACE FUNCTION protect_closed_timetable_slot()
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
          FROM teacher_assignments AS assignment
          JOIN class_subjects AS class_subject
            ON class_subject.id = assignment.class_subject_id
          JOIN classes AS school_class
            ON school_class.id = class_subject.class_id
          JOIN school_years AS school_year
            ON school_year.id = school_class.school_year_id
         WHERE assignment.id = OLD.teacher_assignment_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT school_year.closed_at IS NOT NULL
          INTO new_year_closed
          FROM teacher_assignments AS assignment
          JOIN class_subjects AS class_subject
            ON class_subject.id = assignment.class_subject_id
          JOIN classes AS school_class
            ON school_class.id = class_subject.class_id
          JOIN school_years AS school_year
            ON school_year.id = school_class.school_year_id
         WHERE assignment.id = NEW.teacher_assignment_id;
    END IF;

    IF old_year_closed OR new_year_closed THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'L''emploi du temps d''une année clôturée est immuable.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_timetable_slots_10_protect_closed_year
BEFORE INSERT OR UPDATE OR DELETE ON timetable_slots
FOR EACH ROW
EXECUTE FUNCTION protect_closed_timetable_slot();

CREATE TRIGGER trg_timetable_slots_set_updated_at
BEFORE UPDATE ON timetable_slots
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 4. DROITS APPLICATIFS
-- =========================================================

GRANT SELECT ON TABLE
    rooms,
    timetable_slots
TO blaise_app;

GRANT INSERT (name, capacity) ON rooms TO blaise_app;
GRANT UPDATE (name, capacity, is_active) ON rooms TO blaise_app;

GRANT INSERT (teacher_assignment_id, room_id, day_of_week, start_time, end_time)
    ON timetable_slots TO blaise_app;
GRANT UPDATE (room_id, day_of_week, start_time, end_time)
    ON timetable_slots TO blaise_app;
-- Pas de piste d'audit nécessaire ici (contrairement aux notes/absences) :
-- un planning se corrige, il ne se justifie pas.
GRANT DELETE ON TABLE timetable_slots TO blaise_app;

COMMIT;
