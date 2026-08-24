-- =========================================================
-- MIGRATION 003 : relations familiales et documents
-- =========================================================
-- Tables : student_guardians, document_types, documents, document_links
-- Règles : un contact principal par élève, catalogue documentaire générique,
--          liaison polymorphe document ↔ entité.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. RELATIONS FAMILLE
-- =========================================================

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

CREATE INDEX idx_student_guardians_student_id
    ON student_guardians (student_id);

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
-- 2. CATALOGUE DOCUMENTAIRE
-- =========================================================

CREATE TABLE document_types (
    id uuid
        CONSTRAINT pk_document_types PRIMARY KEY
        DEFAULT gen_random_uuid(),
    code varchar(50) NOT NULL,
    label varchar(100) NOT NULL,
    description text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_document_types_code UNIQUE (code),
    CONSTRAINT ck_document_types_code
        CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
    CONSTRAINT ck_document_types_label_not_blank
        CHECK (char_length(btrim(label)) > 0)
);

CREATE TABLE documents (
    id uuid
        CONSTRAINT pk_documents PRIMARY KEY
        DEFAULT gen_random_uuid(),
    document_type_id uuid NOT NULL,
    title varchar(150),
    storage_path varchar(500) NOT NULL,
    original_filename varchar(255) NOT NULL,
    mime_type varchar(100) NOT NULL,
    size_bytes bigint NOT NULL,
    sha256 char(64) NOT NULL,
    uploaded_by_account_id uuid NOT NULL,
    archived_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_documents_document_type
        FOREIGN KEY (document_type_id)
        REFERENCES document_types(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_documents_uploaded_by_account
        FOREIGN KEY (uploaded_by_account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_documents_storage_path UNIQUE (storage_path),
    CONSTRAINT ck_documents_title_not_blank
        CHECK (title IS NULL OR char_length(btrim(title)) > 0),
    CONSTRAINT ck_documents_storage_path_not_blank
        CHECK (char_length(btrim(storage_path)) > 0),
    CONSTRAINT ck_documents_original_filename_not_blank
        CHECK (char_length(btrim(original_filename)) > 0),
    CONSTRAINT ck_documents_mime_type_not_blank
        CHECK (char_length(btrim(mime_type)) > 0),
    CONSTRAINT ck_documents_size_positive
        CHECK (size_bytes > 0),
    CONSTRAINT ck_documents_sha256
        CHECK (sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX idx_documents_document_type_id
    ON documents (document_type_id);

CREATE INDEX idx_documents_uploaded_by_account_id
    ON documents (uploaded_by_account_id);

CREATE INDEX idx_documents_sha256
    ON documents (sha256);

CREATE TRIGGER trg_document_types_set_updated_at
BEFORE UPDATE ON document_types
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_documents_set_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- =========================================================
-- 3. LIAISON POLYMORPHE : DOCUMENT ↔ ENTITE (D-022)
-- =========================================================
-- Cette table permet de rattacher un document à n'importe quelle entité
-- sans créer une nouvelle FK par type d'entité.
-- entity_type contrôle les entités autorisées via CHECK.
-- =========================================================

CREATE TABLE document_links (
    id uuid
        CONSTRAINT pk_document_links PRIMARY KEY
        DEFAULT gen_random_uuid(),
    document_id uuid NOT NULL,
    entity_type varchar(50) NOT NULL,
    entity_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_document_links_document
        FOREIGN KEY (document_id)
        REFERENCES documents(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_document_links_entity_type
        CHECK (entity_type IN (
            'STUDENT',
            'ATTENDANCE_RECORD',
            'ASSESSMENT',
            'REPORT_CARD',
            'SCHOOL_YEAR'
        )),

    CONSTRAINT uq_document_links_document_entity
        UNIQUE (document_id, entity_type, entity_id)
);

CREATE INDEX idx_document_links_document_id
    ON document_links (document_id);

CREATE INDEX idx_document_links_entity
    ON document_links (entity_type, entity_id);

-- =========================================================
-- 4. TRIGGERS POUR REGLES METIER
-- =========================================================

-- Un document ne peut être lié à un élève que si ce dernier existe.
-- Les autres entités seront vérifiées lors de leur création.
CREATE OR REPLACE FUNCTION check_document_link_entity_exists()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE entity_count integer;
BEGIN
    IF NEW.entity_type = 'STUDENT' THEN
        SELECT count(*) INTO entity_count FROM students WHERE id = NEW.entity_id;
        IF entity_count = 0 THEN
            RAISE EXCEPTION USING ERRCODE = '23503',
                MESSAGE = 'L''élève lié au document n''existe pas.';
        END IF;
    END IF;
    -- Les autres entités seront vérifiées dans leurs propres triggers
    -- ou lors de leur création (absences, évaluations, bulletins).
    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER trg_document_links_check_entity
AFTER INSERT OR UPDATE ON document_links
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_document_link_entity_exists();

-- =========================================================
-- 5. DONNEES INITIALES
-- =========================================================

INSERT INTO document_types (code, label, description)
VALUES
    ('PROFILE_PHOTO', 'Photo de profil', 'Photo affichée dans un dossier utilisateur.'),
    ('ASSESSMENT_JUSTIFICATION', 'Justificatif d''absence à une évaluation', 'Document expliquant une absence à une évaluation.'),
    ('ATTENDANCE_JUSTIFICATION', 'Justificatif d''absence ou de retard', 'Document lié à un incident d''assiduité.'),
    ('REPORT_CARD', 'Bulletin scolaire', 'Version PDF d''un bulletin scolaire.'),
    ('ADMINISTRATIVE', 'Document administratif', 'Document administratif générique.'),
    ('OTHER', 'Autre document', 'Type de document non couvert par le catalogue courant.');

-- =========================================================
-- 6. DROITS APPLICATIFS
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

GRANT DELETE ON TABLE student_guardians TO blaise_app;

GRANT SELECT ON TABLE document_types, documents, document_links TO blaise_app;

GRANT INSERT (
    document_type_id,
    title,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    sha256,
    uploaded_by_account_id
) ON documents TO blaise_app;

GRANT UPDATE (
    title,
    archived_at
) ON documents TO blaise_app;

GRANT INSERT (document_id, entity_type, entity_id) ON document_links TO blaise_app;
GRANT DELETE ON TABLE document_links TO blaise_app;

REVOKE INSERT, UPDATE, DELETE ON TABLE document_types FROM blaise_app;
REVOKE DELETE ON TABLE documents FROM blaise_app;

COMMIT;