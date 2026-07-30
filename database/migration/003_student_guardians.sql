-- =========================================================
-- MIGRATION 003 : responsables d'élèves
-- =========================================================
-- Table de liaison entre un élève et ses responsables.
-- Le dossier du responsable reste dans guardians.
-- =========================================================

BEGIN;

CREATE TABLE student_guardians (
    student_id uuid NOT NULL,
    guardian_id uuid NOT NULL,
    relationship_type varchar(10) NOT NULL,
    relationship_details varchar(100),
    is_legal_guardian boolean NOT NULL DEFAULT false,
    is_primary_contact boolean NOT NULL DEFAULT false,
    is_emergency_contact boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pk_student_guardians
        PRIMARY KEY (student_id, guardian_id),

    CONSTRAINT fk_student_guardians_student
        FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_student_guardians_guardian
        FOREIGN KEY (guardian_id)
        REFERENCES guardians(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_student_guardians_relationship_type
        CHECK (relationship_type IN ('FATHER', 'MOTHER', 'OTHER')),

    CONSTRAINT ck_student_guardians_relationship_details
        CHECK (
            (
                relationship_type = 'OTHER'
                AND relationship_details IS NOT NULL
                AND char_length(btrim(relationship_details)) > 0
            )
            OR
            (
                relationship_type IN ('FATHER', 'MOTHER')
                AND relationship_details IS NULL
            )
        )
);

CREATE INDEX idx_student_guardians_guardian_id
    ON student_guardians (guardian_id);

-- Un seul contact principal par élève.
CREATE UNIQUE INDEX uq_student_guardians_one_primary_contact
    ON student_guardians (student_id)
    WHERE is_primary_contact = true;

CREATE TRIGGER trg_student_guardians_set_updated_at
BEFORE UPDATE ON student_guardians
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- DROITS APPLICATIFS
-- =========================================================

GRANT SELECT ON TABLE student_guardians TO blaise_app;

GRANT INSERT (
    student_id,
    guardian_id,
    relationship_type,
    relationship_details,
    is_legal_guardian,
    is_primary_contact,
    is_emergency_contact
) ON student_guardians TO blaise_app;

GRANT UPDATE (
    relationship_type,
    relationship_details,
    is_legal_guardian,
    is_primary_contact,
    is_emergency_contact
) ON student_guardians TO blaise_app;

-- DELETE retire uniquement l'association, pas les dossiers liés.
GRANT DELETE ON TABLE student_guardians TO blaise_app;

COMMIT;
