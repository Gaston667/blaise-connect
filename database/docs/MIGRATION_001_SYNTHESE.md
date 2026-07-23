# Migration 001 : Synthèse de conception

## Objectif
Initialiser les cinq tables fondamentales pour la gestion des comptes et profils d'utilisateurs BlaiseConnect.

**Semaine concernée :** Semaine 1 (20–24 juillet 2026)  
**User Stories :** US-001, US-002, US-025

---

## Tables créées

### 1. `accounts` (comptes d'accès)
| Colonne | Type | Rôle |
|---------|------|------|
| `id` | uuid | Clé technique (PK) |
| `registration_number` | varchar(50) | Matricule unique, immuable (identité métier) |
| `password_hash` | text | Hash du mot de passe (jamais en clair) |
| `role` | varchar(20) | STUDENT\|TEACHER\|ADMIN\|GUARDIAN (fixe) |
| `is_active` | boolean | Autorise/interdit la connexion |
| `failed_login_attempts` | smallint | Compteur d'échecs pour le verrouillage |
| `locked_until` | timestamptz | Fin du verrouillage temporaire |
| `last_login_at` | timestamptz | Dernière connexion réussie |
| `archived_at` | timestamptz | Horodatage d'archivage logique |
| `created_at`, `updated_at` | timestamptz | Traçabilité |

**Protections :**
- `registration_number` : immuable après création du profil associé (trigger)
- `role` : immuable (trigger)
- Format regex : `^[A-Z0-9][A-Z0-9_-]{2,49}$` (CHECK)

### 2–5. Profils

#### `students` (élèves)
- `account_id` : FK unique vers accounts (rôle STUDENT)
- Admission, dates de naissance, coordonnées optionnelles
- Trigger : vérification de compatibilité rôle/table

#### `teachers` (enseignants)
- `account_id` : FK unique vers accounts (rôle TEACHER)
- Qualification, date d'embauche
- Trigger : vérification de compatibilité rôle/table

#### `administrators` (administrateurs)
- `account_id` : FK unique vers accounts (rôle ADMIN)
- Fonction exercée, date d'embauche
- Trigger : vérification de compatibilité rôle/table

#### `guardians` (responsables d'élèves)
- `account_id` : FK unique vers accounts, **NULLABLE** (rôle GUARDIAN)
- Un responsable peut exister sans compte de connexion
- Trigger : vérification de compatibilité si account_id renseigné

---

## Fonctions et Triggers

### 1. `set_updated_at()`
Mise à jour automatique du timestamp `updated_at` sur chaque modification.
- **Triggers:** 5 (un par table)

### 2. `protect_account_identity()`
Empêche la modification du `registration_number` et du `role` d'un compte.
- **Trigger:** `trg_accounts_protect_identity` (BEFORE UPDATE)
- **Codes d'erreur:** 23000 (intégrité violée)

### 3. `enforce_profile_account_role()`
Vérifie que le compte associé à un profil possède le rôle attendu.
- **Triggers:** 4 (un par table profil, CONSTRAINT DEFERRABLE)
- **Codes d'erreur:** 23503 (FK manquante), 23514 (rôle invalide)
- **Utilité:** Éviter une incohérence entre le rôle du compte et la table cible

---

## Indexes

| Index | Colonne(s) | Condition | Utilité |
|-------|-----------|-----------|---------|
| `idx_accounts_role` | `role` | — | JOIN profil ↔ compte par rôle |
| `idx_accounts_active` | `registration_number` | `is_active = true AND archived_at IS NULL` | Accélère les requêtes de connexion (recherche compte actif) |
| `idx_students_name` | `last_name, first_name` | — | Recherche élève par nom |
| `idx_teachers_name` | `last_name, first_name` | — | Recherche enseignant par nom |
| `idx_administrators_name` | `last_name, first_name` | — | Recherche administrateur par nom |
| `idx_guardians_name` | `last_name, first_name` | — | Recherche responsable par nom |

---

## Principes appliqués

### Séparation des rôles
- **Un compte = un rôle fixe (STUDENT, TEACHER, ADMIN, GUARDIAN)**
- Quatre tables profil distinctes (pas de table générique `persons`)
- Justification : clarté conceptuelle, requêtes plus simples, intégrité typée

### Immuabilité
- Matricule et rôle protégés par trigger PostgreSQL
- Garantie à la source, pas de dépendance au backend

### Responsables sans compte
- Particularité : `guardians.account_id` peut être NULL
- Permettre l'existence de responsables non-utilisateurs

### Mots de passe
- **Jamais stockés en clair**
- Hash obligatoire (length ≥ 20)
- Responsabilité FastAPI : bcrypt, argon2, etc.

### Transactions multitables
- Triggers CONSTRAINT DEFERRABLE permettent :
  ```sql
  INSERT INTO accounts (...) VALUES (...);
  INSERT INTO students (account_id, ...) VALUES (...);
  -- Vérification du rôle différée jusqu'au COMMIT
  ```

### Suppression
- **ON DELETE RESTRICT** partout
- Aucun CASCADE (protection historique)
- Archivage préféré : `is_active = false`, `archived_at = now()`
- Matricule jamais réutilisable

### Horodatages
- Type `timestamptz` : UTC obligatoire
- Conversion au fuseau local : responsabilité frontend
- Cohérence : `updated_at ≥ created_at`, tous les timestamps ≥ `created_at`

---

## Validations et Contraintes

### `accounts`
- Matricule : format regex, unique, non-vide
- Mot de passe : length ≥ 20
- Rôle : liste fermée (4 valeurs)
- Compteur failed_login_attempts ≥ 0
- Logique : si archivé → inactif
- Cohérence temporelle (CHECK multi-colonnes)

### Profils (students, teachers, administrators, guardians)
- account_id : FK, unique
- Noms : non-vides après trim
- Dates : cohérence (naissance ≤ admission pour élèves, etc.)
- Champs optionnels : non-vides si renseignés

### Triggers
- **`enforce_profile_account_role`** : vérification multi-table deferrable
  - Accepte NULL pour guardians
  - Lève exception précise en cas d'erreur (ERRCODE + message métier)

---

## Notes importantes

1. **Matricules générés par FastAPI**, pas PostgreSQL
2. **Aucune colonne de genre** : valeur à confirmer (à quoi elle sert ? qui valide ?)
3. **Format applicatif V1 du matricule** : `a`, `e`, `u` ou `p`, suivi de six chiffres, conformément à la décision D-002 ; la migration 001 reste plus permissive et devra être resserrée par une nouvelle migration
4. **Pas d'historique de connexions** : `last_login_at` est un snapshot, pas un audit complet
5. **Pas de gestion du consentement RGPD** : à prévoir ultérieurement si nécessaire
6. **Archivage ≠ suppression** : données conservées, lien compte/profil maintenu

---

## Points à valider avant déploiement

- [x] Format exact du matricule : `^[aeup][0-9]{6}$`, validé dans la décision D-002
- [ ] Valeurs possibles de `gender` (ou le supprimer ?)
- [ ] Politique de rôles : formation multi-rôles possible ? (réponse : non, deux comptes requis)
- [ ] Durée du verrouillage après N échecs (implémenté en application, déjà défini ?)

---

## Dépendances résolues

✅ Extension `pgcrypto` chargée (gen_random_uuid)  
✅ Comptes unique et immuable  
✅ Rôles fixés et immuables  
✅ Profils listé à chaque compte  
✅ Triggers DEFERRABLE pour transactions  

---

**Status :** Documentation complète. Migration prête pour exécution et tests.
