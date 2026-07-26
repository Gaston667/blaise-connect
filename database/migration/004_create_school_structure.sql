-- =========================================================
-- MIGRATION 004 : structure scolaire
-- =========================================================
-- User Stories : US-003, US-004, US-005 et US-006
-- PostgreSQL : 15 ou supérieur
--
-- Nature :
--   - additive pour les nouvelles tables ;
--   - additive pour les nouvelles tables.
-- =========================================================

BEGIN;

-- Requis pour les contraintes EXCLUDE qui combinent un UUID
-- et une plage de dates.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE enrollment_end_reason_enum AS ENUM (
    'YEAR_COMPLETED',
    'CLASS_CHANGE',
    'LEFT_SCHOOL'
);

-- =========================================================
-- 1. ANNEES SCOLAIRES
-- =========================================================

CREATE TABLE school_years (
    id uuid
        CONSTRAINT pk_school_years PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name varchar(20) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean NOT NULL DEFAULT false,
    closed_at timestamptz,
    closed_by_account_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_school_years_name
        UNIQUE (name),

    CONSTRAINT fk_school_years_closed_by_account
        FOREIGN KEY (closed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_school_years_name_not_blank
        CHECK (
            char_length(btrim(name)) > 0
            AND name = btrim(name)
        ),

    CONSTRAINT ck_school_years_dates
        CHECK (end_date > start_date),

    CONSTRAINT ck_school_years_closure_pair
        CHECK (
            (closed_at IS NULL AND closed_by_account_id IS NULL)
            OR
            (closed_at IS NOT NULL AND closed_by_account_id IS NOT NULL)
        ),

    CONSTRAINT ck_school_years_closed_not_current
        CHECK (
            closed_at IS NULL
            OR is_current = false
        )
);

-- Une seule année scolaire peut être courante.
CREATE UNIQUE INDEX uq_school_years_one_current
    ON school_years (is_current)
    WHERE is_current = true;

-- Les plages sont inclusives : deux années ne peuvent partager
-- aucun jour.
ALTER TABLE school_years
    ADD CONSTRAINT ex_school_years_no_overlap
    EXCLUDE USING gist (
        daterange(start_date, end_date, '[]') WITH &&
    );

CREATE INDEX idx_school_years_closed_by_account_id
    ON school_years (closed_by_account_id)
    WHERE closed_by_account_id IS NOT NULL;

-- =========================================================
-- 3. PERIODES DE BULLETIN
-- =========================================================

CREATE TABLE reporting_periods (
    id uuid
        CONSTRAINT pk_reporting_periods PRIMARY KEY
        DEFAULT gen_random_uuid(),

    school_year_id uuid NOT NULL,
    name varchar(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_reporting_periods_school_year
        FOREIGN KEY (school_year_id)
        REFERENCES school_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_reporting_periods_name_not_blank
        CHECK (
            char_length(btrim(name)) > 0
            AND name = btrim(name)
        ),

    CONSTRAINT ck_reporting_periods_dates
        CHECK (end_date >= start_date),

    CONSTRAINT ex_reporting_periods_no_overlap
        EXCLUDE USING gist (
            school_year_id WITH =,
            daterange(start_date, end_date, '[]') WITH &&
        )
);

CREATE INDEX idx_reporting_periods_school_year_start_date
    ON reporting_periods (school_year_id, start_date);

-- =========================================================
-- 4. NIVEAUX
-- =========================================================

CREATE TYPE class_level_code_enum AS ENUM (
    'PETITE_SECTION',
    'MOYENNE_SECTION',
    'GRANDE_SECTION',
    'CP',
    'CE1',
    'CE2',
    'CM1',
    'CM2',
    'SIXIEME',
    'CINQUIEME',
    'QUATRIEME',
    'TROISIEME',
    'SECONDE',
    'PREMIERE',
    'TERMINALE'
);

CREATE TYPE education_stage_enum AS ENUM (
    'PRESCHOOL',
    'PRIMARY',
    'MIDDLE_SCHOOL',
    'HIGH_SCHOOL'
);

CREATE TABLE class_levels (
    id uuid
        CONSTRAINT pk_class_levels PRIMARY KEY
        DEFAULT gen_random_uuid(),

    code class_level_code_enum NOT NULL,
    name varchar(100) NOT NULL,
    education_stage education_stage_enum NOT NULL,
    display_order smallint NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_class_levels_code
        UNIQUE (code),

    CONSTRAINT ck_class_levels_name_normalized
        CHECK (
            char_length(btrim(name)) > 0
            AND name = btrim(name)
        ),

    CONSTRAINT ck_class_levels_code_stage
        CHECK (
            (code IN (
                'PETITE_SECTION',
                'MOYENNE_SECTION',
                'GRANDE_SECTION'
            ) AND education_stage = 'PRESCHOOL')
            OR
            (code IN (
                'CP', 'CE1', 'CE2', 'CM1', 'CM2'
            ) AND education_stage = 'PRIMARY')
            OR
            (code IN (
                'SIXIEME',
                'CINQUIEME',
                'QUATRIEME',
                'TROISIEME'
            ) AND education_stage = 'MIDDLE_SCHOOL')
            OR
            (code IN (
                'SECONDE', 'PREMIERE', 'TERMINALE'
            ) AND education_stage = 'HIGH_SCHOOL')
        ),

    CONSTRAINT ck_class_levels_display_order
        CHECK (display_order >= 0)
);

-- =========================================================
-- 5. MATIERES
-- =========================================================

CREATE TABLE subjects (
    id uuid
        CONSTRAINT pk_subjects PRIMARY KEY
        DEFAULT gen_random_uuid(),

    name varchar(100) NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ck_subjects_name_normalized
        CHECK (
            char_length(btrim(name)) > 0
            AND name = btrim(name)
        ),

    CONSTRAINT ck_subjects_description_not_blank
        CHECK (
            description IS NULL
            OR char_length(btrim(description)) > 0
        )
);

CREATE UNIQUE INDEX uq_subjects_name_ci
    ON subjects (lower(name));

-- =========================================================
-- 6. CLASSES ANNUELLES
-- =========================================================

CREATE TABLE classes (
    id uuid
        CONSTRAINT pk_classes PRIMARY KEY
        DEFAULT gen_random_uuid(),

    school_year_id uuid NOT NULL,
    class_level_id uuid NOT NULL,
    main_teacher_id uuid NOT NULL,
    group_label varchar(30) NOT NULL,
    capacity smallint,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_classes_school_year
        FOREIGN KEY (school_year_id)
        REFERENCES school_years(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_classes_class_level
        FOREIGN KEY (class_level_id)
        REFERENCES class_levels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_classes_main_teacher
        FOREIGN KEY (main_teacher_id)
        REFERENCES teachers(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_classes_year_level_group
        UNIQUE (school_year_id, class_level_id, group_label),

    CONSTRAINT ck_classes_group_label_normalized
        CHECK (
            char_length(btrim(group_label)) > 0
            AND group_label = upper(btrim(group_label))
        ),

    CONSTRAINT ck_classes_capacity_positive
        CHECK (
            capacity IS NULL
            OR capacity > 0
        )
);

CREATE INDEX idx_classes_school_year_id
    ON classes (school_year_id);

CREATE INDEX idx_classes_class_level_id
    ON classes (class_level_id);

CREATE INDEX idx_classes_main_teacher_id
    ON classes (main_teacher_id);

-- =========================================================
-- 7. INSCRIPTIONS DES ELEVES
-- =========================================================

-- Conserve chaque passage d'un élève dans une classe. Une nouvelle ligne
-- est créée lors d'un changement de classe ou d'année afin de préserver
-- les notes, absences et bulletins historiques.
CREATE TABLE student_enrollments (
    id uuid
        CONSTRAINT pk_student_enrollments PRIMARY KEY
        DEFAULT gen_random_uuid(),

    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    end_reason enrollment_end_reason_enum,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_student_enrollments_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_student_enrollments_class
        FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_student_enrollments_student_class
        UNIQUE (student_id, class_id),

    CONSTRAINT ck_student_enrollments_dates
        CHECK (end_date IS NULL OR end_date >= start_date),

    CONSTRAINT ck_student_enrollments_end_pair
        CHECK (
            (end_date IS NULL AND end_reason IS NULL)
            OR
            (end_date IS NOT NULL AND end_reason IS NOT NULL)
        )
);

CREATE UNIQUE INDEX uq_student_enrollments_one_open
    ON student_enrollments (student_id)
    WHERE end_date IS NULL;

CREATE INDEX idx_student_enrollments_class_id
    ON student_enrollments (class_id);

-- =========================================================
-- 8. MATIERES ENSEIGNEES DANS LES CLASSES
-- =========================================================

CREATE TABLE class_subjects (
    id uuid
        CONSTRAINT pk_class_subjects PRIMARY KEY
        DEFAULT gen_random_uuid(),

    class_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    coefficient numeric(6, 2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_class_subjects_class
        FOREIGN KEY (class_id)
        REFERENCES classes(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_class_subjects_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_class_subjects_class_subject
        UNIQUE (class_id, subject_id),

    CONSTRAINT ck_class_subjects_coefficient_positive
        CHECK (coefficient > 0)
);

CREATE INDEX idx_class_subjects_subject_id
    ON class_subjects (subject_id);

-- La contrainte UNIQUE (class_id, subject_id) fournit déjà un
-- index dont la première colonne est class_id.

-- =========================================================
-- 8. REGLES INTER-TABLES
-- =========================================================

-- Vérifie que le compte ayant clôturé une année est ADMIN.
CREATE OR REPLACE FUNCTION check_school_year_closed_by_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    account_role varchar(20);
BEGIN
    IF NEW.closed_by_account_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT a.role
      INTO account_role
      FROM accounts AS a
     WHERE a.id = NEW.closed_by_account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'Le compte de clôture est introuvable.';
    END IF;

    IF account_role IS DISTINCT FROM 'ADMIN' THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Seul un compte ADMIN peut clôturer une année scolaire.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_school_years_check_closed_by_role
AFTER INSERT OR UPDATE ON school_years
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_school_year_closed_by_role();

-- Une année déjà clôturée ne peut plus être rouverte ni modifiée.
CREATE OR REPLACE FUNCTION protect_closed_school_year()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.closed_at IS NOT NULL
       AND (
            NEW.name IS DISTINCT FROM OLD.name
            OR NEW.start_date IS DISTINCT FROM OLD.start_date
            OR NEW.end_date IS DISTINCT FROM OLD.end_date
            OR NEW.is_current IS DISTINCT FROM OLD.is_current
            OR NEW.closed_at IS DISTINCT FROM OLD.closed_at
            OR NEW.closed_by_account_id
                IS DISTINCT FROM OLD.closed_by_account_id
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Une année scolaire clôturée ne peut plus être modifiée ni rouverte.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_school_years_10_protect_closed
BEFORE UPDATE ON school_years
FOR EACH ROW
EXECUTE FUNCTION protect_closed_school_year();

-- Vérifie qu'une période reste dans les bornes de son année.
CREATE OR REPLACE FUNCTION check_reporting_period_within_year()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    year_start date;
    year_end date;
BEGIN
    SELECT sy.start_date, sy.end_date
      INTO year_start, year_end
      FROM school_years AS sy
     WHERE sy.id = NEW.school_year_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'L''année scolaire de la période est introuvable.';
    END IF;

    IF NEW.start_date < year_start
       OR NEW.end_date > year_end
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'La période doit rester comprise dans les dates de son année scolaire.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_reporting_periods_check_year_bounds
AFTER INSERT OR UPDATE ON reporting_periods
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_reporting_period_within_year();

-- Protège aussi le sens inverse : modifier les dates d'une année
-- ne doit pas laisser une période existante hors de ses bornes.
CREATE OR REPLACE FUNCTION check_school_year_period_bounds()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM reporting_periods AS rp
         WHERE rp.school_year_id = NEW.id
           AND (
                rp.start_date < NEW.start_date
                OR rp.end_date > NEW.end_date
           )
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les nouvelles dates de l''année excluent une période existante.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_school_years_check_period_bounds
AFTER UPDATE ON school_years
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_school_year_period_bounds();

-- Une année peut être active sans période. Dès qu'une période existe,
-- la première commence au début de l'année et les suivantes sont contiguës.
-- La dernière période peut être ajoutée plus tard.
CREATE OR REPLACE FUNCTION assert_reporting_period_continuity(
    checked_school_year_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    year_start date;
    period_count integer;
    first_period_start date;
BEGIN
    SELECT sy.start_date
      INTO year_start
      FROM school_years AS sy
     WHERE sy.id = checked_school_year_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT
        count(*),
        min(rp.start_date)
      INTO period_count, first_period_start
      FROM reporting_periods AS rp
     WHERE rp.school_year_id = checked_school_year_id;

    IF period_count = 0 THEN
        RETURN;
    END IF;

    IF first_period_start IS DISTINCT FROM year_start
       OR EXISTS (
            SELECT 1
              FROM (
                    SELECT
                        rp.start_date,
                        lag(rp.end_date) OVER (
                            ORDER BY rp.start_date
                        ) AS previous_end_date
                      FROM reporting_periods AS rp
                     WHERE rp.school_year_id = checked_school_year_id
              ) AS ordered_periods
             WHERE ordered_periods.previous_end_date IS NOT NULL
               AND ordered_periods.start_date
                   <> ordered_periods.previous_end_date + 1
       )
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les périodes doivent commencer au début de l''année et rester contiguës.';
    END IF;
END;
$$;

-- Vérifie que les dates d'inscription restent dans l'année de la classe.
CREATE OR REPLACE FUNCTION check_student_enrollment_within_class_year()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    year_start date;
    year_end date;
BEGIN
    SELECT sy.start_date, sy.end_date
      INTO year_start, year_end
      FROM classes AS c
      JOIN school_years AS sy
        ON sy.id = c.school_year_id
     WHERE c.id = NEW.class_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'La classe de l''inscription est introuvable.';
    END IF;

    IF NEW.start_date < year_start
       OR NEW.start_date > year_end
       OR (NEW.end_date IS NOT NULL AND NEW.end_date > year_end)
    THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les dates de l''inscription doivent rester dans l''année de la classe.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_student_enrollments_check_year_bounds
AFTER INSERT OR UPDATE ON student_enrollments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_student_enrollment_within_class_year();

-- Lors de la première clôture d'une année, termine ses inscriptions ouvertes.
CREATE OR REPLACE FUNCTION close_open_enrollments_for_school_year()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.closed_at IS NULL AND NEW.closed_at IS NOT NULL THEN
        UPDATE student_enrollments AS se
           SET end_date = NEW.end_date,
               end_reason = 'YEAR_COMPLETED'
          FROM classes AS c
         WHERE se.class_id = c.id
           AND c.school_year_id = NEW.id
           AND se.end_date IS NULL;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_school_years_20_close_open_enrollments
AFTER UPDATE OF closed_at ON school_years
FOR EACH ROW
EXECUTE FUNCTION close_open_enrollments_for_school_year();

CREATE OR REPLACE FUNCTION check_reporting_period_continuity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_TABLE_NAME = 'school_years' THEN
        PERFORM assert_reporting_period_continuity(NEW.id);
        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        PERFORM assert_reporting_period_continuity(OLD.school_year_id);
        RETURN OLD;
    END IF;

    IF TG_OP = 'UPDATE'
       AND OLD.school_year_id IS DISTINCT FROM NEW.school_year_id
    THEN
        PERFORM assert_reporting_period_continuity(OLD.school_year_id);
    END IF;

    PERFORM assert_reporting_period_continuity(NEW.school_year_id);
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_school_years_check_period_continuity
AFTER INSERT OR UPDATE ON school_years
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_reporting_period_continuity();

CREATE CONSTRAINT TRIGGER trg_reporting_periods_check_continuity
AFTER INSERT OR UPDATE OR DELETE ON reporting_periods
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION check_reporting_period_continuity();

-- Les données rattachées à une année clôturée deviennent immuables.
CREATE OR REPLACE FUNCTION protect_closed_reporting_period()
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
          FROM school_years AS sy
         WHERE sy.id = OLD.school_year_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT sy.closed_at IS NOT NULL
          INTO new_year_closed
          FROM school_years AS sy
         WHERE sy.id = NEW.school_year_id;
    END IF;

    IF old_year_closed OR new_year_closed THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les périodes d''une année clôturée sont immuables.';
    END IF;

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$;

CREATE TRIGGER trg_reporting_periods_10_protect_closed_year
BEFORE INSERT OR UPDATE OR DELETE ON reporting_periods
FOR EACH ROW
EXECUTE FUNCTION protect_closed_reporting_period();

CREATE OR REPLACE FUNCTION protect_closed_class()
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
          FROM school_years AS sy
         WHERE sy.id = OLD.school_year_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT sy.closed_at IS NOT NULL
          INTO new_year_closed
          FROM school_years AS sy
         WHERE sy.id = NEW.school_year_id;
    END IF;

    IF old_year_closed OR new_year_closed THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les classes d''une année clôturée sont immuables.';
    END IF;

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$;

CREATE TRIGGER trg_classes_10_protect_closed_year
BEFORE INSERT OR UPDATE OR DELETE ON classes
FOR EACH ROW
EXECUTE FUNCTION protect_closed_class();

CREATE OR REPLACE FUNCTION protect_closed_class_subject()
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
          FROM classes AS c
          JOIN school_years AS sy
            ON sy.id = c.school_year_id
         WHERE c.id = OLD.class_id;
    END IF;

    IF TG_OP <> 'DELETE' THEN
        SELECT sy.closed_at IS NOT NULL
          INTO new_year_closed
          FROM classes AS c
          JOIN school_years AS sy
            ON sy.id = c.school_year_id
         WHERE c.id = NEW.class_id;
    END IF;

    IF old_year_closed OR new_year_closed THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les matières d''une classe d''année clôturée sont immuables.';
    END IF;

    RETURN CASE
        WHEN TG_OP = 'DELETE' THEN OLD
        ELSE NEW
    END;
END;
$$;

CREATE TRIGGER trg_class_subjects_10_protect_closed_year
BEFORE INSERT OR UPDATE OR DELETE ON class_subjects
FOR EACH ROW
EXECUTE FUNCTION protect_closed_class_subject();

-- =========================================================
-- 9. MISE A JOUR AUTOMATIQUE DE updated_at
-- =========================================================

CREATE TRIGGER trg_school_years_set_updated_at
BEFORE UPDATE ON school_years
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reporting_periods_set_updated_at
BEFORE UPDATE ON reporting_periods
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_class_levels_set_updated_at
BEFORE UPDATE ON class_levels
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_subjects_set_updated_at
BEFORE UPDATE ON subjects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_classes_set_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_student_enrollments_set_updated_at
BEFORE UPDATE ON student_enrollments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_class_subjects_set_updated_at
BEFORE UPDATE ON class_subjects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 10. DROITS DU BACKEND
-- =========================================================

GRANT SELECT ON TABLE
    school_years,
    reporting_periods,
    class_levels,
    classes,
    student_enrollments,
    subjects,
    class_subjects
TO blaise_app;

GRANT INSERT (
    name,
    start_date,
    end_date
)
ON school_years TO blaise_app;

GRANT UPDATE (
    name,
    start_date,
    end_date,
    is_current,
    closed_at,
    closed_by_account_id
)
ON school_years TO blaise_app;

GRANT INSERT (
    school_year_id,
    name,
    start_date,
    end_date
)
ON reporting_periods TO blaise_app;

GRANT UPDATE (
    school_year_id,
    name,
    start_date,
    end_date
)
ON reporting_periods TO blaise_app;

GRANT INSERT (
    code,
    name,
    education_stage,
    display_order
)
ON class_levels TO blaise_app;

GRANT UPDATE (
    code,
    name,
    education_stage,
    display_order,
    is_active
)
ON class_levels TO blaise_app;

GRANT INSERT (
    school_year_id,
    class_level_id,
    main_teacher_id,
    group_label,
    capacity
)
ON classes TO blaise_app;

GRANT INSERT (
    student_id,
    class_id,
    start_date,
    end_date,
    end_reason
)
ON student_enrollments TO blaise_app;

GRANT UPDATE (
    class_id,
    start_date,
    end_date,
    end_reason
)
ON student_enrollments TO blaise_app;

GRANT UPDATE (
    school_year_id,
    class_level_id,
    main_teacher_id,
    group_label,
    capacity
)
ON classes TO blaise_app;

GRANT INSERT (
    name,
    description
)
ON subjects TO blaise_app;

GRANT UPDATE (
    name,
    description,
    is_active
)
ON subjects TO blaise_app;

GRANT INSERT (
    class_id,
    subject_id,
    coefficient
)
ON class_subjects TO blaise_app;

GRANT UPDATE (
    class_id,
    subject_id,
    coefficient
)
ON class_subjects TO blaise_app;

REVOKE DELETE ON TABLE
    school_years,
    reporting_periods,
    class_levels,
    classes,
    student_enrollments,
    subjects,
    class_subjects
FROM blaise_app;

COMMIT;
