-- =========================================================
-- MIGRATION 007 : emploi du temps (cours réguliers et particuliers)
-- =========================================================
-- Fusionne les anciennes migrations 007 (timetable_slots) et 008
-- (special_courses) en un seul fichier. Tables distinctes conservées
-- (US-029, cf. journal des décisions).
--
-- Règle stricte : aucun chevauchement horaire n'est toléré, quel que soit
-- le type de cours, pour un même élève, un même enseignant (si renseigné)
-- ou une même salle (si renseignée). Les cours particuliers n'ont pas de
-- créneau horaire imposé.
--
-- Règle métier validée : un timetable_slot occupe TOUS les élèves inscrits
-- dans la classe concernée (via class_subjects -> student_enrollments).
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- Table : rooms
-- ---------------------------------------------------------
CREATE TABLE rooms (
    id uuid CONSTRAINT pk_rooms PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    capacity integer,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_rooms_name UNIQUE (name),
    CONSTRAINT ck_rooms_capacity_positive
        CHECK (capacity IS NULL OR capacity > 0)
);

COMMENT ON TABLE rooms IS 'Salles physiques ou virtuelles utilisables pour un cours régulier ou particulier.';

-- ---------------------------------------------------------
-- Table : timetable_slots (cours réguliers)
-- ---------------------------------------------------------
CREATE TABLE timetable_slots (
    id uuid CONSTRAINT pk_timetable_slots PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_assignment_id uuid NOT NULL,
    room_id uuid,
    day_of_week smallint NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_timetable_slots_teacher_assignment
        FOREIGN KEY (teacher_assignment_id)
        REFERENCES teacher_assignments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_timetable_slots_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_timetable_slots_day_of_week
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT ck_timetable_slots_time_order
        CHECK (start_time < end_time)
);

COMMENT ON TABLE timetable_slots IS 'Créneaux hebdomadaires réguliers rattachés à une affectation enseignant/classe/matière.';

CREATE INDEX idx_timetable_slots_teacher_assignment_id
    ON timetable_slots (teacher_assignment_id);

CREATE INDEX idx_timetable_slots_room_id
    ON timetable_slots (room_id)
    WHERE room_id IS NOT NULL;

CREATE INDEX idx_timetable_slots_day_time
    ON timetable_slots (day_of_week, start_time, end_time);

-- ---------------------------------------------------------
-- Table : special_courses (cours particuliers)
-- ---------------------------------------------------------
CREATE TABLE special_courses (
    id uuid CONSTRAINT pk_special_courses PRIMARY KEY DEFAULT gen_random_uuid(),
    student_enrollment_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    teacher_id uuid,
    room_id uuid,
    day_of_week smallint NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_special_courses_student_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_special_courses_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_special_courses_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_special_courses_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON DELETE SET NULL,

    CONSTRAINT ck_special_courses_day_of_week
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT ck_special_courses_time_order
        CHECK (start_time < end_time)
);

COMMENT ON TABLE special_courses IS 'Cours individuels (rattrapage, soutien) : matière obligatoire, enseignant et salle facultatifs, sans créneau horaire imposé.';

CREATE INDEX idx_special_courses_student_enrollment_id
    ON special_courses (student_enrollment_id);

CREATE INDEX idx_special_courses_teacher_id
    ON special_courses (teacher_id)
    WHERE teacher_id IS NOT NULL;

CREATE INDEX idx_special_courses_room_id
    ON special_courses (room_id)
    WHERE room_id IS NOT NULL;

CREATE INDEX idx_special_courses_day_time
    ON special_courses (day_of_week, start_time, end_time);

-- =========================================================
-- VUE UNIFIÉE : occupations horaires (régulières + particulières)
-- =========================================================
-- Chaque ligne = une occupation. Un timetable_slot génère une ligne PAR
-- élève inscrit dans la classe (via class_subjects -> student_enrollments),
-- car tous ces élèves sont occupés simultanément.
-- =========================================================
CREATE VIEW v_schedule_occupations AS
SELECT
    'TIMETABLE_SLOT'::text AS occupation_type,
    slot.id AS source_id,
    enrollment.id AS student_enrollment_id,
    assignment.teacher_id AS teacher_id,
    slot.room_id AS room_id,
    slot.day_of_week AS day_of_week,
    slot.start_time AS start_time,
    slot.end_time AS end_time
FROM timetable_slots AS slot
JOIN teacher_assignments AS assignment
    ON assignment.id = slot.teacher_assignment_id
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN student_enrollments AS enrollment
    ON enrollment.class_id = class_subject.class_id

UNION ALL

SELECT
    'SPECIAL_COURSE'::text AS occupation_type,
    special_course.id AS source_id,
    special_course.student_enrollment_id AS student_enrollment_id,
    special_course.teacher_id AS teacher_id,
    special_course.room_id AS room_id,
    special_course.day_of_week AS day_of_week,
    special_course.start_time AS start_time,
    special_course.end_time AS end_time
FROM special_courses AS special_course;

COMMENT ON VIEW v_schedule_occupations IS
    'Vue unifiée de toutes les occupations horaires (cours réguliers dupliqués par élève de la classe, et cours particuliers) utilisée pour détecter les chevauchements.';

-- =========================================================
-- FONCTION : détection de chevauchement pour un cours particulier
-- =========================================================
CREATE OR REPLACE FUNCTION check_special_course_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    conflict_count integer;
BEGIN
    -- Conflit élève.
    SELECT count(*) INTO conflict_count
    FROM v_schedule_occupations AS occupation
    WHERE occupation.student_enrollment_id = NEW.student_enrollment_id
      AND occupation.source_id <> NEW.id
      AND NOT (occupation.occupation_type = 'SPECIAL_COURSE' AND occupation.source_id = NEW.id)
      AND occupation.day_of_week = NEW.day_of_week
      AND occupation.start_time < NEW.end_time
      AND occupation.end_time > NEW.start_time;

    IF conflict_count > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Chevauchement horaire détecté pour cet élève.';
    END IF;

    -- Conflit enseignant (si renseigné).
    IF NEW.teacher_id IS NOT NULL THEN
        SELECT count(*) INTO conflict_count
        FROM v_schedule_occupations AS occupation
        WHERE occupation.teacher_id = NEW.teacher_id
          AND occupation.source_id <> NEW.id
          AND occupation.day_of_week = NEW.day_of_week
          AND occupation.start_time < NEW.end_time
          AND occupation.end_time > NEW.start_time;

        IF conflict_count > 0 THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'Chevauchement horaire détecté pour cet enseignant.';
        END IF;
    END IF;

    -- Conflit salle (si renseignée).
    IF NEW.room_id IS NOT NULL THEN
        SELECT count(*) INTO conflict_count
        FROM v_schedule_occupations AS occupation
        WHERE occupation.room_id = NEW.room_id
          AND occupation.source_id <> NEW.id
          AND occupation.day_of_week = NEW.day_of_week
          AND occupation.start_time < NEW.end_time
          AND occupation.end_time > NEW.start_time;

        IF conflict_count > 0 THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'Chevauchement horaire détecté pour cette salle.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_special_course_conflicts() IS 'Empêche tout chevauchement horaire (élève, enseignant, salle) lors de l ajout ou modification d un cours particulier.';

-- =========================================================
-- FONCTION : détection de chevauchement pour un créneau régulier
-- =========================================================
CREATE OR REPLACE FUNCTION check_timetable_slot_conflicts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    conflict_count integer;
    affected_teacher_id uuid;
    affected_student_enrollment_ids uuid[];
BEGIN
    -- Récupère l'enseignant concerné par ce créneau.
    SELECT assignment.teacher_id INTO affected_teacher_id
    FROM teacher_assignments AS assignment
    WHERE assignment.id = NEW.teacher_assignment_id;

    -- Récupère tous les élèves de la classe concernée par ce créneau.
    SELECT array_agg(enrollment.id) INTO affected_student_enrollment_ids
    FROM teacher_assignments AS assignment
    JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
    JOIN student_enrollments AS enrollment
        ON enrollment.class_id = class_subject.class_id
    WHERE assignment.id = NEW.teacher_assignment_id;

    -- Conflit élève : au moins un élève de la classe a déjà une occupation
    -- qui chevauche ce créneau.
    SELECT count(*) INTO conflict_count
    FROM v_schedule_occupations AS occupation
    WHERE occupation.student_enrollment_id = ANY (affected_student_enrollment_ids)
      AND occupation.source_id <> NEW.id
      AND occupation.day_of_week = NEW.day_of_week
      AND occupation.start_time < NEW.end_time
      AND occupation.end_time > NEW.start_time;

    IF conflict_count > 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Chevauchement horaire détecté pour au moins un élève de la classe.';
    END IF;

    -- Conflit enseignant.
    IF affected_teacher_id IS NOT NULL THEN
        SELECT count(*) INTO conflict_count
        FROM v_schedule_occupations AS occupation
        WHERE occupation.teacher_id = affected_teacher_id
          AND occupation.source_id <> NEW.id
          AND occupation.day_of_week = NEW.day_of_week
          AND occupation.start_time < NEW.end_time
          AND occupation.end_time > NEW.start_time;

        IF conflict_count > 0 THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'Chevauchement horaire détecté pour cet enseignant.';
        END IF;
    END IF;

    -- Conflit salle (si renseignée).
    IF NEW.room_id IS NOT NULL THEN
        SELECT count(*) INTO conflict_count
        FROM v_schedule_occupations AS occupation
        WHERE occupation.room_id = NEW.room_id
          AND occupation.source_id <> NEW.id
          AND occupation.day_of_week = NEW.day_of_week
          AND occupation.start_time < NEW.end_time
          AND occupation.end_time > NEW.start_time;

        IF conflict_count > 0 THEN
            RAISE EXCEPTION USING
                ERRCODE = '23514',
                MESSAGE = 'Chevauchement horaire détecté pour cette salle.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION check_timetable_slot_conflicts() IS 'Empêche tout chevauchement horaire (élèves de la classe, enseignant, salle) lors de l ajout ou modification d un créneau régulier.';

-- =========================================================
-- TRIGGERS
-- =========================================================
CREATE CONSTRAINT TRIGGER trg_special_courses_check_conflicts
AFTER INSERT OR UPDATE OF student_enrollment_id, teacher_id, room_id, day_of_week, start_time, end_time
ON special_courses
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_special_course_conflicts();

CREATE CONSTRAINT TRIGGER trg_timetable_slots_check_conflicts
AFTER INSERT OR UPDATE OF teacher_assignment_id, room_id, day_of_week, start_time, end_time
ON timetable_slots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_timetable_slot_conflicts();

-- =========================================================
-- VUE : PLANNING HEBDOMADAIRE PAR CLASSE
-- =========================================================
CREATE VIEW v_class_weekly_timetable AS
SELECT
    class_subject.class_id AS class_id,
    slot.id AS timetable_slot_id,
    subject.name AS subject_name,
    teacher.id AS teacher_id,
    room.name AS room_name,
    slot.day_of_week AS day_of_week,
    slot.start_time AS start_time,
    slot.end_time AS end_time
FROM timetable_slots AS slot
JOIN teacher_assignments AS assignment
    ON assignment.id = slot.teacher_assignment_id
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
JOIN teachers AS teacher
    ON teacher.id = assignment.teacher_id
LEFT JOIN rooms AS room
    ON room.id = slot.room_id;

COMMENT ON VIEW v_class_weekly_timetable IS 'Planning hebdomadaire consolidé par classe (cours réguliers uniquement).';

-- =========================================================
-- VUE : PLANNING HEBDOMADAIRE PAR ENSEIGNANT (régulier + particulier)
-- =========================================================
CREATE VIEW v_teacher_weekly_timetable AS
SELECT
    'TIMETABLE_SLOT'::text AS occupation_type,
    assignment.teacher_id AS teacher_id,
    subject.name AS subject_name,
    room.name AS room_name,
    slot.day_of_week AS day_of_week,
    slot.start_time AS start_time,
    slot.end_time AS end_time
FROM timetable_slots AS slot
JOIN teacher_assignments AS assignment
    ON assignment.id = slot.teacher_assignment_id
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
LEFT JOIN rooms AS room
    ON room.id = slot.room_id

UNION ALL

SELECT
    'SPECIAL_COURSE'::text AS occupation_type,
    special_course.teacher_id AS teacher_id,
    subject.name AS subject_name,
    room.name AS room_name,
    special_course.day_of_week AS day_of_week,
    special_course.start_time AS start_time,
    special_course.end_time AS end_time
FROM special_courses AS special_course
JOIN subjects AS subject
    ON subject.id = special_course.subject_id
LEFT JOIN rooms AS room
    ON room.id = special_course.room_id
WHERE special_course.teacher_id IS NOT NULL;

COMMENT ON VIEW v_teacher_weekly_timetable IS 'Planning hebdomadaire consolidé par enseignant, cours réguliers et particuliers confondus.';

-- =========================================================
-- DROITS D'ACCÈS : blaise_app
-- =========================================================
GRANT SELECT ON TABLE rooms TO blaise_app;
GRANT INSERT (name, capacity) ON rooms TO blaise_app;
GRANT UPDATE (name, capacity) ON rooms TO blaise_app;
REVOKE DELETE ON TABLE rooms FROM blaise_app;

GRANT SELECT ON TABLE timetable_slots TO blaise_app;
GRANT INSERT (teacher_assignment_id, room_id, day_of_week, start_time, end_time)
    ON timetable_slots TO blaise_app;
GRANT UPDATE (room_id, day_of_week, start_time, end_time)
    ON timetable_slots TO blaise_app;
GRANT DELETE ON TABLE timetable_slots TO blaise_app;

GRANT SELECT ON TABLE special_courses TO blaise_app;
GRANT INSERT (student_enrollment_id, subject_id, teacher_id, room_id, day_of_week, start_time, end_time, note)
    ON special_courses TO blaise_app;
GRANT UPDATE (teacher_id, room_id, day_of_week, start_time, end_time, note)
    ON special_courses TO blaise_app;
GRANT DELETE ON TABLE special_courses TO blaise_app;

GRANT SELECT ON v_schedule_occupations, v_class_weekly_timetable, v_teacher_weekly_timetable TO blaise_app;

COMMIT;