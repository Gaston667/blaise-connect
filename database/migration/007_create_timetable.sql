-- =========================================================
-- MIGRATION 007 : emploi du temps configurable et versionné
-- =========================================================
-- Cette migration crée la configuration horaire, les besoins hebdomadaires,
-- les propositions versionnées, les créneaux et les cours particuliers.
-- Elle prépare l'algorithme : celui-ci produit toujours un brouillon que
-- l'administrateur doit valider avant publication.
-- =========================================================

BEGIN;

CREATE TYPE timetable_status_enum AS ENUM (
    'DRAFT',
    'VALIDATED',
    'ARCHIVED'
);

-- Salles utilisables par les cours.
CREATE TABLE rooms (
    id uuid CONSTRAINT pk_rooms PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(100) NOT NULL,
    capacity smallint,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_rooms_name UNIQUE (name),
    CONSTRAINT ck_rooms_name CHECK (name = btrim(name) AND name <> ''),
    CONSTRAINT ck_rooms_capacity CHECK (capacity IS NULL OR capacity > 0)
);

CREATE TRIGGER trg_rooms_set_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Horaires d'ouverture par année, cycle et jour.
CREATE TABLE school_day_schedules (
    id uuid CONSTRAINT pk_school_day_schedules PRIMARY KEY DEFAULT gen_random_uuid(),
    school_year_id uuid NOT NULL,
    education_stage education_stage_enum NOT NULL,
    day_of_week smallint NOT NULL,
    course_start_time time NOT NULL,
    course_end_time time NOT NULL,
    lesson_duration_minutes smallint NOT NULL DEFAULT 60,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_school_day_schedules_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT,
    CONSTRAINT uq_school_day_schedules_year_stage_day
        UNIQUE (school_year_id, education_stage, day_of_week),
    CONSTRAINT ck_school_day_schedules_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_school_day_schedules_times CHECK (course_start_time < course_end_time),
    CONSTRAINT ck_school_day_schedules_duration
        CHECK (lesson_duration_minutes BETWEEN 15 AND 240)
);

CREATE INDEX idx_school_day_schedules_school_year_id
    ON school_day_schedules (school_year_id);

CREATE TRIGGER trg_school_day_schedules_set_updated_at
BEFORE UPDATE ON school_day_schedules
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Pauses appartenant à une journée configurée.
CREATE TABLE break_schedules (
    id uuid CONSTRAINT pk_break_schedules PRIMARY KEY DEFAULT gen_random_uuid(),
    school_day_schedule_id uuid NOT NULL,
    label varchar(100) NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_break_schedules_school_day_schedule
        FOREIGN KEY (school_day_schedule_id)
        REFERENCES school_day_schedules(id)
        ON DELETE CASCADE,
    CONSTRAINT ck_break_schedules_label CHECK (label = btrim(label) AND label <> ''),
    CONSTRAINT ck_break_schedules_times CHECK (start_time < end_time),
    CONSTRAINT ex_break_schedules_no_overlap
        EXCLUDE USING gist (
            school_day_schedule_id WITH =,
            timerange(start_time, end_time, '[)') WITH &&
        )
);

CREATE INDEX idx_break_schedules_school_day_schedule_id
    ON break_schedules (school_day_schedule_id);

CREATE TRIGGER trg_break_schedules_set_updated_at
BEFORE UPDATE ON break_schedules
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Volume exigé pour une matière selon le niveau et l'année.
CREATE TABLE level_subject_requirements (
    id uuid CONSTRAINT pk_level_subject_requirements PRIMARY KEY DEFAULT gen_random_uuid(),
    school_year_id uuid NOT NULL,
    class_level_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    weekly_minutes smallint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_level_subject_requirements_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_years(id) ON DELETE RESTRICT,
    CONSTRAINT fk_level_subject_requirements_class_level
        FOREIGN KEY (class_level_id) REFERENCES class_levels(id) ON DELETE RESTRICT,
    CONSTRAINT fk_level_subject_requirements_subject
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
    CONSTRAINT uq_level_subject_requirements_year_level_subject
        UNIQUE (school_year_id, class_level_id, subject_id),
    CONSTRAINT ck_level_subject_requirements_weekly_minutes
        CHECK (weekly_minutes BETWEEN 15 AND 2400)
);

CREATE INDEX idx_level_subject_requirements_school_year_id
    ON level_subject_requirements (school_year_id);
CREATE INDEX idx_level_subject_requirements_class_level_id
    ON level_subject_requirements (class_level_id);
CREATE INDEX idx_level_subject_requirements_subject_id
    ON level_subject_requirements (subject_id);

CREATE TRIGGER trg_level_subject_requirements_set_updated_at
BEFORE UPDATE ON level_subject_requirements
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Une classe peut avoir plusieurs versions, mais un seul brouillon et une
-- seule version validée à la fois.
CREATE TABLE timetables (
    id uuid CONSTRAINT pk_timetables PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id uuid NOT NULL,
    version smallint NOT NULL,
    status timetable_status_enum NOT NULL DEFAULT 'DRAFT',
    generated_by_account_id uuid NOT NULL,
    validated_by_account_id uuid,
    validated_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_timetables_class
        FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT,
    CONSTRAINT fk_timetables_generated_by
        FOREIGN KEY (generated_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_timetables_validated_by
        FOREIGN KEY (validated_by_account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
    CONSTRAINT uq_timetables_class_version UNIQUE (class_id, version),
    CONSTRAINT ck_timetables_version CHECK (version > 0),
    CONSTRAINT ck_timetables_validation CHECK (
        (status = 'VALIDATED' AND validated_by_account_id IS NOT NULL AND validated_at IS NOT NULL)
        OR
        (status <> 'VALIDATED' AND validated_by_account_id IS NULL AND validated_at IS NULL)
    )
);

CREATE UNIQUE INDEX uq_timetables_one_draft_per_class
    ON timetables (class_id) WHERE status = 'DRAFT';
CREATE UNIQUE INDEX uq_timetables_one_validated_per_class
    ON timetables (class_id) WHERE status = 'VALIDATED';
CREATE INDEX idx_timetables_generated_by_account_id
    ON timetables (generated_by_account_id);
CREATE INDEX idx_timetables_validated_by_account_id
    ON timetables (validated_by_account_id)
    WHERE validated_by_account_id IS NOT NULL;

CREATE TRIGGER trg_timetables_set_updated_at
BEFORE UPDATE ON timetables
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Créneaux d'une version de planning.
CREATE TABLE timetable_slots (
    id uuid CONSTRAINT pk_timetable_slots PRIMARY KEY DEFAULT gen_random_uuid(),
    timetable_id uuid NOT NULL,
    teacher_assignment_id uuid NOT NULL,
    room_id uuid,
    day_of_week smallint NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_timetable_slots_timetable
        FOREIGN KEY (timetable_id) REFERENCES timetables(id) ON DELETE CASCADE,
    CONSTRAINT fk_timetable_slots_teacher_assignment
        FOREIGN KEY (teacher_assignment_id)
        REFERENCES teacher_assignments(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_timetable_slots_room
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
    CONSTRAINT ck_timetable_slots_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_timetable_slots_times CHECK (start_time < end_time)
);

CREATE INDEX idx_timetable_slots_timetable_id ON timetable_slots (timetable_id);
CREATE INDEX idx_timetable_slots_teacher_assignment_id
    ON timetable_slots (teacher_assignment_id);
CREATE INDEX idx_timetable_slots_room_id
    ON timetable_slots (room_id) WHERE room_id IS NOT NULL;
CREATE INDEX idx_timetable_slots_day_time
    ON timetable_slots (day_of_week, start_time, end_time);

CREATE TRIGGER trg_timetable_slots_set_updated_at
BEFORE UPDATE ON timetable_slots
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Cours individuel supplémentaire. Il reste distinct du planning collectif.
CREATE TABLE special_courses (
    id uuid CONSTRAINT pk_special_courses PRIMARY KEY DEFAULT gen_random_uuid(),
    student_enrollment_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    teacher_id uuid,
    room_id uuid,
    title varchar(150) NOT NULL,
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
        FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE RESTRICT,
    CONSTRAINT fk_special_courses_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_special_courses_room
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT,
    CONSTRAINT ck_special_courses_title CHECK (title = btrim(title) AND title <> ''),
    CONSTRAINT ck_special_courses_day CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT ck_special_courses_times CHECK (start_time < end_time),
    CONSTRAINT ck_special_courses_note
        CHECK (note IS NULL OR (note = btrim(note) AND note <> ''))
);

CREATE INDEX idx_special_courses_student_enrollment_id
    ON special_courses (student_enrollment_id);
CREATE INDEX idx_special_courses_subject_id ON special_courses (subject_id);
CREATE INDEX idx_special_courses_teacher_id
    ON special_courses (teacher_id) WHERE teacher_id IS NOT NULL;
CREATE INDEX idx_special_courses_room_id
    ON special_courses (room_id) WHERE room_id IS NOT NULL;

CREATE TRIGGER trg_special_courses_set_updated_at
BEFORE UPDATE ON special_courses
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Une pause doit rester dans les horaires de sa journée.
CREATE OR REPLACE FUNCTION check_break_within_school_day()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    day_start time;
    day_end time;
BEGIN
    SELECT schedule.course_start_time, schedule.course_end_time
      INTO day_start, day_end
      FROM school_day_schedules AS schedule
     WHERE schedule.id = NEW.school_day_schedule_id;

    IF NEW.start_time < day_start OR NEW.end_time > day_end THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La pause doit rester dans les horaires de la journée.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_break_schedules_check_day_bounds
AFTER INSERT OR UPDATE ON break_schedules
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_break_within_school_day();

-- Vérifie le rattachement du créneau, ses bornes et les pauses configurées.
CREATE OR REPLACE FUNCTION check_timetable_slot_context()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    timetable_class_id uuid;
    assignment_class_id uuid;
    timetable_status timetable_status_enum;
    year_id uuid;
    stage education_stage_enum;
    day_start time;
    day_end time;
BEGIN
    SELECT timetable.class_id, timetable.status,
           class.school_year_id, level.education_stage
      INTO timetable_class_id, timetable_status, year_id, stage
      FROM timetables AS timetable
      JOIN classes AS class ON class.id = timetable.class_id
      JOIN class_levels AS level ON level.id = class.class_level_id
     WHERE timetable.id = NEW.timetable_id;

    SELECT class_subject.class_id
      INTO assignment_class_id
      FROM teacher_assignments AS assignment
      JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
     WHERE assignment.id = NEW.teacher_assignment_id;

    IF timetable_status = 'ARCHIVED' THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Un emploi du temps archivé est immuable.';
    END IF;
    IF assignment_class_id IS DISTINCT FROM timetable_class_id THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'L''affectation doit appartenir à la classe de l''emploi du temps.';
    END IF;

    SELECT schedule.course_start_time, schedule.course_end_time
      INTO day_start, day_end
      FROM school_day_schedules AS schedule
     WHERE schedule.school_year_id = year_id
       AND schedule.education_stage = stage
       AND schedule.day_of_week = NEW.day_of_week;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Les horaires de ce jour ne sont pas configurés pour le cycle.';
    END IF;
    IF NEW.start_time < day_start OR NEW.end_time > day_end THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Le créneau doit rester dans les horaires configurés.';
    END IF;
    IF EXISTS (
        SELECT 1
          FROM break_schedules AS break
          JOIN school_day_schedules AS schedule
            ON schedule.id = break.school_day_schedule_id
         WHERE schedule.school_year_id = year_id
           AND schedule.education_stage = stage
           AND schedule.day_of_week = NEW.day_of_week
           AND break.start_time < NEW.end_time
           AND break.end_time > NEW.start_time
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Le créneau chevauche une pause configurée.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_timetable_slots_check_context
AFTER INSERT OR UPDATE ON timetable_slots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_timetable_slot_context();

-- Conflits internes au brouillon et conflits avec les plannings publiés.
CREATE OR REPLACE FUNCTION check_timetable_slot_conflicts()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    current_class_id uuid;
    current_teacher_id uuid;
BEGIN
    SELECT timetable.class_id, assignment.teacher_id
      INTO current_class_id, current_teacher_id
      FROM timetables AS timetable
      JOIN teacher_assignments AS assignment
        ON assignment.id = NEW.teacher_assignment_id
     WHERE timetable.id = NEW.timetable_id;

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS other_slot
          JOIN timetables AS other_timetable
            ON other_timetable.id = other_slot.timetable_id
          JOIN teacher_assignments AS other_assignment
            ON other_assignment.id = other_slot.teacher_assignment_id
         WHERE other_slot.id <> NEW.id
           AND other_slot.day_of_week = NEW.day_of_week
           AND other_slot.start_time < NEW.end_time
           AND other_slot.end_time > NEW.start_time
           AND (
               other_slot.timetable_id = NEW.timetable_id
               OR (
                   other_timetable.status = 'VALIDATED'
                   AND other_timetable.class_id <> current_class_id
                   AND (
                       other_assignment.teacher_id = current_teacher_id
                       OR (
                           NEW.room_id IS NOT NULL
                           AND other_slot.room_id = NEW.room_id
                       )
                   )
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Conflit de classe, d''enseignant ou de salle détecté.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_timetable_slots_check_conflicts
AFTER INSERT OR UPDATE ON timetable_slots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_timetable_slot_conflicts();

-- Une validation est sérialisée et refuse tout conflit avec un planning publié.
CREATE OR REPLACE FUNCTION check_timetable_validation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status <> 'VALIDATED' OR OLD.status = 'VALIDATED' THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('blaiseconnect:timetable-validation'));

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS candidate
          JOIN teacher_assignments AS candidate_assignment
            ON candidate_assignment.id = candidate.teacher_assignment_id
          JOIN timetable_slots AS published
            ON published.day_of_week = candidate.day_of_week
           AND published.start_time < candidate.end_time
           AND published.end_time > candidate.start_time
          JOIN timetables AS published_timetable
            ON published_timetable.id = published.timetable_id
          JOIN teacher_assignments AS published_assignment
            ON published_assignment.id = published.teacher_assignment_id
         WHERE candidate.timetable_id = NEW.id
           AND published_timetable.status = 'VALIDATED'
           AND published_timetable.class_id <> NEW.class_id
           AND (
               candidate_assignment.teacher_id = published_assignment.teacher_id
               OR (
                   candidate.room_id IS NOT NULL
                   AND candidate.room_id = published.room_id
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Le planning ne peut pas être validé : un enseignant ou une salle est déjà occupé.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_timetables_check_validation
BEFORE UPDATE OF status ON timetables
FOR EACH ROW EXECUTE FUNCTION check_timetable_validation();

-- Vue contractuelle : version validée, ou dernier brouillon pour l'admin.
CREATE VIEW v_timetable_slots_detailed AS
SELECT
    timetable.id AS timetable_id,
    timetable.class_id,
    timetable.version,
    timetable.status,
    slot.id AS slot_id,
    slot.day_of_week,
    slot.start_time,
    slot.end_time,
    class_subject.id AS class_subject_id,
    subject.name AS subject_name,
    assignment.teacher_id,
    teacher.first_name || ' ' || teacher.last_name AS teacher_name,
    slot.room_id,
    room.name AS room_name
FROM timetables AS timetable
JOIN timetable_slots AS slot ON slot.timetable_id = timetable.id
JOIN teacher_assignments AS assignment
    ON assignment.id = slot.teacher_assignment_id
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN subjects AS subject ON subject.id = class_subject.subject_id
JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
LEFT JOIN rooms AS room ON room.id = slot.room_id;

-- Moindre privilège : l'application manipule uniquement les colonnes utiles.
GRANT SELECT ON TABLE rooms, school_day_schedules, break_schedules,
    level_subject_requirements, timetables, timetable_slots, special_courses
TO blaise_app;

GRANT INSERT (name, capacity) ON rooms TO blaise_app;
GRANT UPDATE (name, capacity, is_active) ON rooms TO blaise_app;

GRANT INSERT (school_year_id, education_stage, day_of_week,
    course_start_time, course_end_time, lesson_duration_minutes)
ON school_day_schedules TO blaise_app;
GRANT UPDATE (course_start_time, course_end_time, lesson_duration_minutes)
ON school_day_schedules TO blaise_app;

GRANT INSERT (school_day_schedule_id, label, start_time, end_time)
ON break_schedules TO blaise_app;
GRANT UPDATE (label, start_time, end_time) ON break_schedules TO blaise_app;
GRANT DELETE ON TABLE break_schedules TO blaise_app;

GRANT INSERT (school_year_id, class_level_id, subject_id, weekly_minutes)
ON level_subject_requirements TO blaise_app;
GRANT UPDATE (weekly_minutes) ON level_subject_requirements TO blaise_app;

GRANT INSERT (class_id, version, status, generated_by_account_id)
ON timetables TO blaise_app;
GRANT UPDATE (status, validated_by_account_id, validated_at)
ON timetables TO blaise_app;

GRANT INSERT (timetable_id, teacher_assignment_id, room_id,
    day_of_week, start_time, end_time)
ON timetable_slots TO blaise_app;
GRANT UPDATE (teacher_assignment_id, room_id, day_of_week, start_time, end_time)
ON timetable_slots TO blaise_app;
GRANT DELETE ON TABLE timetable_slots TO blaise_app;

GRANT INSERT (student_enrollment_id, subject_id, teacher_id, room_id,
    title, day_of_week, start_time, end_time, note)
ON special_courses TO blaise_app;
GRANT UPDATE (teacher_id, room_id, title, day_of_week, start_time, end_time, note)
ON special_courses TO blaise_app;
GRANT DELETE ON TABLE special_courses TO blaise_app;

GRANT SELECT ON v_timetable_slots_detailed TO blaise_app;

COMMIT;
