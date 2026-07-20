-- ========================================
-- MIGRATION 001 : Comptes et profils utilisateurs
-- ========================================
-- Objectif : Créer la base d'authentification et les profils de BlaiseConnect.
--
-- Structure :
--   - accounts : comptes d'accès (authentification)
--   - students, teachers, administrators, guardians : profils utilisateurs
--
-- Principaux concepts :
--   1. Matricule : identifiant unique au format [a-z][a-z0-9]{6} (ex: a123456, b456789)
--   2. Rôles : STUDENT, TEACHER, ADMIN, GUARDIAN (fixe après création)
--   3. Triggers : automatisation et validation des données
--   4. Contraintes : intégrité référentielle et métier
--
-- ========================================

BEGIN;

-- Charge l'extension pgcrypto pour générer des UUID aléatoires
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ========================================
-- TABLE 1 : accounts (Comptes d'accès)
-- ========================================
-- Stocke les identifiant de connexion et la sécurité.
-- Chaque compte possède :
--   - Un matricule (registration_number) unique
--   - Un mot de passe hashé en bcrypt ou argon2
--   - Un rôle fixe (immuable après création)
--   - Un statut actif/archivé
--   - Un historique de tentatives de connexion échouées (lockout)
--
-- Exemple de matricule : a000001, b123456, c789abc
CREATE TABLE accounts (
    -- Clé primaire : UUID généré aléatoirement
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Matricule unique : 1 lettre minuscule + 6 caractères alphanumériques (7 chars total)
    -- Validé par CHECK contraint (voir ci-dessous)
    registration_number varchar(50) NOT NULL UNIQUE,

    -- Hash du mot de passe (jamais le stockage en clair !)
    -- Format : bcrypt ($2...), argon2 ou similaire minimum 20 caractères
    password_hash text NOT NULL,

    -- Rôle de l'utilisateur : fixe après création du compte
    -- Valeurs autorisées : STUDENT, TEACHER, ADMIN, GUARDIAN
    role varchar(20) NOT NULL,

    -- Indicateur : compte actif ou archivé
    is_active boolean NOT NULL DEFAULT true,

    -- Protection contre les attaques par force brute
    failed_login_attempts smallint NOT NULL DEFAULT 0,
    locked_until timestamptz,                      -- Jusqu'à quelle date le compte est-il verrouillé ?

    -- Audit : dernière connexion réussie
    last_login_at timestamptz,

    -- Archivage : date de suppression logique d'un compte
    archived_at timestamptz,

    -- Audit : horodatages
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- ========== CONTRAINTES D'INTÉGRITÉ ==========

    -- Le rôle doit être l'un des quatre rôles autorisés
    CONSTRAINT ck_accounts_role
        CHECK (role IN ('STUDENT', 'TEACHER', 'ADMIN', 'GUARDIAN')),

    -- Format du matricule : 1 lettre minuscule suivi de 6 caractères alphanumériques
    -- Regex : ^[a-z][a-z0-9]{6}$
    -- Conformes : a000001, b123abc, c999def
    -- Non-conformes : A000001 (majuscule), a00001 (trop court), 0000001 (commence par chiffre)
    CONSTRAINT ck_accounts_registration_number
        CHECK (registration_number ~ '^[a-z][a-z0-9]{6}$'),

    -- Le hash du mot de passe doit faire au minimum 20 caractères
    -- (un bcrypt valide fait environ 60 caractères)
    CONSTRAINT ck_accounts_password_hash
        CHECK (char_length(btrim(password_hash)) >= 20),

    -- Le nombre de tentatives échouées ne peut pas être négatif
    CONSTRAINT ck_accounts_failed_login_attempts
        CHECK (failed_login_attempts >= 0),

    -- Cohérence logique : si le compte est archivé, il doit être inactif
    CONSTRAINT ck_accounts_archived_inactive
        CHECK (archived_at IS NULL OR is_active = false)
);

-- ========================================
-- TABLE 2 : students (Profil Élève)
-- ========================================
-- Chaque élève possède :
--   - Un lien vers un compte avec rôle STUDENT (obligatoire)
--   - Un profil complet (état-civil, coordonnées, admissibilité)
--
-- Relations :
--   - students.account_id -> accounts.id (1:1)
--   - Un compte STUDENT ne peut être lié qu'à un seul profil étudiant
CREATE TABLE students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Lien vers le compte d'accès (clé étrangère unique)
    -- Si le compte est supprimé, on empêche la suppression (ON DELETE RESTRICT)
    account_id uuid NOT NULL UNIQUE,

    -- État-civil
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    birth_date date,
    gender varchar(20),

    -- Coordonnées
    email varchar(254),
    phone varchar(30),
    address text,

    -- Données administratives
    admission_date date NOT NULL,

    -- Audit
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- ========== CONTRAINTES D'INTÉGRITÉ ==========

    -- Clé étrangère : le compte doit exister
    CONSTRAINT fk_students_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    -- Prénom et nom obligatoires et non-vides
    CONSTRAINT ck_students_first_name
        CHECK (char_length(btrim(first_name)) > 0),

    CONSTRAINT ck_students_last_name
        CHECK (char_length(btrim(last_name)) > 0),

    -- Cohérence logique : date de naissance <= date d'admission
    -- (impossible d'admettre quelqu'un après sa naissance... dans le passé)
    CONSTRAINT ck_students_birth_date
        CHECK (birth_date IS NULL OR birth_date <= admission_date)
);


CREATE TABLE teachers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    account_id uuid NOT NULL UNIQUE,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    birth_date date,
    email varchar(254),
    phone varchar(30),
    address text,
    hire_date date NOT NULL,
    qualification text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_teachers_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    -- Noms et prénoms obligatoires, non-vides
    CONSTRAINT ck_teachers_first_name
        CHECK (char_length(btrim(first_name)) > 0),

    CONSTRAINT ck_teachers_last_name
        CHECK (char_length(btrim(last_name)) > 0),

    -- Date naissance cohérente (avant ou égale à la date d'embauche)
    CONSTRAINT ck_teachers_birth_date
        CHECK (birth_date IS NULL OR birth_date <= hire_date)
);


CREATE TABLE administrators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    account_id uuid NOT NULL UNIQUE,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    email varchar(254),
    phone varchar(30),
    address text,
    hire_date date NOT NULL,
    job_title varchar(100) NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_administrators_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    -- Noms et prénoms obligatoires, non-vides
    CONSTRAINT ck_administrators_first_name
        CHECK (char_length(btrim(first_name)) > 0),

    CONSTRAINT ck_administrators_last_name
        CHECK (char_length(btrim(last_name)) > 0),

    -- Fonction non-vide
    CONSTRAINT ck_administrators_job_title
        CHECK (char_length(btrim(job_title)) > 0)
);

-- TABLE : guardians
-- Responsables d'élèves. account_id est facultatif (peut être sans compte).
CREATE TABLE guardians (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    account_id uuid UNIQUE,
    first_name varchar(100) NOT NULL,
    last_name varchar(100) NOT NULL,
    email varchar(254),
    phone varchar(30) NOT NULL,
    address text,
    occupation varchar(150),
    employer varchar(150),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_guardians_account
        FOREIGN KEY (account_id)
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    -- Noms et prénoms obligatoires, non-vides
    CONSTRAINT ck_guardians_first_name
        CHECK (char_length(btrim(first_name)) > 0),

    CONSTRAINT ck_guardians_last_name
        CHECK (char_length(btrim(last_name)) > 0)
);


-- =========================================================
-- 1. MISE À JOUR AUTOMATIQUE DE updated_at
-- =========================================================
-- Chaque modification d'une ligne met à jour automatiquement
-- la colonne updated_at avec l'horodatage serveur (now()).
-- Utilité : Traçabilité des modifications.

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_set_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_students_set_updated_at
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_teachers_set_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_administrators_set_updated_at
BEFORE UPDATE ON administrators
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_guardians_set_updated_at
BEFORE UPDATE ON guardians
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =========================================================
-- 2. PROTECTION DU MATRICULE ET DU RÔLE
-- =========================================================
-- Empêche toute modification du matricule (registration_number)
-- et du rôle après la création du compte.
-- Utilité : Identité pérenne + catégorie fixe de l'utilisateur

CREATE OR REPLACE FUNCTION protect_account_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.registration_number
        IS DISTINCT FROM OLD.registration_number
    THEN
        RAISE EXCEPTION
            'Le matricule ne peut pas être modifié.';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION
            'Le rôle du compte ne peut pas être modifié.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_protect_identity
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION protect_account_identity();


-- =========================================================
-- 3. VÉRIFICATION DU RÔLE ASSOCIÉ AU PROFIL
-- =========================================================
-- Vérifie que le compte lié à un profil possède le bon rôle.
-- Exemple : Un dossier STUDENT doit être lié à un compte STUDENT.
-- Exception : Un responsable (GUARDIAN) peut exister sans compte.

CREATE OR REPLACE FUNCTION check_profile_account_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    account_role varchar(20);
    expected_role varchar(20);
BEGIN
    expected_role := TG_ARGV[0];

    -- Un responsable peut exister sans compte.
    IF NEW.account_id IS NULL THEN
        IF expected_role = 'GUARDIAN' THEN
            RETURN NEW;
        END IF;

        RAISE EXCEPTION
            'Un compte est obligatoire pour ce profil.';
    END IF;

    SELECT role
    INTO account_role
    FROM accounts
    WHERE id = NEW.account_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Le compte associé est introuvable.';
    END IF;

    IF account_role <> expected_role THEN
        RAISE EXCEPTION
            'Rôle incorrect : rôle attendu %, rôle reçu %.',
            expected_role,
            account_role;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_students_check_account_role
BEFORE INSERT OR UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION check_profile_account_role('STUDENT');

CREATE TRIGGER trg_teachers_check_account_role
BEFORE INSERT OR UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION check_profile_account_role('TEACHER');

CREATE TRIGGER trg_administrators_check_account_role
BEFORE INSERT OR UPDATE ON administrators
FOR EACH ROW
EXECUTE FUNCTION check_profile_account_role('ADMIN');

CREATE TRIGGER trg_guardians_check_account_role
BEFORE INSERT OR UPDATE ON guardians
FOR EACH ROW
EXECUTE FUNCTION check_profile_account_role('GUARDIAN');

COMMIT;
