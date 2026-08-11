-- =========================================================
-- MIGRATION 007 : EMPLOI DU TEMPS
-- =========================================================
-- Objectifs :
--   - configuration horaire flexible par profils de niveaux ;
--   - collège + lycée peuvent partager le même profil horaire ;
--   - volumes hebdomadaires par niveau et matière ;
--   - création manuelle ou génération automatique ;
--   - versionnement DRAFT / PUBLISHED / ARCHIVED ;
--   - conservation de l'historique lors d'une modification ;
--   - gestion des salles et indisponibilités enseignants ;
--   - cours spéciaux / particuliers affichables dans le même planning ;
--   - contrôles de conflits classe / enseignant / salle / pauses.
--
-- Dépend de :
--   002_accounts_and_profiles.sql  -> accounts, teachers, set_updated_at()
--   004_school_structure.sql       -> school_years, class_levels, classes,
--                                     subjects, student_enrollments,
--                                     class_subjects
--   005_academic_activity.sql      -> teacher_assignments
-- =========================================================

BEGIN;

-- =========================================================
-- 1. TYPES
-- =========================================================

CREATE TYPE timetable_status_enum AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
);

CREATE TYPE special_course_status_enum AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
);

CREATE TYPE timetable_creation_mode_enum AS ENUM (
    'MANUAL',
    'AUTOMATIC'
);

CREATE TYPE timetable_generation_status_enum AS ENUM (
    'PENDING',
    'RUNNING',
    'COMPLETED',
    'FAILED'
);


-- =========================================================
-- 2. SALLES
-- =========================================================

CREATE TABLE rooms (
    id uuid
        CONSTRAINT pk_rooms PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name varchar(100) NOT NULL,
    capacity smallint,
    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ck_rooms_name
        CHECK (
            name = btrim(name)
            AND name <> ''
        ),

    CONSTRAINT ck_rooms_capacity
        CHECK (
            capacity IS NULL
            OR capacity > 0
        )
);

CREATE UNIQUE INDEX uq_rooms_name_ci
    ON rooms (lower(name));

CREATE TRIGGER trg_rooms_set_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 3. PROFILS HORAIRES
-- =========================================================
-- Un profil horaire appartient à une année scolaire.
--
-- Exemple V1 :
--   Secondaire -> 6e à Terminale
--   Primaire   -> CP à CM2
--   Maternelle -> PS à GS
--
-- Le modèle reste flexible : collège et lycée pourront être séparés
-- ultérieurement sans modifier le schéma.

CREATE TABLE schedule_profiles (
    id uuid
        CONSTRAINT pk_schedule_profiles PRIMARY KEY
        DEFAULT gen_random_uuid(),

    school_year_id uuid NOT NULL,
    name varchar(100) NOT NULL,
    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_schedule_profiles_school_year
        FOREIGN KEY (school_year_id)
        REFERENCES school_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_schedule_profiles_name
        CHECK (
            name = btrim(name)
            AND name <> ''
        )
);

CREATE UNIQUE INDEX uq_schedule_profiles_year_name_ci
    ON schedule_profiles (school_year_id, lower(name));

CREATE INDEX idx_schedule_profiles_school_year_id
    ON schedule_profiles (school_year_id);

CREATE TRIGGER trg_schedule_profiles_set_updated_at
BEFORE UPDATE ON schedule_profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 4. NIVEAUX RATTACHES AUX PROFILS HORAIRES
-- =========================================================

CREATE TABLE schedule_profile_levels (
    schedule_profile_id uuid NOT NULL,
    class_level_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_schedule_profile_levels
        PRIMARY KEY (
            schedule_profile_id,
            class_level_id
        ),

    CONSTRAINT fk_schedule_profile_levels_profile
        FOREIGN KEY (schedule_profile_id)
        REFERENCES schedule_profiles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_schedule_profile_levels_class_level
        FOREIGN KEY (class_level_id)
        REFERENCES class_levels(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_schedule_profile_levels_class_level_id
    ON schedule_profile_levels (class_level_id);

-- Un même niveau ne peut appartenir qu'à un seul profil
-- pour une même année scolaire.
CREATE OR REPLACE FUNCTION check_schedule_profile_level_unique_year()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_school_year_id uuid;
BEGIN
    SELECT profile.school_year_id
      INTO target_school_year_id
      FROM schedule_profiles AS profile
     WHERE profile.id = NEW.schedule_profile_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'Le profil horaire est introuvable.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM schedule_profile_levels AS existing_link
          JOIN schedule_profiles AS existing_profile
            ON existing_profile.id = existing_link.schedule_profile_id
         WHERE existing_link.class_level_id = NEW.class_level_id
           AND existing_profile.school_year_id = target_school_year_id
           AND existing_link.schedule_profile_id <> NEW.schedule_profile_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Ce niveau possède déjà un profil horaire pour cette année scolaire.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_schedule_profile_levels_unique_year
AFTER INSERT OR UPDATE ON schedule_profile_levels
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_schedule_profile_level_unique_year();


-- =========================================================
-- 5. HORAIRES PAR JOUR
-- =========================================================

CREATE TABLE school_day_schedules (
    id uuid
        CONSTRAINT pk_school_day_schedules PRIMARY KEY
        DEFAULT gen_random_uuid(),

    schedule_profile_id uuid NOT NULL,
    day_of_week smallint NOT NULL,

    course_start_time time NOT NULL,
    course_end_time time NOT NULL,

    lesson_duration_minutes smallint NOT NULL DEFAULT 60,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_school_day_schedules_profile
        FOREIGN KEY (schedule_profile_id)
        REFERENCES schedule_profiles(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_school_day_schedules_profile_day
        UNIQUE (
            schedule_profile_id,
            day_of_week
        ),

    CONSTRAINT ck_school_day_schedules_day
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT ck_school_day_schedules_times
        CHECK (course_start_time < course_end_time),

    CONSTRAINT ck_school_day_schedules_duration
        CHECK (lesson_duration_minutes BETWEEN 15 AND 240)
);

CREATE INDEX idx_school_day_schedules_profile_id
    ON school_day_schedules (schedule_profile_id);

CREATE TRIGGER trg_school_day_schedules_set_updated_at
BEFORE UPDATE ON school_day_schedules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 6. PAUSES
-- =========================================================

CREATE TABLE break_schedules (
    id uuid
        CONSTRAINT pk_break_schedules PRIMARY KEY
        DEFAULT gen_random_uuid(),

    school_day_schedule_id uuid NOT NULL,

    label varchar(100) NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_break_schedules_school_day
        FOREIGN KEY (school_day_schedule_id)
        REFERENCES school_day_schedules(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_break_schedules_label
        CHECK (
            label = btrim(label)
            AND label <> ''
        ),

    CONSTRAINT ck_break_schedules_times
        CHECK (start_time < end_time)
);

CREATE INDEX idx_break_schedules_school_day_schedule_id
    ON break_schedules (school_day_schedule_id);

CREATE TRIGGER trg_break_schedules_set_updated_at
BEFORE UPDATE ON break_schedules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 7. VOLUME HEBDOMADAIRE PAR NIVEAU ET MATIERE
-- =========================================================
-- Le volume n'est PAS stocké directement dans subjects :
-- il dépend du niveau et de l'année scolaire.
--
-- Exemple :
--   6e / Mathématiques / 300 minutes
--   Terminale / Mathématiques / 360 minutes

CREATE TABLE level_subject_requirements (
    id uuid
        CONSTRAINT pk_level_subject_requirements PRIMARY KEY
        DEFAULT gen_random_uuid(),

    school_year_id uuid NOT NULL,
    class_level_id uuid NOT NULL,
    subject_id uuid NOT NULL,

    weekly_minutes smallint NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_level_subject_requirements_school_year
        FOREIGN KEY (school_year_id)
        REFERENCES school_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_level_subject_requirements_class_level
        FOREIGN KEY (class_level_id)
        REFERENCES class_levels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_level_subject_requirements_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_level_subject_requirements
        UNIQUE (
            school_year_id,
            class_level_id,
            subject_id
        ),

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
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 8. INDISPONIBILITES RECURRENTES DES ENSEIGNANTS
-- =========================================================
-- Exemple :
--   enseignant X indisponible tous les mercredis 14h-17h
--   pour l'année 2026-2027.

CREATE TABLE teacher_unavailabilities (
    id uuid
        CONSTRAINT pk_teacher_unavailabilities PRIMARY KEY
        DEFAULT gen_random_uuid(),

    school_year_id uuid NOT NULL,
    teacher_id uuid NOT NULL,

    day_of_week smallint NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,

    reason varchar(255),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_teacher_unavailabilities_school_year
        FOREIGN KEY (school_year_id)
        REFERENCES school_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_teacher_unavailabilities_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_teacher_unavailabilities_day
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT ck_teacher_unavailabilities_times
        CHECK (start_time < end_time),

    CONSTRAINT ck_teacher_unavailabilities_reason
        CHECK (
            reason IS NULL
            OR (
                reason = btrim(reason)
                AND reason <> ''
            )
        )
);

CREATE INDEX idx_teacher_unavailabilities_teacher_year
    ON teacher_unavailabilities (
        teacher_id,
        school_year_id
    );

CREATE INDEX idx_teacher_unavailabilities_day_time
    ON teacher_unavailabilities (
        day_of_week,
        start_time,
        end_time
    );

CREATE TRIGGER trg_teacher_unavailabilities_set_updated_at
BEFORE UPDATE ON teacher_unavailabilities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 9. GENERATIONS AUTOMATIQUES
-- =========================================================
-- Une génération peut produire plusieurs brouillons,
-- un par classe.

CREATE TABLE timetable_generation_runs (
    id uuid
        CONSTRAINT pk_timetable_generation_runs PRIMARY KEY
        DEFAULT gen_random_uuid(),

    school_year_id uuid NOT NULL,
    requested_by_account_id uuid NOT NULL,

    status timetable_generation_status_enum NOT NULL DEFAULT 'PENDING',

    -- Période que l'administrateur souhaite générer.
    target_start_date date NOT NULL,
    target_end_date date NOT NULL,

    -- Snapshot libre des options futures de l'algorithme.
    parameters jsonb NOT NULL DEFAULT '{}'::jsonb,

    started_at timestamptz,
    completed_at timestamptz,
    error_message text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_timetable_generation_runs_school_year
        FOREIGN KEY (school_year_id)
        REFERENCES school_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_timetable_generation_runs_requested_by
        FOREIGN KEY (requested_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_timetable_generation_runs_period
        CHECK (target_end_date >= target_start_date),

    CONSTRAINT ck_timetable_generation_runs_parameters
        CHECK (jsonb_typeof(parameters) = 'object'),

    CONSTRAINT ck_timetable_generation_runs_state
        CHECK (
            (
                status = 'PENDING'
                AND started_at IS NULL
                AND completed_at IS NULL
                AND error_message IS NULL
            )
            OR
            (
                status = 'RUNNING'
                AND started_at IS NOT NULL
                AND completed_at IS NULL
                AND error_message IS NULL
            )
            OR
            (
                status = 'COMPLETED'
                AND started_at IS NOT NULL
                AND completed_at IS NOT NULL
                AND error_message IS NULL
            )
            OR
            (
                status = 'FAILED'
                AND started_at IS NOT NULL
                AND completed_at IS NOT NULL
                AND error_message IS NOT NULL
                AND btrim(error_message) <> ''
            )
        )
);

CREATE INDEX idx_timetable_generation_runs_school_year_id
    ON timetable_generation_runs (school_year_id);

CREATE INDEX idx_timetable_generation_runs_requested_by
    ON timetable_generation_runs (requested_by_account_id);

CREATE INDEX idx_timetable_generation_runs_status
    ON timetable_generation_runs (status);

CREATE TRIGGER trg_timetable_generation_runs_set_updated_at
BEFORE UPDATE ON timetable_generation_runs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 10. EMPLOIS DU TEMPS VERSIONNES
-- =========================================================
-- DRAFT :
--   version en préparation, modifiable.
--
-- PUBLISHED :
--   version actuellement utilisée et visible.
--
-- ARCHIVED :
--   ancienne version publiée, conservée dans l'historique.
--
-- Une modification d'un planning publié doit créer une nouvelle
-- version DRAFT. L'ancienne version reste PUBLISHED jusqu'à la
-- publication de la nouvelle.

CREATE TABLE timetables (
    id uuid
        CONSTRAINT pk_timetables PRIMARY KEY
        DEFAULT gen_random_uuid(),

    class_id uuid NOT NULL,
    version smallint NOT NULL,

    -- Période de validité du planning hebdomadaire.
    effective_start_date date NOT NULL,
    effective_end_date date NOT NULL,

    status timetable_status_enum NOT NULL DEFAULT 'DRAFT',
    creation_mode timetable_creation_mode_enum NOT NULL,

    created_by_account_id uuid NOT NULL,

    generation_run_id uuid,

    published_by_account_id uuid,
    published_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_timetables_class
        FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_timetables_created_by
        FOREIGN KEY (created_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_timetables_generation_run
        FOREIGN KEY (generation_run_id)
        REFERENCES timetable_generation_runs(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_timetables_published_by
        FOREIGN KEY (published_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_timetables_class_version
        UNIQUE (
            class_id,
            version
        ),

    CONSTRAINT ck_timetables_version
        CHECK (version > 0),

    CONSTRAINT ck_timetables_period
        CHECK (effective_end_date >= effective_start_date),

    CONSTRAINT ck_timetables_creation_mode
        CHECK (
            (
                creation_mode = 'MANUAL'
                AND generation_run_id IS NULL
            )
            OR
            (
                creation_mode = 'AUTOMATIC'
                AND generation_run_id IS NOT NULL
            )
        ),

    CONSTRAINT ck_timetables_publication
        CHECK (
            (
                status = 'DRAFT'
                AND published_by_account_id IS NULL
                AND published_at IS NULL
            )
            OR
            (
                status IN ('PUBLISHED', 'ARCHIVED')
                AND published_by_account_id IS NOT NULL
                AND published_at IS NOT NULL
            )
        )
);

CREATE UNIQUE INDEX uq_timetables_one_draft_per_class
    ON timetables (class_id)
    WHERE status = 'DRAFT';

CREATE UNIQUE INDEX uq_timetables_one_published_per_class
    ON timetables (class_id)
    WHERE status = 'PUBLISHED';

CREATE INDEX idx_timetables_created_by_account_id
    ON timetables (created_by_account_id);

CREATE INDEX idx_timetables_generation_run_id
    ON timetables (generation_run_id)
    WHERE generation_run_id IS NOT NULL;

CREATE INDEX idx_timetables_published_by_account_id
    ON timetables (published_by_account_id)
    WHERE published_by_account_id IS NOT NULL;

CREATE TRIGGER trg_timetables_set_updated_at
BEFORE UPDATE ON timetables
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 11. CRENEAUX DES EMPLOIS DU TEMPS
-- =========================================================

CREATE TABLE timetable_slots (
    id uuid
        CONSTRAINT pk_timetable_slots PRIMARY KEY
        DEFAULT gen_random_uuid(),

    timetable_id uuid NOT NULL,
    teacher_assignment_id uuid NOT NULL,
    room_id uuid,

    day_of_week smallint NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_timetable_slots_timetable
        FOREIGN KEY (timetable_id)
        REFERENCES timetables(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_timetable_slots_teacher_assignment
        FOREIGN KEY (teacher_assignment_id)
        REFERENCES teacher_assignments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_timetable_slots_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_timetable_slots_day
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT ck_timetable_slots_times
        CHECK (start_time < end_time)
);

CREATE INDEX idx_timetable_slots_timetable_id
    ON timetable_slots (timetable_id);

CREATE INDEX idx_timetable_slots_teacher_assignment_id
    ON timetable_slots (teacher_assignment_id);

CREATE INDEX idx_timetable_slots_room_id
    ON timetable_slots (room_id)
    WHERE room_id IS NOT NULL;

CREATE INDEX idx_timetable_slots_day_time
    ON timetable_slots (
        day_of_week,
        start_time,
        end_time
    );

CREATE TRIGGER trg_timetable_slots_set_updated_at
BEFORE UPDATE ON timetable_slots
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 12. COURS SPECIAUX / PARTICULIERS
-- =========================================================
-- Deux usages avec la même table :
--
--   class_id renseigné :
--       cours spécial pour toute une classe.
--
--   student_enrollment_id renseigné :
--       cours particulier pour un seul élève.
--
-- Exactement une seule cible doit être renseignée.
--
-- valid_from / valid_until permettent :
--   - un cours hebdomadaire pendant une période ;
--   - un cours ponctuel en mettant la même date au début et à la fin.

CREATE TABLE special_courses (
    id uuid
        CONSTRAINT pk_special_courses PRIMARY KEY
        DEFAULT gen_random_uuid(),

    class_id uuid,
    student_enrollment_id uuid,

    subject_id uuid,
    teacher_id uuid,
    room_id uuid,

    title varchar(150) NOT NULL,

    day_of_week smallint NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL,

    valid_from date NOT NULL,
    valid_until date NOT NULL,

    note text,

    status special_course_status_enum NOT NULL DEFAULT 'DRAFT',

    created_by_account_id uuid NOT NULL,
    published_by_account_id uuid,
    published_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_special_courses_class
        FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_special_courses_student_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_special_courses_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_special_courses_teacher
        FOREIGN KEY (teacher_id)
        REFERENCES teachers(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_special_courses_room
        FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_special_courses_created_by
        FOREIGN KEY (created_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_special_courses_published_by
        FOREIGN KEY (published_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_special_courses_publication
        CHECK (
            (
                status = 'DRAFT'
                AND published_by_account_id IS NULL
                AND published_at IS NULL
            )
            OR
            (
                status IN ('PUBLISHED', 'ARCHIVED')
                AND published_by_account_id IS NOT NULL
                AND published_at IS NOT NULL
            )
        ),

    CONSTRAINT ck_special_courses_target
        CHECK (
            (class_id IS NOT NULL AND student_enrollment_id IS NULL)
            OR
            (class_id IS NULL AND student_enrollment_id IS NOT NULL)
        ),

    CONSTRAINT ck_special_courses_title
        CHECK (
            title = btrim(title)
            AND title <> ''
        ),

    CONSTRAINT ck_special_courses_day
        CHECK (day_of_week BETWEEN 1 AND 7),

    CONSTRAINT ck_special_courses_times
        CHECK (start_time < end_time),

    CONSTRAINT ck_special_courses_dates
        CHECK (valid_until >= valid_from),

    CONSTRAINT ck_special_courses_note
        CHECK (
            note IS NULL
            OR (
                note = btrim(note)
                AND note <> ''
            )
        )
);

CREATE INDEX idx_special_courses_class_id
    ON special_courses (class_id)
    WHERE class_id IS NOT NULL;

CREATE INDEX idx_special_courses_student_enrollment_id
    ON special_courses (student_enrollment_id)
    WHERE student_enrollment_id IS NOT NULL;

CREATE INDEX idx_special_courses_subject_id
    ON special_courses (subject_id)
    WHERE subject_id IS NOT NULL;

CREATE INDEX idx_special_courses_teacher_id
    ON special_courses (teacher_id)
    WHERE teacher_id IS NOT NULL;

CREATE INDEX idx_special_courses_room_id
    ON special_courses (room_id)
    WHERE room_id IS NOT NULL;

CREATE INDEX idx_special_courses_day_time
    ON special_courses (
        day_of_week,
        start_time,
        end_time
    );

CREATE INDEX idx_special_courses_status
    ON special_courses (status);

CREATE TRIGGER trg_special_courses_set_updated_at
BEFORE UPDATE ON special_courses
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 13. CONTROLES DES COMPTES ADMINISTRATEURS
-- =========================================================

CREATE OR REPLACE FUNCTION check_account_is_admin(account_id_to_check uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    account_role varchar(20);
BEGIN
    SELECT account.role
      INTO account_role
      FROM accounts AS account
     WHERE account.id = account_id_to_check;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'Le compte est introuvable.';
    END IF;

    IF account_role IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Cette opération nécessite un compte administrateur.';
    END IF;
END;
$$;


CREATE OR REPLACE FUNCTION check_timetable_admin_accounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM check_account_is_admin(NEW.created_by_account_id);

    IF NEW.published_by_account_id IS NOT NULL THEN
        PERFORM check_account_is_admin(NEW.published_by_account_id);
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_timetables_check_admin_accounts
AFTER INSERT OR UPDATE ON timetables
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_timetable_admin_accounts();


CREATE OR REPLACE FUNCTION check_generation_requested_by_admin()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM check_account_is_admin(NEW.requested_by_account_id);
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_timetable_generation_runs_check_admin
AFTER INSERT OR UPDATE ON timetable_generation_runs
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_generation_requested_by_admin();


CREATE OR REPLACE FUNCTION check_special_course_admin_accounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM check_account_is_admin(NEW.created_by_account_id);

    IF NEW.published_by_account_id IS NOT NULL THEN
        PERFORM check_account_is_admin(NEW.published_by_account_id);
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_special_courses_check_admin_accounts
AFTER INSERT OR UPDATE ON special_courses
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_special_course_admin_accounts();


-- =========================================================
-- 14. CONTROLE DES PAUSES
-- =========================================================

CREATE OR REPLACE FUNCTION check_break_within_school_day()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    day_start time;
    day_end time;
BEGIN
    SELECT schedule.course_start_time,
           schedule.course_end_time
      INTO day_start,
           day_end
      FROM school_day_schedules AS schedule
     WHERE schedule.id = NEW.school_day_schedule_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La journée scolaire configurée est introuvable.';
    END IF;

    IF NEW.start_time < day_start
       OR NEW.end_time > day_end
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La pause doit rester dans les horaires de la journée.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM break_schedules AS other_break
         WHERE other_break.school_day_schedule_id =
               NEW.school_day_schedule_id
           AND other_break.id IS DISTINCT FROM NEW.id
           AND other_break.start_time < NEW.end_time
           AND other_break.end_time > NEW.start_time
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23P01',
            MESSAGE = 'Deux pauses d''une même journée ne peuvent pas se chevaucher.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_break_schedules_check_day_bounds
AFTER INSERT OR UPDATE ON break_schedules
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_break_within_school_day();


-- =========================================================
-- 15. CONTROLE GENERATION AUTOMATIQUE ↔ ANNEE ↔ PERIODE
-- =========================================================

CREATE OR REPLACE FUNCTION check_timetable_generation_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    class_school_year_id uuid;
    class_year_start date;
    class_year_end date;

    run_school_year_id uuid;
    run_target_start date;
    run_target_end date;
BEGIN
    SELECT school_class.school_year_id,
           school_year.start_date,
           school_year.end_date
      INTO class_school_year_id,
           class_year_start,
           class_year_end
      FROM classes AS school_class
      JOIN school_years AS school_year
        ON school_year.id = school_class.school_year_id
     WHERE school_class.id = NEW.class_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La classe est introuvable.';
    END IF;

    IF NEW.effective_start_date < class_year_start
       OR NEW.effective_end_date > class_year_end
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La période de validité du planning doit rester dans l''année scolaire de la classe.';
    END IF;

    IF NEW.creation_mode = 'MANUAL' THEN
        RETURN NEW;
    END IF;

    SELECT run.school_year_id,
           run.target_start_date,
           run.target_end_date
      INTO run_school_year_id,
           run_target_start,
           run_target_end
      FROM timetable_generation_runs AS run
     WHERE run.id = NEW.generation_run_id;

    IF run_school_year_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La génération automatique est introuvable.';
    END IF;

    IF class_school_year_id IS DISTINCT FROM run_school_year_id THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La génération et la classe doivent appartenir à la même année scolaire.';
    END IF;

    IF NEW.effective_start_date IS DISTINCT FROM run_target_start
       OR NEW.effective_end_date IS DISTINCT FROM run_target_end
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Le planning automatique doit reprendre la période choisie pour la génération.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_timetables_check_generation_context
AFTER INSERT OR UPDATE ON timetables
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_timetable_generation_context();


-- =========================================================
-- 16. PROTECTION DE L'IDENTITE ET DES TRANSITIONS D'UN PLANNING
-- =========================================================

CREATE OR REPLACE FUNCTION protect_timetable_identity_and_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.class_id IS DISTINCT FROM OLD.class_id
       OR NEW.version IS DISTINCT FROM OLD.version
       OR NEW.effective_start_date IS DISTINCT FROM OLD.effective_start_date
       OR NEW.effective_end_date IS DISTINCT FROM OLD.effective_end_date
       OR NEW.creation_mode IS DISTINCT FROM OLD.creation_mode
       OR NEW.created_by_account_id IS DISTINCT FROM OLD.created_by_account_id
       OR NEW.generation_run_id IS DISTINCT FROM OLD.generation_run_id
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'L''identité et l''origine d''une version d''emploi du temps sont immuables.';
    END IF;

    -- Un brouillon peut rester brouillon ou devenir publié.
    IF OLD.status = 'DRAFT'
       AND NEW.status NOT IN ('DRAFT', 'PUBLISHED')
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Un brouillon peut uniquement être publié.';
    END IF;

    -- Une version publiée peut rester publiée ou être archivée.
    IF OLD.status = 'PUBLISHED'
       AND NEW.status NOT IN ('PUBLISHED', 'ARCHIVED')
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Un emploi du temps publié peut uniquement être archivé.';
    END IF;

    -- Une version archivée ne peut jamais redevenir active.
    IF OLD.status = 'ARCHIVED'
       AND NEW.status <> 'ARCHIVED'
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Un emploi du temps archivé ne peut pas être réactivé.';
    END IF;

    -- Après publication, l'auteur et la date de publication sont immuables.
    IF OLD.status IN ('PUBLISHED', 'ARCHIVED')
       AND (
           NEW.published_by_account_id
               IS DISTINCT FROM OLD.published_by_account_id
           OR NEW.published_at
               IS DISTINCT FROM OLD.published_at
       )
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Les informations de publication sont immuables.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_timetables_10_protect_identity_status
BEFORE UPDATE ON timetables
FOR EACH ROW
EXECUTE FUNCTION protect_timetable_identity_and_status();


-- =========================================================
-- 17. SEUL UN DRAFT PEUT MODIFIER SES CRENEAUX
-- =========================================================

CREATE OR REPLACE FUNCTION protect_timetable_slot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_timetable_id uuid;
    target_status timetable_status_enum;
BEGIN
    target_timetable_id :=
        CASE
            WHEN TG_OP = 'DELETE' THEN OLD.timetable_id
            ELSE NEW.timetable_id
        END;

    SELECT timetable.status
      INTO target_status
      FROM timetables AS timetable
     WHERE timetable.id = target_timetable_id;

    IF NOT FOUND THEN
        -- Le planning parent est déjà supprimé : ce créneau est retiré par la
        -- cascade de sa propre suppression, pas par une mutation isolée.
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'L''emploi du temps est introuvable.';
    END IF;

    IF target_status <> 'DRAFT' THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Seul un emploi du temps en brouillon peut être modifié.';
    END IF;

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$;

CREATE TRIGGER trg_timetable_slots_10_protect_mutation
BEFORE INSERT OR UPDATE OR DELETE ON timetable_slots
FOR EACH ROW
EXECUTE FUNCTION protect_timetable_slot_mutation();


-- =========================================================
-- 18. CONTEXTE D'UN CRENEAU REGULIER
-- =========================================================
-- Dans un DRAFT, on autorise temporairement les conflits de planning.
-- Cette fonction bloque seulement les incohérences métier fortes :
--   - planning introuvable ;
--   - affectation enseignant introuvable ;
--   - affectation qui n'appartient pas à la classe du planning.

CREATE OR REPLACE FUNCTION check_timetable_slot_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    timetable_class_id uuid;
    assignment_class_id uuid;
BEGIN
    SELECT timetable.class_id
      INTO timetable_class_id
      FROM timetables AS timetable
     WHERE timetable.id = NEW.timetable_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'L''emploi du temps est introuvable.';
    END IF;

    SELECT class_subject.class_id
      INTO assignment_class_id
      FROM teacher_assignments AS assignment
      JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
     WHERE assignment.id = NEW.teacher_assignment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'L''affectation de l''enseignant est introuvable.';
    END IF;

    IF assignment_class_id IS DISTINCT FROM timetable_class_id THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'L''affectation doit appartenir à la classe de l''emploi du temps.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_timetable_slots_check_context
AFTER INSERT OR UPDATE ON timetable_slots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_timetable_slot_context();


-- =========================================================
-- 19. CONFLITS DES CRENEAUX REGULIERS
-- =========================================================
-- Les conflits réguliers sont volontairement NON BLOQUANTS dans un DRAFT.
-- FastAPI doit les calculer avec un endpoint du type :
--   GET /timetables/{id}/conflicts
--
-- Les conflits bloquants sont revérifiés dans check_timetable_publish().


-- =========================================================
-- 20. CONTEXTE DES COURS SPECIAUX / PARTICULIERS
-- =========================================================
-- Un cours spécial peut être placé temporairement avec conflit pendant
-- la préparation. Cette fonction bloque seulement :
--   - cible introuvable ;
--   - cours hors année scolaire ;
--   - cours particulier hors période d'inscription de l'élève.

CREATE OR REPLACE FUNCTION check_special_course_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_class_id uuid;
    target_year_id uuid;
BEGIN
    IF NEW.class_id IS NOT NULL THEN
        SELECT school_class.id,
               school_class.school_year_id
          INTO target_class_id,
               target_year_id
          FROM classes AS school_class
         WHERE school_class.id = NEW.class_id;
    ELSE
        SELECT school_class.id,
               school_class.school_year_id
          INTO target_class_id,
               target_year_id
          FROM student_enrollments AS enrollment
          JOIN classes AS school_class
            ON school_class.id = enrollment.class_id
         WHERE enrollment.id = NEW.student_enrollment_id;

        IF FOUND THEN
            IF EXISTS (
                SELECT 1
                  FROM student_enrollments AS enrollment
                 WHERE enrollment.id = NEW.student_enrollment_id
                   AND (
                       NEW.valid_from < enrollment.start_date
                       OR (
                           enrollment.end_date IS NOT NULL
                           AND NEW.valid_until > enrollment.end_date
                       )
                   )
            ) THEN
                RAISE EXCEPTION USING ERRCODE = '23514',
                    MESSAGE = 'Le cours particulier doit rester dans la période d''inscription de l''élève.';
            END IF;
        END IF;
    END IF;

    IF target_class_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La classe ou l''inscription ciblée est introuvable.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM school_years AS school_year
         WHERE school_year.id = target_year_id
           AND (
               NEW.valid_from < school_year.start_date
               OR NEW.valid_until > school_year.end_date
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Le cours spécial doit rester dans l''année scolaire.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_special_courses_check_context
AFTER INSERT OR UPDATE ON special_courses
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_special_course_context();


-- =========================================================
-- 21. CONFLITS DES COURS SPECIAUX / PARTICULIERS
-- =========================================================
-- Les conflits des cours spéciaux sont aussi NON BLOQUANTS au moment
-- de la saisie. FastAPI doit les calculer et les afficher dans la
-- liste des conflits. La publication reste bloquée si ces conflits
-- touchent la période publiée.


-- =========================================================
-- 22. PROTECTION ET PUBLICATION DES COURS SPECIAUX
-- =========================================================
-- DRAFT :
--   modifiable et peut contenir des conflits.
--
-- PUBLISHED :
--   visible dans l'emploi du temps des élèves et doit être sans conflit.
--
-- ARCHIVED :
--   conservé pour l'historique.
--
-- Pour modifier un cours déjà publié, l'application crée un nouveau
-- cours DRAFT puis archive l'ancienne ligne au moment de publier la nouvelle.

CREATE OR REPLACE FUNCTION protect_special_course_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status <> 'DRAFT' THEN
            RAISE EXCEPTION USING ERRCODE = '23514',
                MESSAGE = 'Seul un cours spécial en brouillon peut être supprimé.';
        END IF;

        RETURN OLD;
    END IF;

    IF NEW.created_by_account_id IS DISTINCT FROM OLD.created_by_account_id
       OR NEW.class_id IS DISTINCT FROM OLD.class_id
       OR NEW.student_enrollment_id IS DISTINCT FROM OLD.student_enrollment_id
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La cible et le créateur d''un cours spécial sont immuables.';
    END IF;

    IF OLD.status = 'DRAFT' THEN
        IF NEW.status NOT IN ('DRAFT', 'PUBLISHED') THEN
            RAISE EXCEPTION USING ERRCODE = '23514',
                MESSAGE = 'Un cours spécial en brouillon peut uniquement être publié.';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD.status = 'PUBLISHED' THEN
        IF NEW.status <> 'ARCHIVED' THEN
            RAISE EXCEPTION USING ERRCODE = '23514',
                MESSAGE = 'Un cours spécial publié est immuable et peut uniquement être archivé.';
        END IF;

        IF NEW.subject_id IS DISTINCT FROM OLD.subject_id
           OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
           OR NEW.room_id IS DISTINCT FROM OLD.room_id
           OR NEW.title IS DISTINCT FROM OLD.title
           OR NEW.day_of_week IS DISTINCT FROM OLD.day_of_week
           OR NEW.start_time IS DISTINCT FROM OLD.start_time
           OR NEW.end_time IS DISTINCT FROM OLD.end_time
           OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
           OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
           OR NEW.note IS DISTINCT FROM OLD.note
           OR NEW.published_by_account_id IS DISTINCT FROM OLD.published_by_account_id
           OR NEW.published_at IS DISTINCT FROM OLD.published_at
        THEN
            RAISE EXCEPTION USING ERRCODE = '23514',
                MESSAGE = 'Le contenu d''un cours spécial publié est immuable.';
        END IF;

        RETURN NEW;
    END IF;

    RAISE EXCEPTION USING ERRCODE = '23514',
        MESSAGE = 'Un cours spécial archivé est immuable.';
END;
$$;

CREATE TRIGGER trg_special_courses_10_protect_status
BEFORE UPDATE OR DELETE ON special_courses
FOR EACH ROW
EXECUTE FUNCTION protect_special_course_status();


CREATE OR REPLACE FUNCTION check_special_course_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_class_id uuid;
    target_school_year_id uuid;
    target_level_id uuid;
BEGIN
    IF NEW.status <> 'PUBLISHED'
       OR OLD.status = 'PUBLISHED'
    THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtext('blaiseconnect:timetable-publication')
    );

    IF NEW.class_id IS NOT NULL THEN
        SELECT school_class.id,
               school_class.school_year_id,
               school_class.class_level_id
          INTO target_class_id,
               target_school_year_id,
               target_level_id
          FROM classes AS school_class
         WHERE school_class.id = NEW.class_id;
    ELSE
        SELECT school_class.id,
               school_class.school_year_id,
               school_class.class_level_id
          INTO target_class_id,
               target_school_year_id,
               target_level_id
          FROM student_enrollments AS enrollment
          JOIN classes AS school_class
            ON school_class.id = enrollment.class_id
         WHERE enrollment.id = NEW.student_enrollment_id;
    END IF;

    IF target_class_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La cible du cours spécial est introuvable.';
    END IF;

    -- Le jour récurrent doit réellement exister dans la période choisie.
    IF NOT EXISTS (
        SELECT 1
          FROM generate_series(
                   NEW.valid_from::timestamp,
                   NEW.valid_until::timestamp,
                   interval '1 day'
               ) AS occurrence(day_value)
         WHERE extract(isodow FROM occurrence.day_value)::smallint =
               NEW.day_of_week
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La période choisie ne contient aucune occurrence du jour sélectionné.';
    END IF;

    -- Horaires + pauses.
    IF NOT EXISTS (
        SELECT 1
          FROM schedule_profile_levels AS profile_level
          JOIN schedule_profiles AS profile
            ON profile.id = profile_level.schedule_profile_id
          JOIN school_day_schedules AS schedule
            ON schedule.schedule_profile_id = profile.id
         WHERE profile.school_year_id = target_school_year_id
           AND profile.is_active = true
           AND profile_level.class_level_id = target_level_id
           AND schedule.day_of_week = NEW.day_of_week
           AND NEW.start_time >= schedule.course_start_time
           AND NEW.end_time <= schedule.course_end_time
           AND NOT EXISTS (
               SELECT 1
                 FROM break_schedules AS break
                WHERE break.school_day_schedule_id = schedule.id
                  AND break.start_time < NEW.end_time
                  AND break.end_time > NEW.start_time
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : le cours spécial ne respecte pas les horaires ou les pauses.';
    END IF;

    -- Indisponibilité de l'enseignant.
    IF NEW.teacher_id IS NOT NULL
       AND EXISTS (
           SELECT 1
             FROM teacher_unavailabilities AS unavailable
            WHERE unavailable.school_year_id = target_school_year_id
              AND unavailable.teacher_id = NEW.teacher_id
              AND unavailable.day_of_week = NEW.day_of_week
              AND unavailable.start_time < NEW.end_time
              AND unavailable.end_time > NEW.start_time
       )
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : l''enseignant est indisponible.';
    END IF;

    -- Conflit avec un emploi du temps régulier publié.
    IF EXISTS (
        SELECT 1
          FROM timetables AS timetable
          JOIN classes AS school_class
            ON school_class.id = timetable.class_id
          JOIN timetable_slots AS slot
            ON slot.timetable_id = timetable.id
          JOIN teacher_assignments AS assignment
            ON assignment.id = slot.teacher_assignment_id
         WHERE timetable.status = 'PUBLISHED'
           AND school_class.school_year_id = target_school_year_id
           AND daterange(
                   timetable.effective_start_date,
                   timetable.effective_end_date,
                   '[]'
               )
               && daterange(
                   NEW.valid_from,
                   NEW.valid_until,
                   '[]'
               )
           AND slot.day_of_week = NEW.day_of_week
           AND slot.start_time < NEW.end_time
           AND slot.end_time > NEW.start_time
           AND (
               timetable.class_id = target_class_id
               OR (
                   NEW.teacher_id IS NOT NULL
                   AND assignment.teacher_id = NEW.teacher_id
               )
               OR (
                   NEW.room_id IS NOT NULL
                   AND slot.room_id = NEW.room_id
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : conflit avec un emploi du temps publié.';
    END IF;

    -- Conflit avec un autre cours spécial publié.
    IF EXISTS (
        SELECT 1
          FROM special_courses AS other_course
          LEFT JOIN student_enrollments AS other_enrollment
            ON other_enrollment.id = other_course.student_enrollment_id
         WHERE other_course.id <> NEW.id
           AND other_course.status = 'PUBLISHED'
           AND other_course.day_of_week = NEW.day_of_week
           AND other_course.start_time < NEW.end_time
           AND other_course.end_time > NEW.start_time
           AND daterange(
                   other_course.valid_from,
                   other_course.valid_until,
                   '[]'
               )
               && daterange(
                   NEW.valid_from,
                   NEW.valid_until,
                   '[]'
               )
           AND (
               (
                   NEW.teacher_id IS NOT NULL
                   AND other_course.teacher_id = NEW.teacher_id
               )
               OR (
                   NEW.room_id IS NOT NULL
                   AND other_course.room_id = NEW.room_id
               )
               OR (
                   NEW.student_enrollment_id IS NOT NULL
                   AND other_course.student_enrollment_id =
                       NEW.student_enrollment_id
               )
               OR (
                   NEW.class_id IS NOT NULL
                   AND (
                       other_course.class_id = NEW.class_id
                       OR other_enrollment.class_id = NEW.class_id
                   )
               )
               OR (
                   NEW.student_enrollment_id IS NOT NULL
                   AND other_course.class_id = target_class_id
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : conflit avec un autre cours spécial ou particulier.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_special_courses_20_check_publish
BEFORE UPDATE OF status ON special_courses
FOR EACH ROW
EXECUTE FUNCTION check_special_course_publish();


-- =========================================================
-- 23. VALIDATION AVANT PUBLICATION D'UN EMPLOI DU TEMPS
-- =========================================================
-- Les conflits sont acceptés dans un brouillon mais interdits
-- au moment de publier.

CREATE OR REPLACE FUNCTION check_timetable_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    current_school_year_id uuid;
    current_level_id uuid;
BEGIN
    IF NEW.status <> 'PUBLISHED'
       OR OLD.status = 'PUBLISHED'
    THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtext('blaiseconnect:timetable-publication')
    );

    SELECT school_class.school_year_id,
           school_class.class_level_id
      INTO current_school_year_id,
           current_level_id
      FROM classes AS school_class
     WHERE school_class.id = NEW.class_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La classe de l''emploi du temps est introuvable.';
    END IF;

    IF NEW.creation_mode = 'AUTOMATIC'
       AND NOT EXISTS (
           SELECT 1
             FROM timetable_generation_runs AS run
            WHERE run.id = NEW.generation_run_id
              AND run.status = 'COMPLETED'
       )
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La génération automatique doit être terminée avant publication.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM timetable_slots AS slot
         WHERE slot.timetable_id = NEW.id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Un emploi du temps vide ne peut pas être publié.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS slot_a
          JOIN timetable_slots AS slot_b
            ON slot_b.timetable_id = slot_a.timetable_id
           AND slot_b.id <> slot_a.id
           AND slot_b.day_of_week = slot_a.day_of_week
           AND slot_b.start_time < slot_a.end_time
           AND slot_b.end_time > slot_a.start_time
         WHERE slot_a.timetable_id = NEW.id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : deux cours de la classe se chevauchent.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS candidate
         WHERE candidate.timetable_id = NEW.id
           AND NOT EXISTS (
               SELECT 1
                 FROM schedule_profile_levels AS profile_level
                 JOIN schedule_profiles AS profile
                   ON profile.id = profile_level.schedule_profile_id
                 JOIN school_day_schedules AS schedule
                   ON schedule.schedule_profile_id = profile.id
                WHERE profile.school_year_id = current_school_year_id
                  AND profile.is_active = true
                  AND profile_level.class_level_id = current_level_id
                  AND schedule.day_of_week = candidate.day_of_week
                  AND candidate.start_time >= schedule.course_start_time
                  AND candidate.end_time <= schedule.course_end_time
                  AND NOT EXISTS (
                      SELECT 1
                        FROM break_schedules AS break
                       WHERE break.school_day_schedule_id = schedule.id
                         AND break.start_time < candidate.end_time
                         AND break.end_time > candidate.start_time
                  )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : un créneau ne respecte pas les horaires ou les pauses.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS candidate
          JOIN teacher_assignments AS assignment
            ON assignment.id = candidate.teacher_assignment_id
          JOIN teacher_unavailabilities AS unavailable
            ON unavailable.school_year_id = current_school_year_id
           AND unavailable.teacher_id = assignment.teacher_id
           AND unavailable.day_of_week = candidate.day_of_week
           AND unavailable.start_time < candidate.end_time
           AND unavailable.end_time > candidate.start_time
         WHERE candidate.timetable_id = NEW.id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : un enseignant est indisponible sur un créneau.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS slot_a
          JOIN teacher_assignments AS assignment_a
            ON assignment_a.id = slot_a.teacher_assignment_id
          JOIN timetable_slots AS slot_b
            ON slot_b.timetable_id = slot_a.timetable_id
           AND slot_b.id <> slot_a.id
           AND slot_b.day_of_week = slot_a.day_of_week
           AND slot_b.start_time < slot_a.end_time
           AND slot_b.end_time > slot_a.start_time
          JOIN teacher_assignments AS assignment_b
            ON assignment_b.id = slot_b.teacher_assignment_id
         WHERE slot_a.timetable_id = NEW.id
           AND (
               assignment_a.teacher_id = assignment_b.teacher_id
               OR (
                   slot_a.room_id IS NOT NULL
                   AND slot_a.room_id = slot_b.room_id
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : conflit interne d''enseignant ou de salle.';
    END IF;

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
          JOIN classes AS published_class
            ON published_class.id = published_timetable.class_id
          JOIN teacher_assignments AS published_assignment
            ON published_assignment.id = published.teacher_assignment_id
         WHERE candidate.timetable_id = NEW.id
           AND published_timetable.status = 'PUBLISHED'
           AND published_timetable.class_id <> NEW.class_id
           AND published_class.school_year_id = current_school_year_id
           AND daterange(
                   published_timetable.effective_start_date,
                   published_timetable.effective_end_date,
                   '[]'
               )
               && daterange(
                   NEW.effective_start_date,
                   NEW.effective_end_date,
                   '[]'
               )
           AND (
               candidate_assignment.teacher_id =
                   published_assignment.teacher_id
               OR (
                   candidate.room_id IS NOT NULL
                   AND candidate.room_id = published.room_id
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : conflit avec un autre emploi du temps publié.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS candidate
          JOIN teacher_assignments AS candidate_assignment
            ON candidate_assignment.id = candidate.teacher_assignment_id
          JOIN special_courses AS special_course
            ON special_course.day_of_week = candidate.day_of_week
           AND special_course.start_time < candidate.end_time
           AND special_course.end_time > candidate.start_time
          LEFT JOIN student_enrollments AS enrollment
            ON enrollment.id = special_course.student_enrollment_id
          LEFT JOIN classes AS special_class
            ON special_class.id = special_course.class_id
          LEFT JOIN classes AS enrollment_class
            ON enrollment_class.id = enrollment.class_id
         WHERE candidate.timetable_id = NEW.id
           AND special_course.status = 'PUBLISHED'
           AND COALESCE(
                   special_class.school_year_id,
                   enrollment_class.school_year_id
               ) = current_school_year_id
           AND daterange(
                   special_course.valid_from,
                   special_course.valid_until,
                   '[]'
               )
               && daterange(
                   NEW.effective_start_date,
                   NEW.effective_end_date,
                   '[]'
               )
           AND (
               special_course.class_id = NEW.class_id
               OR enrollment.class_id = NEW.class_id
               OR special_course.teacher_id = candidate_assignment.teacher_id
               OR (
                   candidate.room_id IS NOT NULL
                   AND special_course.room_id = candidate.room_id
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : conflit avec un cours spécial ou particulier.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_timetables_check_publish
BEFORE UPDATE OF status ON timetables
FOR EACH ROW
EXECUTE FUNCTION check_timetable_publish();


-- =========================================================
-- 24. VUE DETAILLEE DES CRENEAUX REGULIERS
-- =========================================================

CREATE VIEW v_timetable_slots_detailed AS
SELECT
    timetable.id AS timetable_id,
    timetable.class_id,
    timetable.version,
    timetable.effective_start_date,
    timetable.effective_end_date,
    timetable.status,
    timetable.creation_mode,

    slot.id AS slot_id,
    slot.day_of_week,
    slot.start_time,
    slot.end_time,

    class_subject.id AS class_subject_id,

    subject.id AS subject_id,
    subject.name AS subject_name,

    assignment.teacher_id,
    teacher.first_name || ' ' || teacher.last_name
        AS teacher_name,

    slot.room_id,
    room.name AS room_name

FROM timetables AS timetable
JOIN timetable_slots AS slot
    ON slot.timetable_id = timetable.id
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


-- =========================================================
-- 25. VUE UNIFIEE POUR L'EMPLOI DU TEMPS D'UN ELEVE
-- =========================================================
-- Cette vue rassemble :
--   REGULAR -> cours du planning publié de la classe ;
--   SPECIAL -> cours spéciaux de toute la classe ;
--   SPECIAL -> cours particuliers de l'élève.
--
-- Le frontend peut donc afficher UNE SEULE grille.
-- entry_type permet simplement d'afficher un badge différent.

CREATE VIEW v_student_timetable_entries AS

-- Cours réguliers.
SELECT
    enrollment.id AS student_enrollment_id,

    'REGULAR'::text AS entry_type,

    timetable.id AS timetable_id,
    slot.id AS source_entry_id,

    timetable.class_id,

    class_subject.subject_id,
    subject.name AS subject_name,

    assignment.teacher_id,
    teacher.first_name || ' ' || teacher.last_name
        AS teacher_name,

    slot.room_id,
    room.name AS room_name,

    subject.name AS title,

    slot.day_of_week,
    slot.start_time,
    slot.end_time,

    GREATEST(
        enrollment.start_date,
        timetable.effective_start_date
    ) AS valid_from,

    LEAST(
        COALESCE(
            enrollment.end_date,
            school_year.end_date
        ),
        school_year.end_date,
        timetable.effective_end_date
    ) AS valid_until,

    false AS is_special

FROM student_enrollments AS enrollment
JOIN classes AS school_class
    ON school_class.id = enrollment.class_id
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
JOIN timetables AS timetable
    ON timetable.class_id = school_class.id
   AND timetable.status = 'PUBLISHED'
   AND daterange(
           timetable.effective_start_date,
           timetable.effective_end_date,
           '[]'
       )
       && daterange(
           enrollment.start_date,
           COALESCE(enrollment.end_date, school_year.end_date),
           '[]'
       )
JOIN timetable_slots AS slot
    ON slot.timetable_id = timetable.id
JOIN teacher_assignments AS assignment
    ON assignment.id = slot.teacher_assignment_id
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
JOIN teachers AS teacher
    ON teacher.id = assignment.teacher_id
LEFT JOIN rooms AS room
    ON room.id = slot.room_id

UNION ALL

-- Cours spéciaux de classe + cours particuliers.
SELECT
    enrollment.id AS student_enrollment_id,

    'SPECIAL'::text AS entry_type,

    NULL::uuid AS timetable_id,
    special_course.id AS source_entry_id,

    enrollment.class_id,

    special_course.subject_id,
    subject.name AS subject_name,

    special_course.teacher_id,

    CASE
        WHEN teacher.id IS NULL
        THEN NULL
        ELSE teacher.first_name || ' ' || teacher.last_name
    END AS teacher_name,

    special_course.room_id,
    room.name AS room_name,

    special_course.title,

    special_course.day_of_week,
    special_course.start_time,
    special_course.end_time,

    special_course.valid_from,
    special_course.valid_until,

    true AS is_special

FROM special_courses AS special_course
JOIN student_enrollments AS enrollment
    ON (
        special_course.student_enrollment_id = enrollment.id
        OR (
            special_course.class_id IS NOT NULL
            AND special_course.class_id = enrollment.class_id
        )
    )
   AND special_course.valid_until >= enrollment.start_date
   AND (
       enrollment.end_date IS NULL
       OR special_course.valid_from <= enrollment.end_date
   )
LEFT JOIN subjects AS subject
    ON subject.id = special_course.subject_id
LEFT JOIN teachers AS teacher
    ON teacher.id = special_course.teacher_id
LEFT JOIN rooms AS room
    ON room.id = special_course.room_id
WHERE special_course.status = 'PUBLISHED';


-- =========================================================
-- 26. DROITS APPLICATIFS
-- =========================================================

GRANT SELECT ON TABLE
    rooms,
    schedule_profiles,
    schedule_profile_levels,
    school_day_schedules,
    break_schedules,
    level_subject_requirements,
    teacher_unavailabilities,
    timetable_generation_runs,
    timetables,
    timetable_slots,
    special_courses
TO blaise_app;


-- Salles.
GRANT INSERT (
    name,
    capacity,
    is_active
)
ON rooms TO blaise_app;

GRANT UPDATE (
    name,
    capacity,
    is_active
)
ON rooms TO blaise_app;


-- Profils horaires.
GRANT INSERT (
    school_year_id,
    name,
    is_active
)
ON schedule_profiles TO blaise_app;

GRANT UPDATE (
    name,
    is_active
)
ON schedule_profiles TO blaise_app;

GRANT INSERT (
    schedule_profile_id,
    class_level_id
)
ON schedule_profile_levels TO blaise_app;

GRANT DELETE
ON TABLE schedule_profile_levels
TO blaise_app;


-- Journées.
GRANT INSERT (
    schedule_profile_id,
    day_of_week,
    course_start_time,
    course_end_time,
    lesson_duration_minutes
)
ON school_day_schedules TO blaise_app;

GRANT UPDATE (
    course_start_time,
    course_end_time,
    lesson_duration_minutes
)
ON school_day_schedules TO blaise_app;


-- Pauses.
GRANT INSERT (
    school_day_schedule_id,
    label,
    start_time,
    end_time
)
ON break_schedules TO blaise_app;

GRANT UPDATE (
    label,
    start_time,
    end_time
)
ON break_schedules TO blaise_app;

GRANT DELETE
ON TABLE break_schedules
TO blaise_app;


-- Volumes horaires.
GRANT INSERT (
    school_year_id,
    class_level_id,
    subject_id,
    weekly_minutes
)
ON level_subject_requirements TO blaise_app;

GRANT UPDATE (
    weekly_minutes
)
ON level_subject_requirements TO blaise_app;


-- Indisponibilités enseignants.
GRANT INSERT (
    school_year_id,
    teacher_id,
    day_of_week,
    start_time,
    end_time,
    reason
)
ON teacher_unavailabilities TO blaise_app;

GRANT UPDATE (
    day_of_week,
    start_time,
    end_time,
    reason
)
ON teacher_unavailabilities TO blaise_app;

GRANT DELETE
ON TABLE teacher_unavailabilities
TO blaise_app;


-- Génération automatique.
GRANT INSERT (
    school_year_id,
    requested_by_account_id,
    status,
    target_start_date,
    target_end_date,
    parameters,
    started_at,
    completed_at,
    error_message
)
ON timetable_generation_runs TO blaise_app;

GRANT UPDATE (
    status,
    target_start_date,
    target_end_date,
    parameters,
    started_at,
    completed_at,
    error_message
)
ON timetable_generation_runs TO blaise_app;


-- Versions de planning.
GRANT INSERT (
    class_id,
    version,
    effective_start_date,
    effective_end_date,
    creation_mode,
    created_by_account_id,
    generation_run_id
)
ON timetables TO blaise_app;

GRANT UPDATE (
    status,
    published_by_account_id,
    published_at
)
ON timetables TO blaise_app;

GRANT DELETE
ON TABLE timetables
TO blaise_app;


-- Créneaux.
GRANT INSERT (
    timetable_id,
    teacher_assignment_id,
    room_id,
    day_of_week,
    start_time,
    end_time
)
ON timetable_slots TO blaise_app;

GRANT UPDATE (
    teacher_assignment_id,
    room_id,
    day_of_week,
    start_time,
    end_time
)
ON timetable_slots TO blaise_app;

GRANT DELETE
ON TABLE timetable_slots
TO blaise_app;


-- Cours spéciaux / particuliers.
GRANT INSERT (
    class_id,
    student_enrollment_id,
    subject_id,
    teacher_id,
    room_id,
    title,
    day_of_week,
    start_time,
    end_time,
    valid_from,
    valid_until,
    note,
    created_by_account_id
)
ON special_courses TO blaise_app;

GRANT UPDATE (
    subject_id,
    teacher_id,
    room_id,
    title,
    day_of_week,
    start_time,
    end_time,
    valid_from,
    valid_until,
    note,
    status,
    published_by_account_id,
    published_at
)
ON special_courses TO blaise_app;

GRANT DELETE
ON TABLE special_courses
TO blaise_app;


-- Vues.
GRANT SELECT
ON v_timetable_slots_detailed
TO blaise_app;

GRANT SELECT
ON v_student_timetable_entries
TO blaise_app;


COMMIT;
