-- =========================================================
-- MIGRATION 006 : Bulletins scolaires
-- =========================================================
-- Tables : report_cards, report_card_subjects, report_card_grades
-- Immuabilité : un bulletin validé ne peut plus être modifié.
-- Suppression contrôlée : réservée aux années OUVERTES et NON clôturées.
-- D-025 à D-027 intégrées.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. BULLETINS SCOLAIRES
-- =========================================================

CREATE TABLE report_cards (
    id uuid
        CONSTRAINT pk_report_cards PRIMARY KEY
        DEFAULT gen_random_uuid(),
    student_enrollment_id uuid NOT NULL,
    reporting_period_id uuid NOT NULL,
    general_average numeric(6, 2) NOT NULL,
    overall_comment text,
    generated_by_account_id uuid NOT NULL,
    generated_at timestamptz NOT NULL DEFAULT now(),
    validated_by_account_id uuid,
    validated_at timestamptz,
    pdf_document_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_report_cards_student_enrollment
        FOREIGN KEY (student_enrollment_id)
        REFERENCES student_enrollments(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_report_cards_reporting_period
        FOREIGN KEY (reporting_period_id)
        REFERENCES reporting_periods(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_report_cards_generated_by_account
        FOREIGN KEY (generated_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_report_cards_validated_by_account
        FOREIGN KEY (validated_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_report_cards_pdf_document
        FOREIGN KEY (pdf_document_id)
        REFERENCES documents(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_report_cards_enrollment_period
        UNIQUE (student_enrollment_id, reporting_period_id),

    CONSTRAINT uq_report_cards_pdf_document
        UNIQUE (pdf_document_id),

    CONSTRAINT ck_report_cards_general_average
        CHECK (general_average >= 0 AND general_average <= 20),

    CONSTRAINT ck_report_cards_validation_pair
        CHECK (
            (validated_by_account_id IS NULL AND validated_at IS NULL)
            OR
            (validated_by_account_id IS NOT NULL AND validated_at IS NOT NULL)
        ),

    CONSTRAINT ck_report_cards_validation_date
        CHECK (validated_at IS NULL OR validated_at >= generated_at)
);

CREATE INDEX idx_report_cards_student_enrollment_id
    ON report_cards (student_enrollment_id);

CREATE INDEX idx_report_cards_reporting_period_id
    ON report_cards (reporting_period_id);

CREATE INDEX idx_report_cards_generated_by_account_id
    ON report_cards (generated_by_account_id);

CREATE INDEX idx_report_cards_validated_by_account_id
    ON report_cards (validated_by_account_id)
    WHERE validated_by_account_id IS NOT NULL;

CREATE INDEX idx_report_cards_pdf_document_id
    ON report_cards (pdf_document_id)
    WHERE pdf_document_id IS NOT NULL;

-- =========================================================
-- 2. MATIÈRES ET NOTES DU BULLETIN
-- =========================================================

CREATE TABLE report_card_subjects (
    report_card_id uuid NOT NULL,
    class_subject_id uuid NOT NULL,
    subject_average numeric(6, 2) NOT NULL,
    applied_coefficient numeric(6, 2) NOT NULL,
    teacher_comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_report_card_subjects
        PRIMARY KEY (report_card_id, class_subject_id),

    CONSTRAINT fk_report_card_subjects_report_card
        FOREIGN KEY (report_card_id)
        REFERENCES report_cards(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_report_card_subjects_class_subject
        FOREIGN KEY (class_subject_id)
        REFERENCES class_subjects(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_report_card_subjects_average
        CHECK (subject_average >= 0 AND subject_average <= 20),

    CONSTRAINT ck_report_card_subjects_coefficient
        CHECK (applied_coefficient > 0)
);

CREATE INDEX idx_report_card_subjects_class_subject_id
    ON report_card_subjects (class_subject_id);

CREATE TABLE report_card_grades (
    report_card_id uuid NOT NULL,
    grade_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_report_card_grades
        PRIMARY KEY (report_card_id, grade_id),

    CONSTRAINT fk_report_card_grades_report_card
        FOREIGN KEY (report_card_id)
        REFERENCES report_cards(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_report_card_grades_grade
        FOREIGN KEY (grade_id)
        REFERENCES grades(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_report_card_grades_grade_id
    ON report_card_grades (grade_id);

-- =========================================================
-- 3. CONTRÔLE DE COHÉRENCE ET D'IMMUABILITÉ
-- =========================================================

-- Vérifier que l'inscription et la période appartiennent à la même année.
CREATE OR REPLACE FUNCTION check_report_card_context()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE enrollment_year_id uuid; period_year_id uuid; document_type_code varchar(50);
BEGIN
    SELECT sy.id INTO enrollment_year_id
      FROM student_enrollments AS se
      JOIN classes AS c ON c.id = se.class_id
      JOIN school_years AS sy ON sy.id = c.school_year_id
     WHERE se.id = NEW.student_enrollment_id;

    SELECT period.school_year_id INTO period_year_id
      FROM reporting_periods AS period
     WHERE period.id = NEW.reporting_period_id;

    IF enrollment_year_id IS NULL OR period_year_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'L''inscription ou la période du bulletin est introuvable.';
    END IF;

    IF enrollment_year_id IS DISTINCT FROM period_year_id THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'L''inscription et la période du bulletin doivent appartenir à la même année.';
    END IF;

    -- Vérifier le PDF si fourni.
    IF NEW.pdf_document_id IS NOT NULL THEN
        SELECT dt.code INTO document_type_code
          FROM documents AS d
          JOIN document_types AS dt ON dt.id = d.document_type_id
         WHERE d.id = NEW.pdf_document_id;

        IF document_type_code IS DISTINCT FROM 'REPORT_CARD' THEN
            RAISE EXCEPTION USING ERRCODE = '23514',
                MESSAGE = 'Le PDF du bulletin doit utiliser le type de document REPORT_CARD.';
        END IF;

        IF EXISTS (SELECT 1 FROM documents WHERE id = NEW.pdf_document_id AND archived_at IS NOT NULL) THEN
            RAISE EXCEPTION USING ERRCODE = '23514',
                MESSAGE = 'Un document archivé ne peut pas devenir le PDF du bulletin.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_report_cards_check_context
AFTER INSERT OR UPDATE ON report_cards
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_report_card_context();

-- Vérifier que la matière du bulletin appartient à la classe de l'élève.
CREATE OR REPLACE FUNCTION check_report_card_subject_context()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE expected_class_id uuid; actual_class_id uuid;
BEGIN
    SELECT c.id INTO expected_class_id
      FROM student_enrollments AS se
      JOIN classes AS c ON c.id = se.class_id
      JOIN report_cards AS rc ON rc.student_enrollment_id = se.id
     WHERE rc.id = NEW.report_card_id;

    SELECT cs.class_id INTO actual_class_id
      FROM class_subjects AS cs
     WHERE cs.id = NEW.class_subject_id;

    IF expected_class_id IS NULL OR actual_class_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'Le bulletin ou la matière de classe est introuvable.';
    END IF;

    IF expected_class_id IS DISTINCT FROM actual_class_id THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La matière du bulletin doit appartenir à la classe de l''élève.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_report_card_subjects_check_context
AFTER INSERT OR UPDATE ON report_card_subjects
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_report_card_subject_context();

-- Vérifier que la note appartient à l'élève, sa classe et sa période.
CREATE OR REPLACE FUNCTION check_report_card_grade_context()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    expected_enrollment_id uuid;
    expected_class_id uuid;
    period_start date;
    period_end date;
    actual_enrollment_id uuid;
    actual_class_id uuid;
    evaluation_date date;
BEGIN
    SELECT se.id, c.id, rp.start_date, rp.end_date
      INTO expected_enrollment_id, expected_class_id, period_start, period_end
      FROM report_cards AS rc
      JOIN student_enrollments AS se ON se.id = rc.student_enrollment_id
      JOIN classes AS c ON c.id = se.class_id
      JOIN reporting_periods AS rp ON rp.id = rc.reporting_period_id
     WHERE rc.id = NEW.report_card_id;

    SELECT gr.student_enrollment_id, cs.class_id, a.assessment_date
      INTO actual_enrollment_id, actual_class_id, evaluation_date
      FROM grades AS gr
      JOIN assessments AS a ON a.id = gr.assessment_id
      JOIN teacher_assignments AS ta ON ta.id = a.teacher_assignment_id
      JOIN class_subjects AS cs ON cs.id = ta.class_subject_id
     WHERE gr.id = NEW.grade_id;

    IF expected_enrollment_id IS NULL OR actual_enrollment_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'Le bulletin ou la note utilisée est introuvable.';
    END IF;

    IF expected_enrollment_id IS DISTINCT FROM actual_enrollment_id
       OR expected_class_id IS DISTINCT FROM actual_class_id
       OR evaluation_date NOT BETWEEN period_start AND period_end
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La note utilisée doit appartenir au bon élève, à sa classe et à la période du bulletin.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_report_card_grades_check_context
AFTER INSERT OR UPDATE ON report_card_grades
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_report_card_grade_context();

-- Immuabilité : un bulletin validé ne peut pas être modifié ou supprimé.
CREATE OR REPLACE FUNCTION protect_validated_report_card()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.validated_at IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Un bulletin validé est immuable.';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_report_cards_10_protect_validated
BEFORE UPDATE OR DELETE ON report_cards
FOR EACH ROW EXECUTE FUNCTION protect_validated_report_card();

-- Immuabilité : les lignes d'un bulletin validé ne peuvent pas être modifiées.
CREATE OR REPLACE FUNCTION protect_validated_report_card_line()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_report_card_id uuid;
BEGIN
    target_report_card_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.report_card_id ELSE NEW.report_card_id END;

    IF EXISTS (SELECT 1 FROM report_cards WHERE id = target_report_card_id AND validated_at IS NOT NULL) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Les lignes d''un bulletin validé sont immuables.';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_report_card_subjects_10_protect_validated
BEFORE INSERT OR UPDATE OR DELETE ON report_card_subjects
FOR EACH ROW EXECUTE FUNCTION protect_validated_report_card_line();

CREATE TRIGGER trg_report_card_grades_10_protect_validated
BEFORE INSERT OR UPDATE OR DELETE ON report_card_grades
FOR EACH ROW EXECUTE FUNCTION protect_validated_report_card_line();

-- Immuabilité : les notes utilisées dans un bulletin validé ne peuvent pas être modifiées.
CREATE OR REPLACE FUNCTION protect_grade_used_by_validated_report_card()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM report_card_grades AS rcg
        JOIN report_cards AS rc ON rc.id = rcg.report_card_id
         WHERE rcg.grade_id = OLD.id AND rc.validated_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Une note utilisée dans un bulletin validé est immuable.';
    END IF;
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_grades_10_protect_validated_report_card
BEFORE UPDATE OR DELETE ON grades
FOR EACH ROW EXECUTE FUNCTION protect_grade_used_by_validated_report_card();

CREATE TRIGGER trg_report_cards_set_updated_at
BEFORE UPDATE ON report_cards
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_report_card_subjects_set_updated_at
BEFORE UPDATE ON report_card_subjects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 4. AUDIT DE SUPPRESSION D'ANNÉE OUVERTE
-- =========================================================

CREATE TABLE school_year_deletion_audits (
    id uuid
        CONSTRAINT pk_school_year_deletion_audits PRIMARY KEY
        DEFAULT gen_random_uuid(),
    school_year_id uuid NOT NULL,
    school_year_name varchar(20) NOT NULL,
    deleted_by_account_id uuid NOT NULL,
    deleted_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_school_year_deletion_audits_deleted_by_account
        FOREIGN KEY (deleted_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_school_year_deletion_audits_school_year_id
    ON school_year_deletion_audits (school_year_id);

CREATE INDEX idx_school_year_deletion_audits_deleted_at
    ON school_year_deletion_audits (deleted_at);

-- =========================================================
-- 5. DROITS APPLICATIFS
-- =========================================================

GRANT SELECT ON TABLE
    report_cards,
    report_card_subjects,
    report_card_grades,
    school_year_deletion_audits
TO blaise_app;

GRANT INSERT (
    student_enrollment_id,
    reporting_period_id,
    general_average,
    overall_comment,
    generated_by_account_id,
    generated_at,
    pdf_document_id
) ON report_cards TO blaise_app;

GRANT UPDATE (
    general_average,
    overall_comment,
    validated_by_account_id,
    validated_at,
    pdf_document_id
) ON report_cards TO blaise_app;

GRANT INSERT (
    report_card_id,
    class_subject_id,
    subject_average,
    applied_coefficient,
    teacher_comment
) ON report_card_subjects TO blaise_app;

GRANT UPDATE (
    subject_average,
    applied_coefficient,
    teacher_comment
) ON report_card_subjects TO blaise_app;

GRANT INSERT (report_card_id, grade_id)
    ON report_card_grades TO blaise_app;

-- Pas de DELETE sur les bulletins, matières ou notes du bulletin : données historiques.
REVOKE DELETE ON TABLE
    report_cards,
    report_card_subjects,
    report_card_grades
FROM blaise_app;

COMMIT;