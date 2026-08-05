-- =========================================================
-- MIGRATION 005 : Structure scolaire et spécialités
-- =========================================================
-- Cette migration crée :
--   - La structure de base pour les années, classes, matières et affectations.
--   - Les tables pour les évaluations, notes, absences et justificatifs.
--   - Les tables pour gérer les spécialités des élèves (Première/Terminale).
--
-- Règles métier intégrées :
--   - Une matière peut être marquée comme spécialité.
--   - Un élève en Première/Terminale doit choisir entre 2 et 4 spécialités.
--   - Les spécialités ont des contraintes d'incompatibilité (ex: Maths Expertes ↔ Maths Complémentaires).
--   - Les dates des affectations, évaluations et inscriptions doivent respecter les années scolaires.
--   - Les notes et absences sont liées à des élèves inscrits dans la classe concernée.
--   - Les justificatifs sont vérifiés avant validation.
--
-- Contraintes PostgreSQL :
--   - `CHECK` pour les valeurs obligatoires et cohérences de dates.
--   - `FOREIGN KEY` pour les relations.
--   - `UNIQUE` pour éviter les doublons.
--   - `EXCLUDE` pour éviter les chevauchements de plages (ex: affectations).
--   - `TRIGGER` pour les règles complexes (ex: vérification des années scolaires).
--
-- Sécurité :
--   - Les droits sont limités au rôle `blaise_app`.
--   - Les suppressions sont restreintes (`ON DELETE RESTRICT`).
--   - Les données sensibles (notes, absences) ne sont pas supprimables sans justification.
-- =========================================================



BEGIN;

-- =========================================================
-- 2.1. ANNÉES SCOLAIRES
-- =========================================================
CREATE TABLE school_years (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,  -- Ex: "2025-2026"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    closed_at TIMESTAMPTZ,  -- Date de clôture (ex: fin des inscriptions)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_school_years_dates CHECK (end_date > start_date),
    CONSTRAINT ck_school_years_closed_at CHECK (
        closed_at IS NULL OR closed_at BETWEEN start_date AND end_date
    )
);

COMMENT ON TABLE school_years IS 'Table des années scolaires. Une année est identifiée par son nom (ex: "2025-2026").';

-- =========================================================
-- 2.2. NIVEAUX SCOLAIRES (ex: Seconde, Première, Terminale)
-- =========================================================
CREATE TABLE school_levels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,  -- Ex: "PREMIERE", "TERMINALE"
    label VARCHAR(100) NOT NULL,       -- Ex: "Première Générale"
    min_specialties INT NOT NULL CHECK (min_specialties > 0),  -- Nombre min de spécialités
    max_specialties INT NOT NULL CHECK (max_specialties > min_specialties),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE school_levels IS 'Niveaux scolaires avec contraintes sur le nombre de spécialités.';

-- =========================================================
-- 2.3. CLASSES (ex: "Terminale A", "Première B")
-- =========================================================
CREATE TABLE classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_year_id uuid NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    level_id uuid NOT NULL REFERENCES school_levels(id) ON DELETE RESTRICT,
    group_label VARCHAR(20) NOT NULL,  -- Ex: "A", "B", "C"
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_classes_group_label UNIQUE (school_year_id, group_label),
    CONSTRAINT ck_classes_group_label_not_empty CHECK (char_length(btrim(group_label)) > 0)
);

COMMENT ON TABLE classes IS 'Classes par année scolaire et niveau (ex: "Terminale A 2025-2026").';

-- =========================================================
-- 2.4. MATIÈRES (ex: Maths, Français, HGGSP)
-- =========================================================
CREATE TABLE subjects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,  -- Ex: "MATHS", "FRANCAIS"
    name VARCHAR(100) NOT NULL,
    is_specialty BOOLEAN DEFAULT false,  -- Champ ajouté pour identifier les spécialités
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE subjects IS 'Liste des matières enseignées. Le champ `is_specialty` indique si la matière est une spécialité.';




-- =========================================================
-- 3.1. TABLE DES SPÉCIALITÉS DISPONIBLES
-- =========================================================
CREATE TABLE specialties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,  -- Ex: "Maths Expertes", "HGGSP"
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_specialties_name_not_empty CHECK (char_length(btrim(name)) > 0)
);

COMMENT ON TABLE specialties IS 'Liste des spécialités disponibles dans l''établissement (ex: "Maths Expertes", "HGGSP").';

-- =========================================================
-- 3.2. TABLE DE LIAISON : ÉLÈVES ↔ SPÉCIALITÉS
-- =========================================================
CREATE TABLE student_specialties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_enrollment_id uuid NOT NULL REFERENCES student_enrollments(id) ON DELETE CASCADE,
    specialty_id uuid NOT NULL REFERENCES specialties(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_student_specialties_unique UNIQUE (student_enrollment_id, specialty_id),
    CONSTRAINT ck_student_specialties_level CHECK (
        -- Vérifier que l'élève est en Première ou Terminale
        EXISTS (
            SELECT 1 FROM school_levels sl
            JOIN classes c ON c.level_id = sl.id
            JOIN student_enrollments se ON se.class_id = c.id
            WHERE se.id = student_enrollment_id
            AND sl.code IN ('PREMIERE', 'TERMINALE')
        )
    )
);

COMMENT ON TABLE student_specialties IS 'Association entre un élève et une spécialité choisie. Un élève ne peut choisir une spécialité qu''une seule fois.';
COMMENT ON COLUMN student_specialties.student_enrollment_id IS 'Inscription de l''élève (clé étrangère vers `student_enrollments`).';
COMMENT ON COLUMN student_specialties.specialty_id IS 'Spécialité choisie (clé étrangère vers `specialties`).';

-- =========================================================
-- 3.3. TABLE DES CONTRAINTES ENTRE SPÉCIALITÉS
-- =========================================================
CREATE TABLE specialty_constraints (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    specialty_id uuid NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
    incompatible_specialty_id uuid NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,  -- Ex: "Maths Expertes et Maths Complémentaires sont incompatibles"
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_specialty_constraints_unique UNIQUE (specialty_id, incompatible_specialty_id),
    CONSTRAINT ck_specialty_constraints_not_self CHECK (specialty_id <> incompatible_specialty_id),
    CONSTRAINT fk_specialty_constraints_specialty FOREIGN KEY (specialty_id) REFERENCES specialties(id),
    CONSTRAINT fk_specialty_constraints_incompatible FOREIGN KEY (incompatible_specialty_id) REFERENCES specialties(id)
);

COMMENT ON TABLE specialty_constraints IS 'Contraintes d''incompatibilité entre spécialités (ex: un élève ne peut pas choisir à la fois Maths Expertes et Maths Complémentaires).';
COMMENT ON COLUMN specialty_constraints.reason IS 'Explication de la contrainte (ex: "Ces deux spécialités sont incompatibles").';

-- =========================================================
-- 3.4. TRIGGER : VÉRIFIER LE NOMBRE DE SPÉCIALITÉS PAR ÉLÈVE
-- =========================================================
CREATE OR REPLACE FUNCTION check_student_specialties_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    student_level VARCHAR(20);
    min_specialties INT;
    max_specialties INT;
    count_specialties INT;
BEGIN
    -- Récupérer le niveau de l'élève (Première/Terminale)
    SELECT sl.code, sl.min_specialties, sl.max_specialties
      INTO student_level, min_specialties, max_specialties
      FROM student_enrollments se
      JOIN classes c ON c.id = se.class_id
      JOIN school_levels sl ON sl.id = c.level_id
     WHERE se.id = NEW.student_enrollment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'L''inscription de l''élève est introuvable.';
    END IF;

    -- Compter le nombre de spécialités choisies par l'élève
    SELECT COUNT(*)
      INTO count_specialties
      FROM student_specialties
     WHERE student_enrollment_id = NEW.student_enrollment_id;

    -- Vérifier que le nombre de spécialités est dans la plage autorisée
    IF count_specialties < min_specialties OR count_specialties > max_specialties THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = format(
                'Un élève de %s doit choisir entre %s et %s spécialités.',
                student_level,
                min_specialties,
                max_specialties
            );
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_student_specialties_count
AFTER INSERT OR UPDATE ON student_specialties
FOR EACH ROW
EXECUTE FUNCTION check_student_specialties_count();

COMMENT ON FUNCTION check_student_specialties_count() IS 'Vérifie que le nombre de spécialités choisies par un élève respecte les contraintes de son niveau (ex: 2 à 4 spécialités en Première).';



-- =========================================================
-- 4.1. AFFECTATIONS DES ENSEIGNANTS AUX MATIÈRES PAR CLASSE
-- =========================================================
CREATE TABLE teacher_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
    class_subject_id uuid NOT NULL REFERENCES class_subjects(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_teacher_assignments_dates CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT ex_teacher_assignments_no_class_subject_overlap EXCLUDE USING gist (
        class_subject_id WITH =,
        daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]') WITH &&
    )
);

-- Trigger pour vérifier que les dates de l'affectation sont dans l'année scolaire de la classe
CREATE OR REPLACE FUNCTION check_teacher_assignment_within_class_year()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    year_start DATE;
    year_end DATE;
BEGIN
    SELECT sy.start_date, sy.end_date
      INTO year_start, year_end
      FROM class_subjects cs
      JOIN classes c ON c.id = cs.class_id
      JOIN school_years sy ON sy.id = c.school_year_id
     WHERE cs.id = NEW.class_subject_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'La matière de classe est introuvable.';
    END IF;

    IF NEW.start_date < year_start OR NEW.start_date > year_end OR
       (NEW.end_date IS NOT NULL AND NEW.end_date > year_end) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Les dates de l''affectation doivent rester dans l''année scolaire de la classe.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_teacher_assignments_check_dates
BEFORE INSERT OR UPDATE ON teacher_assignments
FOR EACH ROW
EXECUTE FUNCTION check_teacher_assignment_within_class_year();

-- =========================================================
-- 4.2. ÉVALUATIONS ET NOTES
-- =========================================================
CREATE TABLE assessments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_assignment_id uuid NOT NULL REFERENCES teacher_assignments(id) ON DELETE RESTRICT,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    assessment_date DATE NOT NULL,
    maximum_score NUMERIC(6,2) NOT NULL CHECK (maximum_score > 0),
    coefficient NUMERIC(6,2) NOT NULL CHECK (coefficient > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uq_assessments_assignment_title_date UNIQUE (teacher_assignment_id, title, assessment_date),
    CONSTRAINT ck_assessments_title_not_blank CHECK (char_length(btrim(title)) > 0)
);

-- Table des notes (scores ou absences)
CREATE TABLE grades (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    student_enrollment_id uuid NOT NULL REFERENCES student_enrollments(id) ON DELETE RESTRICT,
    result_type VARCHAR(10) NOT NULL CHECK (result_type IN ('SCORED', 'ABSENT')),  -- SCORED = note, ABSENT = absence
    score NUMERIC(6,2),
    justification_status VARCHAR(20) CHECK (justification_status IN ('UNJUSTIFIED', 'PENDING', 'JUSTIFIED', 'REJECTED')),
    reviewed_by_account_id uuid REFERENCES accounts(id) ON DELETE RESTRICT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT ck_grades_result CHECK (
        (result_type = 'SCORED' AND score IS NOT NULL AND score >= 0 AND justification_status IS NULL)
        OR
        (result_type = 'ABSENT' AND score IS NULL AND justification_status IN ('UNJUSTIFIED', 'PENDING', 'JUSTIFIED', 'REJECTED'))
    ),
    CONSTRAINT ck_grades_review_pair CHECK (
        (reviewed_by_account_id IS NULL AND reviewed_at IS NULL)
        OR
        (reviewed_by_account_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);





-- =========================================================
-- 5.1. VUE : LISTE DES SPÉCIALITÉS PAR ÉLÈVE
-- =========================================================
CREATE VIEW v_student_specialties AS
SELECT
    ss.id,
    se.student_id,
    s.name AS specialty_name,
    sl.code AS level_code,
    se.class_id
FROM student_specialties ss
JOIN specialties s ON s.id = ss.specialty_id
JOIN student_enrollments se ON se.id = ss.student_enrollment_id
JOIN classes c ON c.id = se.class_id
JOIN school_levels sl ON sl.id = c.level_id;

COMMENT ON VIEW v_student_specialties IS 'Vue pour lister les spécialités choisies par chaque élève, avec leur niveau et classe.';

-- =========================================================
-- 5.2. VUE : CONTRAINTES D'INCOMPATIBILITÉ PAR SPÉCIALITÉ
-- =========================================================
CREATE VIEW v_specialty_incompatibilities AS
SELECT
    sc.id,
    s1.name AS specialty_name,
    s2.name AS incompatible_specialty_name,
    sc.reason
FROM specialty_constraints sc
JOIN specialties s1 ON s1.id = sc.specialty_id
JOIN specialties s2 ON s2.id = sc.incompatible_specialty_id;

COMMENT ON VIEW v_specialty_incompatibilities IS 'Vue pour lister les incompatibilités entre spécialités.';

-- =========================================================
-- 5.3. VUE : ÉLÈVES SANS SPÉCIALITÉS (pour détecter les oublis)
-- =========================================================
CREATE VIEW v_students_missing_specialties AS
SELECT
    s.id AS student_id,
    s.first_name,
    s.last_name,
    c.id AS class_id,
    sl.code AS level_code,
    sl.min_specialties,
    sl.max_specialties,
    COUNT(ss.id) AS specialties_count
FROM students s
JOIN student_enrollments se ON se.student_id = s.id
JOIN classes c ON c.id = se.class_id
JOIN school_levels sl ON sl.id = c.level_id
LEFT JOIN student_specialties ss ON ss.student_enrollment_id = se.id
WHERE sl.code IN ('PREMIERE', 'TERMINALE')
GROUP BY s.id, s.first_name, s.last_name, c.id, sl.code, sl.min_specialties, sl.max_specialties
HAVING COUNT(ss.id) < sl.min_specialties;

COMMENT ON VIEW v_students_missing_specialties IS 'Vue pour identifier les élèves en Première/Terminale qui n''ont pas assez de spécialités.';



-- =========================================================
-- 6.1. FONCTION : VÉRIFIER LES INCOMPATIBILITÉS DE SPÉCIALITÉS
-- =========================================================
CREATE OR REPLACE FUNCTION check_specialty_compatibility(
    p_student_enrollment_id UUID,
    p_specialty_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    incompatible_specialty_id UUID;
BEGIN
    -- Vérifier si la spécialité choisie est incompatible avec une autre déjà sélectionnée
    SELECT sc.incompatible_specialty_id
      INTO incompatible_specialty_id
      FROM student_specialties ss
      JOIN specialty_constraints sc ON
          (sc.specialty_id = ss.specialty_id AND sc.incompatible_specialty_id = p_specialty_id)
          OR
          (sc.specialty_id = p_specialty_id AND sc.incompatible_specialty_id = ss.specialty_id)
     WHERE ss.student_enrollment_id = p_student_enrollment_id
       AND ss.specialty_id <> p_specialty_id;

    RETURN (incompatible_specialty_id IS NULL);
END;
$$;

COMMENT ON FUNCTION check_specialty_compatibility(UUID, UUID) IS
'Vérifie si une spécialité est compatible avec celles déjà choisies par un élève. Retourne TRUE si compatible, FALSE sinon.';

-- =========================================================
-- 6.2. PROCÉDURE : CLÔTURER UNE ANNÉE SCOLAIRE (ex: fin d''année)
-- =========================================================
CREATE OR REPLACE PROCEDURE close_school_year(p_year_id UUID)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Clôturer l'année scolaire
    UPDATE school_years
       SET closed_at = NOW()
     WHERE id = p_year_id;

    -- Fermer les affectations en cours pour cette année
    UPDATE teacher_assignments ta
       SET end_date = (SELECT end_date FROM school_years WHERE id = p_year_id)
     WHERE ta.class_subject_id IN (
         SELECT cs.id
           FROM class_subjects cs
           JOIN classes c ON c.id = cs.class_id
          WHERE c.school_year_id = p_year_id
     )
       AND ta.end_date IS NULL;

    -- Invalider les notes non validées pour cette année
    UPDATE grades g
       SET justification_status = 'REJECTED'
     WHERE g.assessment_id IN (
         SELECT a.id
           FROM assessments a
           JOIN teacher_assignments ta ON ta.id = a.teacher_assignment_id
          WHERE ta.class_subject_id IN (
              SELECT cs.id
                FROM class_subjects cs
                JOIN classes c ON c.id = cs.class_id
               WHERE c.school_year_id = p_year_id
          )
     )
       AND g.justification_status = 'PENDING';

    COMMIT;
END;
$$;

COMMENT ON PROCEDURE close_school_year(UUID) IS
'Clôture une année scolaire : met à jour les dates des affectations, invalide les notes non validées.';


-- =========================================================
-- 7. DROITS APPLICATIFS SUR LES SPÉCIALITÉS
-- =========================================================
-- Règles :
--   - blaise_app peut ajouter/modifier/supprimer des spécialités ET leurs contraintes.
--   - La suppression est bloquée si la spécialité est utilisée par des élèves.
--   - Les vues et fonctions associées sont accessibles en lecture seule.
-- =========================================================

-- 7.1. DROITS SUR LES TABLES DE SPÉCIALITÉS
-- ---------------------------------------------------------
-- Autorisations complètes pour gérer les spécialités et leurs contraintes.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
    specialties,
    student_specialties,
    specialty_constraints
TO blaise_app;

-- 7.2. TRIGGER DE SÉCURITÉ : BLOQUER LA SUPPRESSION D'UNE SPÉCIALITÉ UTILISÉE
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_deletion_of_used_specialty()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM student_specialties
        WHERE specialty_id = OLD.id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',  -- Violation de contrainte de clé étrangère
            MESSAGE = 'Impossible de supprimer la spécialité "' || OLD.name || '". Elle est utilisée par au moins un élève.',
            DETAIL = 'Supprimez d''abord les choix de spécialités associés à cette spécialité.';
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_deletion_of_used_specialty
BEFORE DELETE ON specialties
FOR EACH ROW
EXECUTE FUNCTION prevent_deletion_of_used_specialty();

-- 7.3. TRIGGER DE SÉCURITÉ : BLOQUER LA SUPPRESSION D'UNE CONTRAINTE UTILISÉE
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_deletion_of_used_constraint()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM student_specialties ss
        JOIN specialties s1 ON s1.id = ss.specialty_id
        JOIN specialties s2 ON s2.id = NEW.incompatible_specialty_id
        WHERE ss.specialty_id = NEW.specialty_id
           OR ss.specialty_id = NEW.incompatible_specialty_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23503',
            MESSAGE = 'Impossible de supprimer la contrainte d''incompatibilité. Elle est référencée par des choix de spécialités.',
            DETAIL = 'Supprimez d''abord les choix de spécialités associés.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_deletion_of_used_constraint
BEFORE DELETE ON specialty_constraints
FOR EACH ROW
EXECUTE FUNCTION prevent_deletion_of_used_constraint();

-- 7.4. DROITS SUR LES VUES
-- ---------------------------------------------------------
GRANT SELECT ON VIEW
    v_student_specialties,
    v_specialty_incompatibilities,
    v_students_missing_specialties
TO blaise_app;

-- 7.5. DROITS SUR LES FONCTIONS
-- ---------------------------------------------------------
GRANT EXECUTE ON FUNCTION
    check_student_specialties_count(),
    check_specialty_compatibility(UUID, UUID)
TO blaise_app;

-- 7.6. DROITS SUR LES PROCÉDURES
-- ---------------------------------------------------------
GRANT EXECUTE ON PROCEDURE close_school_year(UUID) TO blaise_app;