# BlaiseConnect — Instructions de travail pour les agents

## 1. Rôle de ce fichier

Ce fichier est la référence principale pour tout agent qui intervient sur la base de données de BlaiseConnect. Il décrit le modèle validé à ce jour, ses règles métier et la manière d'écrire du SQL PostgreSQL.

L'agent doit :

- répondre et expliquer en français ;
- employer des noms anglais en `snake_case` dans le code et la base ;
- privilégier une solution simple, pédagogique, testable et sûre ;
- ne jamais inventer silencieusement une règle métier ;
- ne jamais modifier le schéma sans migration versionnée ;
- protéger l'intégrité dans PostgreSQL, puis répéter les validations utiles dans FastAPI ;
- expliquer toute contrainte, fonction, procédure ou trigger ajouté ;
- signaler les conséquences d'un changement sur les autres tables ;
- mettre à jour ce fichier et le journal des décisions lorsqu'une décision est validée.

Le SGBD cible est **PostgreSQL**. Pour le code procédural, utiliser **PL/pgSQL**. Ne pas produire de PL/SQL Oracle sauf demande explicite.

## 2. Sources de vérité et gestion des contradictions

Avant une modification importante, consulter si disponibles :

1. ce fichier `AGENTS.md` ;
2. le journal des décisions ;
3. le cahier des charges ;
4. le Product Backlog ;
5. le Sprint Planning ;
6. les migrations et modèles déjà présents dans le dépôt.

En cas de contradiction :

1. décrire précisément les deux règles incompatibles ;
2. ne pas choisir silencieusement ;
3. proposer une recommandation simple ;
4. demander une validation si le choix change le métier ou les données ;
5. ne coder qu'après résolution de la contradiction.

Les décisions les plus récentes consignées dans ce fichier remplacent les anciennes propositions qui utilisaient une table générique `persons`.

## 3. Principes validés du modèle

### 3.1 Séparation des catégories de personnes

Il n'existe **pas** de table `persons`.

Les informations sont séparées dans :

- `students` pour les élèves ;
- `teachers` pour les enseignants ;
- `administrators` pour les administrateurs ;
- `guardians` pour les responsables d'élèves.

La répétition de certains attributs d'identité entre ces quatre tables est un choix volontaire de simplicité conceptuelle. Ne pas recréer une table `persons` sans décision explicite.

### 3.2 Comptes et matricules

- Le matricule est stocké uniquement dans `accounts`.
- Le matricule sert d'identifiant de connexion.
- Il est unique, immuable et ne doit jamais être réutilisé.
- Désactiver ou archiver un compte ne libère jamais son matricule.
- Un compte possède exactement un rôle fixe : `STUDENT`, `TEACHER`, `ADMIN` ou `GUARDIAN`.
- Un compte ne doit correspondre qu'au dossier de sa catégorie.
- Une personne qui exerce deux fonctions doit avoir deux comptes et deux matricules distincts.
- Un responsable peut exister dans `guardians` sans compte. Il ne peut alors pas se connecter.
- Un mot de passe n'est jamais stocké en clair, uniquement sous forme de hash produit par une bibliothèque reconnue.
- L'état d'un compte n'est pas stocké dans une colonne `status` redondante :
  - actif : `is_active = true`, sans archivage et sans verrouillage en cours ;
  - verrouillé temporairement : `locked_until` est dans le futur ;
  - désactivé : `is_active = false` et `archived_at IS NULL` ;
  - archivé : `is_active = false` et `archived_at IS NOT NULL`.
- Le verrouillage temporaire d'un compte ne modifie jamais le statut scolaire du profil.

### 3.3 Historique scolaire

- Une classe appartient à une seule année scolaire.
- L'année scolaire n'est donc pas répétée dans `student_enrollments` : elle se déduit de la classe.
- Une inscription représente le passage d'un élève dans une classe.
- À la clôture d'une année, le système renseigne automatiquement la fin des inscriptions encore ouvertes.
- Les anciennes inscriptions, notes, absences et bulletins ne sont pas supprimés.

### 3.4 Périodes et bulletins

- Une période de bulletin est une plage de dates choisie par l'école.
- Elle peut représenter un mois, un trimestre, un semestre ou toute autre période.
- Elle sert à sélectionner les évaluations utilisées pour le bulletin.
- Elle ne change pas les données sources et ne limite pas le fonctionnement général du logiciel.
- Une année peut être courante sans période déjà définie.
- Pour créer une période, l'administrateur choisit sa date de fin. Son début est le début de l'année pour la première période, puis le lendemain de la période précédente.
- Les évaluations dont `assessment_date` est comprise entre ces deux dates incluses sont retenues pour le bulletin.
- Les périodes sont ordonnées par `start_date`; aucun attribut `position` n'est nécessaire.

### 3.5 Matières, évaluations et notes

- `class_subjects.coefficient` pondère la matière dans la moyenne générale de la classe.
- `assessments.coefficient` pondère une évaluation parmi les évaluations de la même matière.
- Une note appartient à une évaluation et à l'inscription scolaire de l'élève.
- Une note absente possède `result_type = 'ABSENT'` et aucune valeur numérique.
- Une absence à une évaluation conserve toujours `score = NULL` afin de ne pas
  confondre une absence avec un véritable zéro obtenu par un élève présent.
- Une absence justifiée est exclue du calcul. Une absence `UNJUSTIFIED` ou
  `REJECTED` reçoit une valeur effective de zéro uniquement pendant le calcul.
- Une absence `PENDING` empêche la validation définitive du bulletin concerné.
- Les calculs officiels sont effectués côté backend et protégés par les contraintes de la base.

### 3.6 Absences et retards

- L'emploi du temps hebdomadaire récurrent est distinct de l'appel : voir `timetable_slots` (§3.9). `attendance_events` reste la source du contexte d'un appel ponctuel.
- `attendance_events` contient uniquement le contexte d'un appel : affectation, date et horaires du cours.
- `attendance_records` contient les élèves absents ou en retard pendant cet appel.
- Le contexte évite de répéter le professeur, la matière et les horaires pour chaque élève concerné.
- Les justificatifs sont stockés hors de PostgreSQL et référencés par le
  catalogue `document_types` et la table `documents`.
- `grade_documents` relie les justificatifs aux absences d'évaluation et
  `attendance_record_documents` les relie aux absences ou retards de cours.

### 3.7 Documents

- Les fichiers restent dans le stockage applicatif ; PostgreSQL conserve leur
  chemin logique, nom original, type MIME, taille et empreinte SHA-256.
- Les types de documents sont des lignes de `document_types`, jamais des
  colonnes supplémentaires ajoutées à chaque nouveau besoin.
- Les relations vers les objets métier utilisent des tables de liaison avec de
  vraies clés étrangères ; ne pas utiliser une relation polymorphe
  `entity_type` + `entity_id`.
- Un justificatif peut être relié à une note absente ou à un incident
  d'assiduité sans dupliquer le fichier.

### 3.8 Bulletins historiques

- Un bulletin appartient à une inscription et à une période.
- `report_card_subjects` conserve les moyennes et coefficients réellement appliqués.
- `report_card_grades` conserve la liste exacte des notes utilisées.
- Une fois validé, le bulletin et ses lignes deviennent immuables, sauf procédure explicite d'invalidation autorisée et auditée.
- Les moyennes stockées sont des instantanés historiques volontaires, pas une erreur de normalisation.

### 3.9 Emploi du temps

- `timetable_slots` représente un créneau hebdomadaire récurrent (jour de la
  semaine + heure de début/fin), rattaché à une `teacher_assignment` — pas de
  date précise, pas de duplication de `teacher_id`/`class_id` (résolus par
  jointure pour rester en 3NF).
- `rooms` est une table dédiée plutôt qu'un texte libre, pour éviter la
  duplication/les fautes de saisie sur le nom de salle.
- Trois conflits sont interdits par trigger (`check_timetable_slot_conflicts`) :
  un même enseignant, une même classe ou une même salle ne peuvent pas avoir
  deux créneaux qui se chevauchent le même jour.
- Contrairement aux notes/absences, l'emploi du temps ne conserve pas de piste
  d'audit : un planning se corrige, il ne se justifie pas. `DELETE` reste donc
  autorisé pour `blaise_app`.
- Un emploi du temps d'une année clôturée est immuable, comme le reste de
  l'activité pédagogique.

## 4. Conventions PostgreSQL obligatoires

- Utiliser PostgreSQL 15 ou une version supérieure, sauf contrainte contraire du déploiement.
- Utiliser des noms anglais ASCII en `snake_case`; ne pas utiliser d'accent dans les identifiants SQL.
- Utiliser `uuid` pour les clés et `gen_random_uuid()` pour leur valeur par défaut.
- Utiliser `timestamptz` pour les instants et `date` pour les dates scolaires sans heure.
- Utiliser `numeric(p,s)` pour les notes, coefficients et moyennes; ne jamais utiliser `float`.
- Utiliser `text` ou `varchar(n)` avec une limite justifiée.
- Ajouter `created_at timestamptz NOT NULL DEFAULT now()` et `updated_at timestamptz NOT NULL DEFAULT now()` aux tables métier modifiables.
- Les horodatages sont écrits en UTC; la conversion vers le fuseau local est faite à l'affichage.
- Toute clé étrangère doit être indexée, sauf justification mesurée et documentée.
- Toute règle atomique doit être une contrainte `NOT NULL`, `UNIQUE`, `CHECK`, `FOREIGN KEY` ou `EXCLUDE` lorsque PostgreSQL peut l'exprimer.
- Employer un trigger seulement pour une règle qui dépend de plusieurs tables ou pour une immutabilité impossible à garantir autrement.
- Donner un nom explicite aux contraintes : `pk_*`, `fk_*`, `uq_*`, `ck_*`, `ex_*`.
- Utiliser des requêtes paramétrées. Ne jamais concaténer une saisie utilisateur dans du SQL dynamique.
- Ne jamais utiliser `SELECT *` dans le code applicatif ou les vues contractuelles.

## 5. Dictionnaire du schéma actuel

Les colonnes marquées « obligatoire » doivent recevoir `NOT NULL`.

### 5.1 `accounts`

Compte d'accès à l'application.

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Clé technique du compte. |
| `registration_number` | `varchar(50)` | Matricule unique, normalisé en minuscules, utilisé pour la connexion. |
| `password_hash` | `text` | Hash du mot de passe, jamais le mot de passe en clair. |
| `role` | `varchar(20)` | Rôle fixe : `STUDENT`, `TEACHER`, `ADMIN` ou `GUARDIAN`. |
| `is_active` | `boolean` | Autorise ou interdit la connexion. |
| `failed_login_attempts` | `smallint` | Nombre d'échecs consécutifs depuis la dernière connexion réussie. |
| `locked_until` | `timestamptz` | Fin du verrouillage temporaire; `NULL` si le compte n'est pas verrouillé. |
| `last_login_at` | `timestamptz` | Date et heure de la dernière connexion réussie. |
| `archived_at` | `timestamptz` | Date d'archivage logique; `NULL` tant que le compte n'est pas archivé. |
| `created_at` | `timestamptz` | Création du compte. |
| `updated_at` | `timestamptz` | Dernière modification du compte. |

Protections minimales : unicité du matricule; format contrôlé; `failed_login_attempts >= 0`; compte archivé obligatoirement inactif; matricule et rôle immuables après création du dossier lié.

### 5.2 `students`

Dossier propre à un élève. Il ne contient pas son matricule.

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant du dossier élève. |
| `account_id` | `uuid` | Compte élève unique associé au dossier. |
| `first_name` | `varchar(100)` | Prénom officiel. |
| `last_name` | `varchar(100)` | Nom officiel. |
| `birth_date` | `date` | Date de naissance. |
| `gender` | `varchar(20)` | Genre facultatif selon la liste restant à valider. |
| `email` | `varchar(254)` | Adresse électronique personnelle, facultative. |
| `phone` | `varchar(30)` | Numéro de téléphone, facultatif. |
| `address` | `text` | Adresse postale, facultative. |
| `admission_date` | `date` | Date d'entrée initiale dans l'établissement. |
| `status` | `student_status_enum` | Situation scolaire : `ACTIVE`, `INACTIVE` ou `ARCHIVED`. |
| `photo_path` | `varchar(500)` | Chemin de la photo facultative de l'élève. |
| `archived_at` | `timestamptz` | Date d'archivage logique du dossier élève. |

`account_id` est obligatoire et unique. Le compte référencé doit avoir le rôle `STUDENT`. Le statut scolaire est indépendant de l'état du compte. `ARCHIVED` exige `archived_at`; `ACTIVE` et `INACTIVE` exigent que `archived_at` soit nul.

### 5.3 `teachers`

Dossier professionnel d'un enseignant.

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant du dossier enseignant. |
| `account_id` | `uuid` | Compte enseignant unique associé. |
| `first_name`, `last_name` | `varchar(100)` | Identité de l'enseignant. |
| `birth_date` | `date` | Date de naissance, facultative. |
| `gender` | `varchar(20)` | Genre facultatif selon la liste restant à valider. |
| `email` | `varchar(254)` | Adresse électronique, facultative. |
| `phone` | `varchar(30)` | Numéro de téléphone, facultatif. |
| `address` | `text` | Adresse, facultative. |
| `hire_date` | `date` | Date d'embauche. |
| `qualification` | `text` | Qualification ou diplôme professionnel, facultatif. |
| `photo_path` | `varchar(500)` | Chemin de la photo facultative de l'enseignant. |
| `archived_at` | `timestamptz` | Date d'archivage logique du dossier enseignant. |

`account_id` est obligatoire et unique. Le compte référencé doit avoir le rôle `TEACHER`. Lorsqu'il est renseigné, l'email est unique sans tenir compte de la casse.

### 5.4 `administrators`

Dossier professionnel d'un administrateur.

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant du dossier administrateur. |
| `account_id` | `uuid` | Compte administrateur unique associé. |
| `first_name`, `last_name` | `varchar(100)` | Identité de l'administrateur. |
| `gender` | `varchar(20)` | Genre facultatif selon la liste restant à valider. |
| `email` | `varchar(254)` | Adresse électronique, facultative. |
| `phone` | `varchar(30)` | Téléphone, facultatif. |
| `address` | `text` | Adresse, facultative. |
| `hire_date` | `date` | Date d'embauche. |
| `job_title` | `varchar(100)` | Fonction exercée dans l'établissement. |
| `photo_path` | `varchar(500)` | Chemin de la photo facultative de l'administrateur. |
| `archived_at` | `timestamptz` | Date d'archivage logique du dossier administrateur. |

`account_id` est obligatoire et unique. Le compte référencé doit avoir le rôle `ADMIN`.

### 5.5 `guardians`

Dossier d'un responsable d'élève.

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant du responsable. |
| `account_id` | `uuid` | Compte de connexion facultatif mais unique. |
| `first_name`, `last_name` | `varchar(100)` | Identité du responsable. |
| `gender` | `varchar(20)` | Genre facultatif selon la liste restant à valider. |
| `email` | `varchar(254)` | Adresse électronique, facultative. |
| `phone` | `varchar(30)` | Téléphone principal obligatoire. |
| `address` | `text` | Adresse, facultative. |
| `occupation` | `varchar(150)` | Profession, facultative. |
| `employer` | `varchar(150)` | Employeur, facultatif. |
| `photo_path` | `varchar(500)` | Chemin de la photo facultative du responsable. |
| `archived_at` | `timestamptz` | Date d'archivage logique du dossier responsable. |

Si `account_id` est renseigné, le compte doit avoir le rôle `GUARDIAN`.

Les quatre catégories de profils peuvent être archivées logiquement. Lorsqu'un profil possède un compte, son archivage exige que ce compte soit également inactif et archivé. Les classes ne possèdent pas d'archivage propre : leur cycle de vie dépend de l'année scolaire.

### 5.6 `school_years`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de l'année scolaire. |
| `name` | `varchar(20)` | Libellé unique, par exemple `2026-2027`. |
| `start_date`, `end_date` | `date` | Premier et dernier jour de l'année. |
| `is_current` | `boolean` | Indique l'unique année courante. |
| `closed_at` | `timestamptz` | Moment de la clôture administrative. |
| `closed_by_account_id` | `uuid` | Administrateur ayant clôturé l'année. |

Règles : `end_date > start_date`; au maximum une année courante; une année clôturée n'est plus courante; les deux informations de clôture sont soit toutes deux nulles, soit toutes deux renseignées.

### 5.7 `reporting_periods`

Périodes servant à construire les bulletins.

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de la période. |
| `school_year_id` | `uuid` | Année scolaire propriétaire. |
| `name` | `varchar(100)` | Nom affiché, par exemple `Trimestre 1`. |
| `start_date`, `end_date` | `date` | Plage inclusive des évaluations retenues. |

La plage doit être incluse dans l'année scolaire. Les périodes existantes ne se chevauchent pas et restent contiguës, mais elles peuvent être ajoutées progressivement sans couvrir immédiatement toute l'année.

### 5.8 `class_levels`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant du niveau. |
| `code` | `class_level_code_enum` | Code unique et contrôlé du niveau. |
| `name` | `varchar(100)` | Nom affiché. |
| `education_stage` | `education_stage_enum` | Cycle scolaire contrôlé. |
| `display_order` | `smallint` | Ordre d'affichage des niveaux. |
| `is_active` | `boolean` | Permet de retirer un niveau des nouvelles créations sans effacer l'historique. |

Les codes autorisés sont `PETITE_SECTION`, `MOYENNE_SECTION`, `GRANDE_SECTION`, `CP`, `CE1`, `CE2`, `CM1`, `CM2`, `SIXIEME`, `CINQUIEME`, `QUATRIEME`, `TROISIEME`, `SECONDE`, `PREMIERE` et `TERMINALE`. Les cycles autorisés sont `PRESCHOOL`, `PRIMARY`, `MIDDLE_SCHOOL` et `HIGH_SCHOOL`. `display_order >= 0`; le code est unique.
PostgreSQL contrôle également la correspondance entre le niveau et son cycle.

### 5.9 Promotions

Le système de promotions n'est pas intégré au MVP. Aucune table `promotions` ni colonne `promotion_id` ne doit être ajoutée sans une nouvelle décision métier explicite.

### 5.10 `classes`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de la classe annuelle. |
| `school_year_id` | `uuid` | Année scolaire de la classe. |
| `class_level_id` | `uuid` | Niveau scolaire. |
| `main_teacher_id` | `uuid` | Professeur principal obligatoire de la classe. |
| `group_label` | `varchar(30)` | Groupe ou section, par exemple `A`. |
| `capacity` | `smallint` | Capacité maximale indicative. |

`capacity > 0` lorsqu'elle est renseignée. La combinaison année, niveau et groupe doit être unique. Le professeur principal doit référencer un dossier `teachers`.

### 5.11 `student_enrollments`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de l'inscription. |
| `student_id` | `uuid` | Élève inscrit. |
| `class_id` | `uuid` | Classe rejointe. |
| `start_date` | `date` | Début effectif de l'inscription. |
| `end_date` | `date` | Fin effective, renseignée automatiquement lors de la clôture si nécessaire. |
| `end_reason` | `enrollment_end_reason_enum` | `YEAR_COMPLETED`, `CLASS_CHANGE` ou `LEFT_SCHOOL`. |

Règles : une seule inscription ouverte par élève; `end_date >= start_date`; `end_date` et `end_reason` sont renseignés ensemble; dates incluses dans l'année de la classe; pas de doublon élève/classe.

### 5.12 `student_guardians`

Association plusieurs-à-plusieurs entre élèves et responsables.

| Colonne | Type conseillé | Signification |
|---|---|---|
| `student_id` | `uuid` | Élève concerné, partie de la clé primaire. |
| `guardian_id` | `uuid` | Responsable concerné, partie de la clé primaire. |
| `relationship_type` | `varchar(10)` | `FATHER`, `MOTHER` ou `OTHER`. |
| `relationship_details` | `varchar(100)` | Précision obligatoire uniquement pour `OTHER`. |
| `is_legal_guardian` | `boolean` | Possède l'autorité légale déclarée. |
| `is_primary_contact` | `boolean` | Contact principal de l'élève. |
| `is_emergency_contact` | `boolean` | Contact à appeler en urgence. |

Un élève ne peut avoir qu'un contact principal. La paire élève/responsable est unique.

### 5.13 `subjects`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de la matière. |
| `name` | `varchar(100)` | Nom unique de la matière. |
| `description` | `text` | Description facultative. |
| `is_active` | `boolean` | Autorise l'utilisation dans de nouvelles classes. |

La table ne possède pas de colonne `code`. Un code d'affichage éventuel est produit par le programme tant qu'aucune décision contraire n'est validée.

### 5.14 `class_subjects`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de la matière enseignée dans une classe. |
| `class_id` | `uuid` | Classe concernée. |
| `subject_id` | `uuid` | Matière concernée. |
| `coefficient` | `numeric(6,2)` | Poids de la matière dans la moyenne générale. |

La paire classe/matière est unique et `coefficient > 0`.

### 5.15 `teacher_assignments`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de l'affectation. |
| `teacher_id` | `uuid` | Enseignant affecté. |
| `class_subject_id` | `uuid` | Matière et classe enseignées. |
| `start_date` | `date` | Début de l'affectation. |
| `end_date` | `date` | Fin facultative, notamment en cas de remplacement. |

`end_date >= start_date`. Interdire le chevauchement de deux affectations identiques pour le même enseignant et la même matière de classe. Les dates doivent rester dans l'année de la classe.

### 5.16 `assessments`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de l'évaluation. |
| `teacher_assignment_id` | `uuid` | Enseignant, classe et matière concernés. |
| `title` | `varchar(150)` | Titre visible de l'évaluation. |
| `description` | `text` | Consignes ou description facultative. |
| `assessment_date` | `date` | Date réelle de l'évaluation. |
| `maximum_score` | `numeric(6,2)` | Barème maximal. |
| `coefficient` | `numeric(6,2)` | Poids de cette évaluation dans la moyenne de la matière. |

`maximum_score > 0`, `coefficient > 0`; la date doit appartenir à la période active de l'affectation.

### 5.17 `grades`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de la note. |
| `assessment_id` | `uuid` | Évaluation notée. |
| `student_enrollment_id` | `uuid` | Inscription de l'élève évalué. |
| `result_type` | `varchar(10)` | `SCORED` ou `ABSENT`. |
| `score` | `numeric(6,2)` | Valeur obtenue, uniquement pour `SCORED`. |
| `comment` | `text` | Commentaire facultatif. |
| `justification_status` | `varchar(20)` | Pour `ABSENT` : `UNJUSTIFIED`, `PENDING`, `JUSTIFIED` ou `REJECTED`. |
| `reviewed_by_account_id` | `uuid` | Compte ayant traité le justificatif. |
| `reviewed_at` | `timestamptz` | Moment du traitement du justificatif. |

Une seule note par élève et évaluation. Pour `SCORED`, `score` est obligatoire, positif ou nul et inférieur ou égal au barème. Pour `ABSENT`, `score` doit être `NULL` et le statut de justification est obligatoire. `JUSTIFIED` est exclu du calcul, `UNJUSTIFIED` et `REJECTED` valent zéro pendant le calcul, et `PENDING` bloque la validation du bulletin. L'inscription doit appartenir à la classe de l'évaluation et être active à sa date.

### 5.18 `attendance_events`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant du contexte d'appel. |
| `teacher_assignment_id` | `uuid` | Professeur, classe et matière du cours. |
| `attendance_date` | `date` | Date du cours. |
| `course_start_time` | `time` | Heure de début. |
| `course_end_time` | `time` | Heure de fin. |

`course_end_time > course_start_time`. Le même contexte ne doit pas être créé deux fois. La date doit appartenir à l'affectation et à l'année de la classe.

### 5.19 `attendance_records`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant de l'incident. |
| `attendance_event_id` | `uuid` | Contexte du cours. |
| `student_enrollment_id` | `uuid` | Élève concerné dans sa classe annuelle. |
| `incident_type` | `varchar(10)` | `ABSENT` ou `LATE`. |
| `late_minutes` | `smallint` | Durée du retard, uniquement pour `LATE`. |
| `reason` | `text` | Motif communiqué, facultatif. |
| `justification_status` | `varchar(20)` | `UNJUSTIFIED`, `PENDING`, `JUSTIFIED` ou `REJECTED`. |
| `recorded_by_account_id` | `uuid` | Compte ayant enregistré l'incident. |
| `reviewed_by_account_id` | `uuid` | Compte ayant vérifié le justificatif. |
| `reviewed_at` | `timestamptz` | Moment de la vérification. |
| `updated_by_account_id` | `uuid` | Dernier compte ayant corrigé l'incident. |
| `last_change_reason` | `text` | Motif de la dernière correction. |
| `deleted_at` | `timestamptz` | Suppression logique de l'incident. |
| `deleted_by_account_id` | `uuid` | Compte ayant effectué la suppression logique. |

Une seule ligne par élève et contexte. Pour `LATE`, les minutes sont strictement positives et ne dépassent pas la durée du cours. Pour `ABSENT`, elles sont nulles. L'élève doit appartenir à la classe du contexte. Les informations de révision sont renseignées ensemble.

### 5.20 `report_cards`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `id` | `uuid` | Identifiant du bulletin. |
| `student_enrollment_id` | `uuid` | Élève et classe concernés. |
| `reporting_period_id` | `uuid` | Période couverte. |
| `general_average` | `numeric(6,2)` | Moyenne générale figée au moment de la génération. |
| `overall_comment` | `text` | Appréciation générale facultative. |
| `generated_by_account_id` | `uuid` | Compte ayant généré le bulletin. |
| `generated_at` | `timestamptz` | Moment de génération. |
| `validated_by_account_id` | `uuid` | Compte ayant validé le bulletin. |
| `validated_at` | `timestamptz` | Moment de validation. |
| `pdf_document_id` | `uuid` | Document PDF final référencé dans `documents`, facultatif avant génération. |

Un seul bulletin par inscription et période. L'inscription et la période doivent appartenir à la même année. Les informations de validation sont renseignées ensemble et `validated_at >= generated_at`.

### 5.21 `report_card_subjects`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `report_card_id` | `uuid` | Bulletin, partie de la clé primaire. |
| `class_subject_id` | `uuid` | Matière de la classe, partie de la clé primaire. |
| `subject_average` | `numeric(6,2)` | Moyenne figée de la matière. |
| `applied_coefficient` | `numeric(6,2)` | Coefficient figé réellement utilisé. |
| `teacher_comment` | `text` | Appréciation de l'enseignant. |

La matière doit appartenir à la classe de l'inscription du bulletin. `applied_coefficient > 0`.

### 5.22 `report_card_grades`

| Colonne | Type conseillé | Signification |
|---|---|---|
| `report_card_id` | `uuid` | Bulletin, partie de la clé primaire. |
| `grade_id` | `uuid` | Note utilisée, partie de la clé primaire. |

La note doit appartenir au même élève, à une matière de sa classe et à une évaluation dont la date est incluse dans la période du bulletin.

### 5.23 Documents et liaisons documentaires

- `document_types` contient `id`, `code` unique, `label`, `description` et
  `is_active`. Ajouter un type consiste à ajouter une ligne au catalogue.
- `documents` contient `document_type_id`, `storage_path` unique,
  `original_filename`, `mime_type`, `size_bytes`, `sha256`,
  `uploaded_by_account_id` et `archived_at`. Le contenu binaire n'est jamais
  stocké dans PostgreSQL.
- `grade_documents` possède la clé composée (`grade_id`, `document_id`).
- `attendance_record_documents` possède la clé composée
  (`attendance_record_id`, `document_id`).
- `report_cards.pdf_document_id` référence un document de type `REPORT_CARD`.

### 5.24 Demandes de correction et historique d'assiduité

- `grade_change_requests` conserve les anciennes et nouvelles valeurs proposées
  ainsi que le demandeur, le valideur et la décision. Une seule demande
  `PENDING` est autorisée par note.
- `attendance_change_requests` permet à un enseignant de signaler une correction
  ou une suppression logique sans modifier directement l'incident. Une seule
  demande `PENDING` est autorisée par incident.
- `attendance_record_history` conserve les anciennes et nouvelles valeurs de
  chaque correction effectivement appliquée, son auteur, son motif et sa date.

## 6. Contraintes et protections obligatoires

### 6.1 Contraintes simples

L'agent doit utiliser autant que possible :

- `PRIMARY KEY` sur chaque table ;
- `NOT NULL` pour toute donnée réellement obligatoire ;
- `FOREIGN KEY` pour chaque relation ;
- `UNIQUE` pour les identifiants métier et associations non répétables ;
- `CHECK` pour les valeurs autorisées, cohérences de dates, nombres positifs et colonnes conditionnelles ;
- index uniques partiels pour les règles comme « une seule année courante » ;
- contraintes d'exclusion `EXCLUDE USING gist` pour empêcher les chevauchements de plages lorsque nécessaire.

Ne pas remplacer une contrainte SQL possible par une simple validation React ou FastAPI.

### 6.2 Règles nécessitant plusieurs tables

Une `CHECK` PostgreSQL ne doit pas interroger une autre table. Pour les règles suivantes, utiliser une fonction PL/pgSQL et un **constraint trigger différable** lorsque la transaction peut créer plusieurs lignes liées :

- rôle du compte compatible avec la table de profil ;
- dates d'une période incluses dans son année ;
- dates d'une inscription incluses dans l'année de sa classe ;
- date d'une affectation incluse dans l'année de la classe ;
- élève noté inscrit dans la classe de l'évaluation ;
- note inférieure au barème de l'évaluation ;
- élève absent inscrit dans la classe du contexte d'appel ;
- période du bulletin et inscription appartenant à la même année ;
- notes du bulletin appartenant au bon élève et à la bonne période ;
- matière du bulletin appartenant à sa classe.

Les triggers doivent lever une exception explicite avec un message métier compréhensible et, si utile, un `ERRCODE` PostgreSQL adapté.

### 6.3 Suppressions

Politique par défaut :

- `ON DELETE RESTRICT` pour comptes, profils, années, classes, inscriptions, matières, affectations, évaluations et bulletins ;
- `ON DELETE CASCADE` uniquement pour une ligne de détail qui n'a aucun sens sans son parent, par exemple une association non historique encore modifiable ;
- préférer `is_active`, `archived_at` ou une date de fin à la suppression physique ;
- ne jamais utiliser un `CASCADE` large susceptible de supprimer l'historique scolaire ;
- toute suppression exceptionnelle de données réelles doit être explicitement autorisée et auditée.

### 6.4 Immutabilité

Protéger par trigger ou permissions :

- `accounts.registration_number` après création ;
- le rôle d'un compte dès qu'un profil est lié ;
- les lignes et valeurs d'un bulletin validé ;
- les notes référencées par un bulletin validé ;
- les données d'une année scolaire clôturée, sauf opération administrative explicite et auditée.

### 6.5 Concurrence et transactions

- Les opérations multi-tables sont atomiques.
- La clôture d'année, la génération/validation d'un bulletin et les imports utilisent une transaction.
- Verrouiller les lignes nécessaires avec `SELECT ... FOR UPDATE` lors d'une transition d'état concurrente.
- Utiliser un niveau d'isolation adapté et gérer les erreurs de concurrence; ne pas masquer les conflits.
- Les calculs du bulletin utilisent un même instantané transactionnel.

## 7. Sécurité PostgreSQL

- L'application ne se connecte jamais avec le superutilisateur PostgreSQL ni avec le propriétaire des migrations.
- Séparer au minimum le rôle de migration et le rôle d'exécution de l'application.
- Révoquer les privilèges inutiles sur le schéma `public`.
- Accorder uniquement `SELECT`, `INSERT`, `UPDATE` ou `DELETE` réellement nécessaires.
- Envisager la Row-Level Security pour limiter les enseignants à leurs affectations. Ne pas considérer la RLS comme un remplacement des contrôles FastAPI.
- Toute fonction `SECURITY DEFINER` doit avoir un propriétaire contrôlé, un `search_path` fixé explicitement et des privilèges d'exécution limités.
- Interdire le SQL dynamique avec saisie brute. Si du SQL dynamique est indispensable, employer `format('%I', identifier)` ou `format('%L', value)` selon le cas et justifier son usage.
- Ne jamais écrire dans les logs : mots de passe, hash, jetons, données médicales, documents ou informations personnelles complètes.
- Utiliser des données fictives dans les seeds et tests.
- Les erreurs retournées à l'utilisateur ne doivent pas révéler le schéma, les requêtes ou les secrets.
- Les sauvegardes doivent être chiffrées, séparées du serveur principal et restaurées régulièrement dans un environnement de test.

## 8. Règles pour écrire une migration

Avant d'écrire :

1. lire toutes les migrations existantes ;
2. vérifier la version réelle de PostgreSQL ;
3. identifier les données déjà présentes ;
4. préciser si la migration est additive, destructive ou nécessite une transformation ;
5. vérifier les décisions métier affectées.

Pendant l'écriture :

- créer une migration petite et cohérente ;
- nommer chaque contrainte et index ;
- ajouter les contraintes dans un ordre compatible avec les données existantes ;
- pour une grosse table, envisager `NOT VALID`, nettoyer les données puis `VALIDATE CONSTRAINT` ;
- éviter les verrous longs et expliquer tout risque de blocage ;
- ne jamais modifier une migration déjà appliquée dans un environnement partagé ;
- créer une nouvelle migration corrective ;
- ne pas exécuter automatiquement une migration destructive.

Après l'écriture :

1. appliquer la migration sur une base vide ;
2. appliquer la migration sur une base contenant des données fictives ;
3. tester les contraintes avec des insertions valides et invalides ;
4. tester le retour arrière si l'outil et l'opération le permettent ;
5. produire un `pg_dump --schema-only` ou une inspection équivalente pour vérifier le schéma final ;
6. annoncer les commandes réellement exécutées et leurs résultats.

## 9. Règles pour SQL et PL/pgSQL

- Préférer le SQL déclaratif aux boucles procédurales.
- Les fonctions sont courtes, mono-responsabilité et documentées.
- Qualifier les colonnes dans les requêtes comportant plusieurs tables.
- Éviter les fonctions `VOLATILE` lorsque `STABLE` ou `IMMUTABLE` est exact.
- Ne jamais marquer une fonction `IMMUTABLE` si elle lit une table ou dépend de l'heure.
- Gérer explicitement `NULL`; ne pas supposer que `NULL = NULL` est vrai.
- Utiliser `IS DISTINCT FROM` pour comparer de manière sûre avec `NULL`.
- Pour une exception attendue, choisir un code et un message précis; éviter `WHEN OTHERS` sans relance ni traitement justifié.
- Une procédure de clôture d'année doit être idempotente ou refuser clairement une deuxième clôture.
- Une fonction de calcul de moyenne doit définir : données retenues, absences, coefficients, barème, arrondi et cas sans note.
- Ne figer aucune règle d'arrondi sans validation métier. Le traitement des
  absences à une évaluation suit la règle validée de la section 3.5.

## 10. Tests de base de données obligatoires

Pour chaque table ou règle ajoutée, tester au minimum :

- insertion valide ;
- colonne obligatoire absente ;
- valeur hors domaine ;
- doublon interdit ;
- clé étrangère inexistante ;
- incohérence de dates ;
- incohérence conditionnelle entre deux colonnes ;
- violation d'une règle inter-table ;
- tentative de suppression d'une donnée historique ;
- tentative de modification d'une donnée immuable ;
- deux transactions concurrentes lorsque l'unicité ou la clôture peut subir une course.

Exemples indispensables :

- deux comptes avec le même matricule ;
- dossier enseignant lié à un compte élève ;
- deux années scolaires courantes ;
- période en dehors de son année ;
- deux inscriptions ouvertes pour le même élève ;
- note supérieure au barème ;
- note numérique avec `result_type = 'ABSENT'` ;
- retard sans minutes ou absence avec minutes ;
- note d'un autre élève ajoutée à un bulletin ;
- modification d'un bulletin validé.

## 11. Méthode de travail attendue de l'agent

Lorsqu'il reçoit une demande sur la base, l'agent doit :

1. reformuler brièvement l'objectif ;
2. identifier les tables et règles impactées ;
3. inspecter le code et les migrations existants ;
4. vérifier la compatibilité 3FN et les conséquences historiques ;
5. proposer la solution la plus simple qui protège réellement les données ;
6. distinguer clairement contraintes SQL, triggers, règles backend et affichage frontend ;
7. coder le plus petit changement complet ;
8. écrire les tests de réussite et d'échec ;
9. exécuter les tests pertinents ;
10. résumer les fichiers modifiés, les contraintes ajoutées et les décisions restant à valider.

L'agent ne doit pas :

- recréer `persons`, `courses` ou `course_sessions` sans validation ;
- ajouter une table ou un attribut « au cas où » ;
- supprimer une contrainte pour faire passer une insertion incorrecte ;
- déplacer toute l'intégrité vers FastAPI ;
- placer une règle métier uniquement dans React ;
- utiliser des triggers pour une règle qu'un `CHECK` ou une clé étrangère suffit à garantir ;
- prétendre qu'une migration ou un test fonctionne sans l'avoir exécuté ;
- lancer une opération destructive sur une base contenant des données réelles sans autorisation explicite.

## 12. Points encore à valider avant l'implémentation définitive

Ces sujets ne doivent pas être décidés silencieusement par l'agent :

- valeurs définitives de `gender` ;
- formule d'arrondi des moyennes ;
- personnes autorisées à justifier une absence et à valider un bulletin ;
- politique d'invalidation ou de nouvelle version d'un bulletin validé ;
- activation future des comptes élèves et responsables.

Tant que ces éléments ne sont pas validés, l'agent doit isoler les hypothèses et éviter les choix irréversibles.
