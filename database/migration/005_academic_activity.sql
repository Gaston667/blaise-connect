-- =========================================================
-- MIGRATION 005 : Évaluations, affectations et spécialités
-- =========================================================
-- Tables : teacher_assignments, assessments, grades,
--          student_specialties, specialty_constraints
-- Règles : dates d'affectation dans l'année, notes cohérentes,
--          spécialités pour Première/Terminale seulement,
--          incompatibilités entre spécialités.
-- D-022 à D-024 intégrées.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. AFFECTATIONS DES ENSEIGNANTS AUX MATIÈRES PAR CLASSE
-- =========================================================

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
            class_subject_id WITH =,
            daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
        )
);

CREATE INDEX idx_teacher_assignments_teacher_id
    ON teacher_assignments (teacher_id);

CREATE INDEX idx_teacher_assignments_class_subject_id
    ON teacher_assignments (class_subject_id);

-- Vérifier que les dates de l'affectation sont dans l'année scolaire de la classe.
CREATE OR REPLACE FUNCTION check_teacher_assignment_within_class_year()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE year_start date; year_end date;
BEGIN
    SELECT sy.start_date, sy.end_date INTO year_start, year_end
      FROM class_subjects AS cs
      JOIN classes AS c ON c.id = cs.class_id
      JOIN school_years AS sy ON sy.id = c.school_year_id
     WHERE cs.id = NEW.class_subject_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La matière de classe est introuvable.';
    END IF;

    IF NEW.start_date < year_start OR NEW.start_date > year_end
       OR (NEW.end_date IS NOT NULL AND NEW.end_date > year_end)
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Les dates de l''affectation doivent rester dans l''année scolaire de la classe.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_teacher_assignments_check_year_bounds
AFTER INSERT OR UPDATE ON teacher_assignments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_teacher_assignment_within_class_year();

CREATE TRIGGER trg_teacher_assignments_set_updated_at
BEFORE UPDATE ON teacher_assignments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 2. ÉVALUATIONS
-- =========================================================

CREATE TABLE assessments (
    id uuid
        CONSTRAINT pk_assessments PRIMARY KEY
        DEFAULT gen_random_uuid(),
    teacher_assignment_id uuid NOT NULL,
    title varchar(150) NOT NULL,
    description text,
    assessment_date date NOT NULL,
    maximum_score numeric(6, 2) NOT NULL,
    coefficient numeric(6, 2) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_assessments_teacher_assignment
        FOREIGN KEY (teacher_assignment_id)
        REFERENCES teacher_assignments(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_assessments_assignment_title_date
        UNIQUE (teacher_assignment_id, title, assessment_date),

    CONSTRAINT ck_assessments_title_not_blank
        CHECK (char_length(btrim(title)) > 0),

    CONSTRAINT ck_assessments_maximum_score_positive
        CHECK (maximum_score > 0),

    CONSTRAINT ck_assessments_coefficient_positive
        CHECK (coefficient > 0)
);

CREATE INDEX idx_assessments_teacher_assignment_id
    ON assessments (teacher_assignment_id);

CREATE TRIGGER trg_assessments_set_updated_at
BEFORE UPDATE ON assessments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 3. NOTES ET ABSENCES
-- =========================================================

CREATE TYPE grade_result_type_enum AS ENUM (
    'SCORED',
    'ABSENT'
);

CREATE TYPE justification_status_enum AS ENUM (
    'UNJUSTIFIED',
    'PENDING',
    'JUSTIFIED',
    'REJECTED'
);

CREATE TABLE grades (
    id uuid
        CONSTRAINT pk_grades PRIMARY KEY
        DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL,
    student_enrollment_id uuid NOT NULL,
    result_type grade_result_type_enum NOT NULL,
    score numeric(6, 2),
    justification_status justification_status_enum,
    reviewed_by_account_id uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_grades_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_grades_student_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_grades_reviewed_by_account
        FOREIGN KEY (reviewed_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_grades_score_coherence
        CHECK (
            (result_type = 'SCORED'
             AND score IS NOT NULL
             AND score >= 0
             AND justification_status IS NULL)
            OR
            (result_type = 'ABSENT'
             AND score IS NULL
             AND justification_status IN ('UNJUSTIFIED', 'PENDING', 'JUSTIFIED', 'REJECTED'))
        ),

    CONSTRAINT ck_grades_review_pair
        CHECK (
            (reviewed_by_account_id IS NULL AND reviewed_at IS NULL)
            OR
            (reviewed_by_account_id IS NOT NULL AND reviewed_at IS NOT NULL)
        )
);

CREATE INDEX idx_grades_assessment_id
    ON grades (assessment_id);

CREATE INDEX idx_grades_student_enrollment_id
    ON grades (student_enrollment_id);

CREATE INDEX idx_grades_reviewed_by_account_id
    ON grades (reviewed_by_account_id);

-- Vérifier que l'élève est inscrit dans la classe de l'évaluation.
CREATE OR REPLACE FUNCTION check_grade_student_in_class()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE class_id uuid;
BEGIN
    SELECT c.id INTO class_id
      FROM assessments AS a
      JOIN teacher_assignments AS ta ON ta.id = a.teacher_assignment_id
      JOIN class_subjects AS cs ON cs.id = ta.class_subject_id
      JOIN classes AS c ON c.id = cs.class_id
     WHERE a.id = NEW.assessment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'L''évaluation est introuvable.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM student_enrollments AS se
         WHERE se.id = NEW.student_enrollment_id AND se.class_id = class_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'L''élève n''est pas inscrit dans la classe de l''évaluation.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_grades_check_student_in_class
AFTER INSERT OR UPDATE ON grades
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_grade_student_in_class();

-- Vérifier que le score ne dépasse pas le barème de l'évaluation.
CREATE OR REPLACE FUNCTION check_grade_score_within_max()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE max_score numeric(6, 2);
BEGIN
    IF NEW.score IS NULL THEN RETURN NEW; END IF;

    SELECT a.maximum_score INTO max_score
      FROM assessments AS a
     WHERE a.id = NEW.assessment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'L''évaluation est introuvable.';
    END IF;

    IF NEW.score > max_score THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = format(
                'Le score (%.2f) ne peut pas dépasser le barème (%.2f).',
                NEW.score, max_score
            );
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_grades_check_score_within_max
AFTER INSERT OR UPDATE ON grades
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_grade_score_within_max();

CREATE TRIGGER trg_grades_set_updated_at
BEFORE UPDATE ON grades
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 4. SPÉCIALITÉS (Première/Terminale)
-- =========================================================

-- Ajouter le flag is_specialty à subjects (migration 004).
-- Ici, on crée la table de liaison et les contraintes.

CREATE TABLE student_specialties (
    id uuid
        CONSTRAINT pk_student_specialties PRIMARY KEY
        DEFAULT gen_random_uuid(),
    student_enrollment_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_student_specialties_student_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_student_specialties_subject
        FOREIGN KEY (subject_id)
        REFERENCES subjects(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_student_specialties_unique
        UNIQUE (student_enrollment_id, subject_id)
);

CREATE INDEX idx_student_specialties_student_enrollment_id
    ON student_specialties (student_enrollment_id);

CREATE INDEX idx_student_specialties_subject_id
    ON student_specialties (subject_id);

-- Vérifier que la matière est marquée comme spécialité et que l'élève est en Première/Terminale.
CREATE OR REPLACE FUNCTION check_student_specialty_is_specialty_subject()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    is_specialty boolean;
    level_code varchar(20);
BEGIN
    SELECT s.is_specialty INTO is_specialty
      FROM subjects AS s
     WHERE s.id = NEW.subject_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La matière est introuvable.';
    END IF;

    IF NOT is_specialty THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La matière sélectionnée n''est pas une spécialité.';
    END IF;

    SELECT cl.code INTO level_code
      FROM student_enrollments AS se
      JOIN classes AS c ON c.id = se.class_id
      JOIN class_levels AS cl ON cl.id = c.class_level_id
     WHERE se.id = NEW.student_enrollment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'L''inscription de l''élève est introuvable.';
    END IF;

    IF level_code NOT IN ('PREMIERE', 'TERMINALE') THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Les spécialités ne sont disponibles que pour la Première et la Terminale.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_student_specialties_check_is_specialty
AFTER INSERT OR UPDATE ON student_specialties
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_student_specialty_is_specialty_subject();

-- Vérifier le nombre de spécialités par élève (2 à 4 selon le niveau).
CREATE OR REPLACE FUNCTION check_student_specialties_count()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    level_code varchar(20);
    count_specialties integer;
BEGIN
    SELECT cl.code INTO level_code
      FROM student_enrollments AS se
      JOIN classes AS c ON c.id = se.class_id
      JOIN class_levels AS cl ON cl.id = c.class_level_id
     WHERE se.id = NEW.student_enrollment_id;

    IF NOT FOUND THEN RETURN NEW; END IF;

    -- Nombres fixes pour Première (3) et Terminale (3).
    -- À adapter si besoin de flexibilité via une table class_level_constraints.
    IF level_code IN ('PREMIERE', 'TERMINALE') THEN
        SELECT count(*) INTO count_specialties
          FROM student_specialties
         WHERE student_enrollment_id = NEW.student_enrollment_id;

        IF count_specialties > 4 THEN
            RAISE EXCEPTION USING ERRCODE = '23514',
                MESSAGE = format(
                    'Un élève de %s ne peut pas choisir plus de 4 spécialités (actuellement : %s).',
                    level_code, count_specialties
                );
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_student_specialties_check_count
AFTER INSERT OR UPDATE ON student_specialties
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_student_specialties_count();

-- =========================================================
-- 5. INCOMPATIBILITÉS ENTRE SPÉCIALITÉS
-- =========================================================

CREATE TABLE specialty_incompatibilities (
    id uuid
        CONSTRAINT pk_specialty_incompatibilities PRIMARY KEY
        DEFAULT gen_random_uuid(),
    subject_id_1 uuid NOT NULL,
    subject_id_2 uuid NOT NULL,
    reason varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_specialty_incompatibilities_subject_1
        FOREIGN KEY (subject_id_1)
        REFERENCES subjects(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_specialty_incompatibilities_subject_2
        FOREIGN KEY (subject_id_2)
        REFERENCES subjects(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_specialty_incompatibilities_unique
        UNIQUE (
            LEAST(subject_id_1, subject_id_2),
            GREATEST(subject_id_1, subject_id_2)
        ),

    CONSTRAINT ck_specialty_incompatibilities_not_self
        CHECK (subject_id_1 <> subject_id_2),

    CONSTRAINT ck_specialty_incompatibilities_reason_not_blank
        CHECK (char_length(btrim(reason)) > 0)
);

-- Vérifier l'incompatibilité lors de l'ajout d'une spécialité.
CREATE OR REPLACE FUNCTION check_student_specialty_compatibility()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    incompatible_id uuid;
BEGIN
    SELECT si.subject_id_1
      INTO incompatible_id
      FROM specialty_incompatibilities AS si
      JOIN student_specialties AS ss
        ON (ss.subject_id = si.subject_id_1 OR ss.subject_id = si.subject_id_2)
     WHERE ss.student_enrollment_id = NEW.student_enrollment_id
       AND (si.subject_id_1 = NEW.subject_id OR si.subject_id_2 = NEW.subject_id)
     LIMIT 1;

    IF incompatible_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Cette spécialité est incompatible avec une autre déjà choisie par l''élève.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_student_specialties_check_compatibility
AFTER INSERT OR UPDATE ON student_specialties
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_student_specialty_compatibility();

-- =========================================================
-- 6. DROITS APPLICATIFS
-- =========================================================

GRANT SELECT ON TABLE
    teacher_assignments,
    assessments,
    grades,
    student_specialties,
    specialty_incompatibilities
TO blaise_app;

GRANT INSERT (teacher_id, class_subject_id, start_date, end_date)
    ON teacher_assignments TO blaise_app;
GRANT UPDATE (start_date, end_date) ON teacher_assignments TO blaise_app;

GRANT INSERT (teacher_assignment_id, title, description, assessment_date, maximum_score, coefficient)
    ON assessments TO blaise_app;
GRANT UPDATE (title, description, maximum_score, coefficient) ON assessments TO blaise_app;

GRANT INSERT (assessment_id, student_enrollment_id, result_type, score, justification_status, reviewed_by_account_id, reviewed_at)
    ON grades TO blaise_app;
GRANT UPDATE (result_type, score, justification_status, reviewed_by_account_id, reviewed_at)
    ON grades TO blaise_app;

GRANT INSERT (student_enrollment_id, subject_id)
    ON student_specialties TO blaise_app;
GRANT DELETE ON TABLE student_specialties TO blaise_app;

GRANT INSERT (subject_id_1, subject_id_2, reason)
    ON specialty_incompatibilities TO blaise_app;
GRANT UPDATE (reason) ON specialty_incompatibilities TO blaise_app;

-- Pas de DELETE sur évaluations, notes, affectations : données immutables une fois créées.
REVOKE DELETE ON TABLE
    teacher_assignments,
    assessments,
    grades,
    specialty_incompatibilities
FROM blaise_app;

COMMIT;