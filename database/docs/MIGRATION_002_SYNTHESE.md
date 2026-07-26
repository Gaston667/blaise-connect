# Migration 002 : Synthèse des comptes, sessions et profils

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
- Format SQL actuel : `^[a-z][a-z0-9]{6}$` (CHECK)

### 2–5. Profils

#### `students` (élèves)
- `account_id` : FK unique vers accounts (rôle STUDENT)
- `status` : situation scolaire indépendante du compte (`ACTIVE`, `INACTIVE`, `ARCHIVED`)
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
- `updated_at` est actualisé automatiquement par trigger

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
- Les champs optionnels peuvent être `NULL`; certains acceptent encore une chaîne vide

### Triggers
- **`enforce_profile_account_role`** : vérification multi-table deferrable
  - Accepte NULL pour guardians
  - Lève exception précise en cas d'erreur (ERRCODE + message métier)

---

## Notes importantes

1. **Matricules générés par FastAPI**, pas PostgreSQL
2. **Profils complets** : les quatre profils possèdent `gender`, `photo_path` et `archived_at`, tous facultatifs
3. **Format applicatif V1 envisagé du matricule** : `a`, `e`, `u` ou `p`, suivi de six chiffres ; la migration 001 reste plus permissive et le format définitif doit encore être validé
4. **Pas d'historique de connexions** : `last_login_at` est un snapshot, pas un audit complet
5. **Pas de gestion du consentement RGPD** : à prévoir ultérieurement si nécessaire
6. **Archivage ≠ suppression** : données conservées, lien compte/profil maintenu

---

## Points à valider avant déploiement

- [ ] Format exact du matricule : confirmer `^[aeup][0-9]{6}$` avant une migration corrective
- [ ] Valeurs possibles de `gender`
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

**Statut :** migration 002 consolidée et non exécutée.
