-- =========================================================
-- 030 - DONNEES DE TEST POUR LA MIGRATION 003
-- Relations familiales et documents
-- =========================================================
-- Dépend de :
--   001_db_access.sql
--   002_accounts_and_profiles.sql
--   003_relationships_and_documents.sql
--   020_accounts_and_profiles_test_data.sql
--
-- Script idempotent : il peut être rejoué sans doublons.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. LIENS ELEVES ↔ RESPONSABLES
-- =========================================================
-- Chaque élève reçoit un responsable principal/légal.
-- Les relations alternent entre FATHER et MOTHER.

WITH ordered_students AS (
    SELECT
        student.id,
        row_number() OVER (
            ORDER BY account.registration_number
        ) AS row_number
    FROM students AS student
    JOIN accounts AS account
        ON account.id = student.account_id
    WHERE account.registration_number ~ '^u[0-9]{6}$'
),
ordered_guardians AS (
    SELECT
        guardian.id,
        row_number() OVER (
            ORDER BY account.registration_number
        ) AS row_number
    FROM guardians AS guardian
    JOIN accounts AS account
        ON account.id = guardian.account_id
    WHERE account.registration_number ~ '^p[0-9]{6}$'
)
INSERT INTO student_guardians (
    student_id,
    guardian_id,
    relationship_type,
    relationship_details,
    is_legal_guardian,
    is_primary_contact,
    is_emergency_contact
)
SELECT
    student.id,
    guardian.id,
    CASE
        WHEN student.row_number % 2 = 0 THEN 'MOTHER'
        ELSE 'FATHER'
    END,
    NULL,
    true,
    true,
    true
FROM ordered_students AS student
JOIN ordered_guardians AS guardian
    ON guardian.row_number = student.row_number
ON CONFLICT (student_id, guardian_id) DO NOTHING;


-- =========================================================
-- 2. EXEMPLE D'UN DEUXIEME RESPONSABLE
-- =========================================================
-- L'élève u000001 reçoit un second responsable.
-- Il n'est PAS contact principal afin de respecter la contrainte :
-- un seul contact principal par élève.

INSERT INTO student_guardians (
    student_id,
    guardian_id,
    relationship_type,
    relationship_details,
    is_legal_guardian,
    is_primary_contact,
    is_emergency_contact
)
SELECT
    student.id,
    guardian.id,
    'MOTHER',
    NULL,
    true,
    false,
    false
FROM students AS student
JOIN accounts AS student_account
    ON student_account.id = student.account_id
JOIN guardians AS guardian
    ON guardian.account_id = (
        SELECT id
        FROM accounts
        WHERE registration_number = 'p000002'
    )
WHERE student_account.registration_number = 'u000001'
ON CONFLICT (student_id, guardian_id) DO NOTHING;


-- =========================================================
-- 3. EXEMPLE DE RELATION "OTHER"
-- =========================================================
-- Utilise le responsable sans compte créé dans 020.
-- relationship_details est obligatoire avec OTHER.

INSERT INTO student_guardians (
    student_id,
    guardian_id,
    relationship_type,
    relationship_details,
    is_legal_guardian,
    is_primary_contact,
    is_emergency_contact
)
SELECT
    student.id,
    guardian.id,
    'OTHER',
    'Oncle',
    false,
    false,
    true
FROM students AS student
JOIN accounts AS student_account
    ON student_account.id = student.account_id
CROSS JOIN guardians AS guardian
WHERE student_account.registration_number = 'u000002'
  AND guardian.email = 'mamadou.soumah.sans.compte@blaiseconnect.test'
ON CONFLICT (student_id, guardian_id) DO NOTHING;


-- =========================================================
-- 4. DOCUMENTS ADMINISTRATIFS DE TEST
-- =========================================================
-- Les fichiers physiques ne sont pas créés ici.
-- Seules leurs métadonnées sont enregistrées en base.

INSERT INTO documents (
    document_type_id,
    title,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    sha256,
    uploaded_by_account_id
)
SELECT
    document_type.id,
    'Acte de naissance - Abdoulaye Diallo',
    'students/u000001/documents/acte-naissance.pdf',
    'acte-naissance-abdoulaye-diallo.pdf',
    'application/pdf',
    245760,
    repeat('1', 64),
    administrator.id
FROM document_types AS document_type
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator
WHERE document_type.code = 'ADMINISTRATIVE'
ON CONFLICT (storage_path) DO NOTHING;


INSERT INTO documents (
    document_type_id,
    title,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    sha256,
    uploaded_by_account_id
)
SELECT
    document_type.id,
    'Photo de profil - Abdoulaye Diallo',
    'students/u000001/profile/photo.jpg',
    'photo-abdoulaye-diallo.jpg',
    'image/jpeg',
    153600,
    repeat('2', 64),
    administrator.id
FROM document_types AS document_type
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator
WHERE document_type.code = 'PROFILE_PHOTO'
ON CONFLICT (storage_path) DO NOTHING;


INSERT INTO documents (
    document_type_id,
    title,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    sha256,
    uploaded_by_account_id
)
SELECT
    document_type.id,
    'Document administratif - Hawa Bah',
    'students/u000002/documents/document-administratif.pdf',
    'document-administratif-hawa-bah.pdf',
    'application/pdf',
    196608,
    repeat('3', 64),
    administrator.id
FROM document_types AS document_type
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator
WHERE document_type.code = 'ADMINISTRATIVE'
ON CONFLICT (storage_path) DO NOTHING;


-- =========================================================
-- 5. LIAISONS DOCUMENT ↔ ELEVE
-- =========================================================
-- À ce stade de la base, STUDENT est l'entité polymorphe sûre à tester :
-- la migration 003 vérifie explicitement son existence.
-- Les liens vers ASSESSMENT, ATTENDANCE_RECORD, REPORT_CARD et SCHOOL_YEAR
-- seront ajoutés dans les jeux de données correspondant à leurs migrations.

INSERT INTO document_links (
    document_id,
    entity_type,
    entity_id
)
SELECT
    document.id,
    'STUDENT',
    student.id
FROM documents AS document
JOIN students AS student
    ON student.account_id = (
        SELECT id
        FROM accounts
        WHERE registration_number = 'u000001'
    )
WHERE document.storage_path IN (
    'students/u000001/documents/acte-naissance.pdf',
    'students/u000001/profile/photo.jpg'
)
ON CONFLICT (document_id, entity_type, entity_id) DO NOTHING;


INSERT INTO document_links (
    document_id,
    entity_type,
    entity_id
)
SELECT
    document.id,
    'STUDENT',
    student.id
FROM documents AS document
JOIN students AS student
    ON student.account_id = (
        SELECT id
        FROM accounts
        WHERE registration_number = 'u000002'
    )
WHERE document.storage_path =
    'students/u000002/documents/document-administratif.pdf'
ON CONFLICT (document_id, entity_type, entity_id) DO NOTHING;


-- =========================================================
-- 6. VERIFICATIONS OPTIONNELLES
-- =========================================================
-- À exécuter manuellement après l'initialisation si nécessaire :
--
-- SELECT * FROM student_guardians;
-- SELECT code, label FROM document_types ORDER BY code;
-- SELECT title, storage_path, archived_at FROM documents;
-- SELECT entity_type, entity_id FROM document_links;

COMMIT;
