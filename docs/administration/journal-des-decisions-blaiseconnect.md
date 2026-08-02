# Journal des décisions — BlaiseConnect

Ce document conserve les décisions projet et leur état.

## Statuts

- ⬜ Proposition
- 🟨 À valider
- 🟩 Validée
- 🟥 Refusée

## Suivi des décisions

| N° | Date | Sujet | Décision | Statut |
|---:|---|---|---|---|
| D-001 | 26/07/2026 | État d'une année scolaire | `school_years` utilise `is_current`, `closed_at` et `closed_by_account_id`. Aucun champ `is_active` n'est ajouté. Une seule année peut être courante, mais l'année suivante peut être préparée à l'avance. | 🟩 Validée |
| D-002 | 26/07/2026 | Chevauchement des années | Les plages de dates de deux années scolaires ne peuvent pas se chevaucher. | 🟩 Validée |
| D-003 | 26/07/2026 | Clôture d'une année | Une année clôturée ne peut pas être rouverte dans la première version. La clôture termine automatiquement toutes ses inscriptions encore ouvertes à `end_date`, avec `end_reason = 'YEAR_COMPLETED'`. | 🟩 Validée |
| D-004 | 26/07/2026 | Périodes de bulletin | Les périodes sont flexibles et stockées dans `reporting_periods`. Elles peuvent représenter un mois, un trimestre, un semestre ou une autre plage définie par l'école. | 🟩 Validée |
| D-005 | 26/07/2026 | Continuité des périodes | Une année peut devenir courante sans période. L'administrateur choisit la date de fin de chaque période ; la première commence au début de l'année et chaque suivante commence le lendemain de la précédente. Les périodes sont ajoutées progressivement, sans chevauchement ni trou entre celles déjà définies. | 🟩 Validée |
| D-006 | 26/07/2026 | Évaluation et période | `assessments` ne stocke pas de `reporting_period_id`. La période d'une évaluation est déterminée par `assessment_date`. Les dates d'une période deviennent immuables dès qu'un bulletin lié est validé. | 🟩 Validée |
| D-007 | 26/07/2026 | Niveaux et classes | Les niveaux sont stockés dans `class_levels`. Une classe ne possède pas de champ `name` : son libellé est construit à partir du niveau et de `group_label`. La combinaison année, niveau et groupe est unique. | 🟩 Validée |
| D-008 | 26/07/2026 | Cycle de vie d'une classe | `capacity` est facultative et indicative. Une classe annuelle ne possède ni `is_active` ni `archived_at`; son historique est conservé par son année scolaire. | 🟩 Validée |
| D-009 | 26/07/2026 | Promotions | Le système de promotions n'est pas intégré au MVP. Il pourra être ajouté plus tard par une nouvelle migration si l'école confirme le besoin de suivre des cohortes sur plusieurs années. | 🟩 Validée |
| D-010 | 26/07/2026 | Professeur principal | Chaque classe référence un professeur principal avec `main_teacher_id`. Ses responsabilités et droits particuliers seront définis plus tard. | 🟩 Validée |
| D-011 | 26/07/2026 | Co-enseignement | Plusieurs enseignants peuvent être affectés simultanément à la même matière d'une même classe, notamment pour le co-enseignement et les remplacements. | 🟩 Validée |
| D-012 | 26/07/2026 | Portée des niveaux | La structure peut représenter tous les niveaux de la maternelle à la Terminale, mais seuls les niveaux utiles au pilote sont enregistrés initialement. | 🟩 Validée |
| D-013 | 26/07/2026 | Informations enseignant | Un enseignant peut avoir une photo facultative dans `photo_path`. Son email, lorsqu'il est renseigné, est unique sans tenir compte des majuscules. `account_id`, `first_name`, `last_name` et `hire_date` sont obligatoires; `birth_date`, `email`, `phone`, `address`, `qualification` et `photo_path` sont facultatifs. | 🟩 Validée |
| D-014 | 26/07/2026 | Photos des profils | Les dossiers `students` et `administrators` possèdent un champ facultatif `photo_path`. Les fichiers restent stockés hors de PostgreSQL ; seule leur référence est enregistrée. | 🟩 Validée |
| D-015 | 26/07/2026 | Genre et photo des profils | Les quatre profils (`students`, `teachers`, `administrators`, `guardians`) possèdent `gender` et `photo_path`. Ces champs restent facultatifs ; la liste des valeurs de `gender` doit encore être validée. | 🟩 Validée |
| D-016 | 26/07/2026 | Coefficients des matières | L'administrateur configure `class_subjects.coefficient` pour chaque matière d'une classe. Le coefficient est strictement positif ; la règle d'arrondi des moyennes reste à valider. | 🟩 Validée |
| D-017 | 26/07/2026 | Archivage des profils | Les élèves, enseignants, administrateurs et responsables peuvent être archivés logiquement avec `archived_at`. Un compte lié doit être inactif et archivé. Les classes ne sont pas archivables indépendamment de leur année scolaire. | 🟩 Validée |
| D-018 | 26/07/2026 | Codes des niveaux | Les codes de niveau et les cycles sont des énumérations partagées entre PostgreSQL et FastAPI. Le libellé d'une classe est construit avec le niveau et `group_label`, par exemple `TERMINALE-A`. | 🟩 Validée |
| D-019 | 26/07/2026 | États des comptes | L'état du compte se déduit de `is_active`, `locked_until` et `archived_at`; aucune colonne `status` redondante n'est ajoutée. Un compte archivé reste inactif et son matricule n'est jamais réutilisé. | 🟩 Validée |
| D-020 | 26/07/2026 | Statut scolaire d'un élève | `students.status` utilise `ACTIVE`, `INACTIVE` ou `ARCHIVED`. Ce statut est indépendant du compte : un verrouillage ou une désactivation du compte ne change pas la situation scolaire. | 🟩 Validée |
| D-021 | 28/07/2026 | Suppression d'une année ouverte | Un administrateur peut supprimer définitivement une année non clôturée et toutes ses données dépendantes après saisie exacte de son nom. Une année clôturée reste ineffaçable. La suppression est transactionnelle, protégée côté PostgreSQL et auditée. | 🟩 Validée |
| D-024 | 26/07/2026 | Fin d'une inscription | `student_enrollments.end_reason` utilise `YEAR_COMPLETED`, `CLASS_CHANGE` ou `LEFT_SCHOOL` afin de conserver la raison de fin et l'historique des classes. | 🟩 Validée |
| D-022 | 28/07/2026 | Modification d'une période | Modifier la fin d'une période décale automatiquement le début de la période suivante au lendemain. PostgreSQL refuse toute incohérence de dates. Le verrouillage après validation d'un bulletin sera branché lors de l'implémentation des bulletins. | 🟩 Validée |
| D-023 | 30/07/2026 | Génération des matricules | Le matricule conserve sept caractères : un préfixe de rôle (`a`, `e`, `u` ou `p`), un code UTC sur deux chiffres calculé avec l'année, le mois et le jour (`(année_courte × 372 + (mois - 1) × 31 + jour) modulo 100`), puis un code UTC sur quatre chiffres calculé avec l'heure, la minute et la seconde (`secondes écoulées depuis minuit modulo 10000`). Un verrou transactionnel propre au rôle, une recherche de valeur libre et la contrainte unique PostgreSQL protègent les créations simultanées. | 🟩 Validée |
| D-025 | 30/07/2026 | Rollback get_db() | Correctif appliqué : rollback explicite en cas d'exception avant fermeture de session, garantissant l'atomicité des transactions multi-tables. | 🟩 Validée |
| D-026 | 30/07/2026 | Suppression individuelle d'une classe | Un administrateur peut supprimer une classe individuellement si elle est vide (aucune inscription, aucune matière associée) et que son année n'est pas clôturée. La suppression est refusée par les contraintes `ON DELETE RESTRICT` sur `student_enrollments` et `class_subjects`, et par le trigger `protect_closed_class`. `GRANT DELETE ON TABLE classes TO blaise_app` est accordé. | 🟩 Validée |
| D-027 | 30/07/2026 | Révocation des sessions après réinitialisation du mot de passe | Lorsqu'un administrateur réinitialise le mot de passe d'un compte, toutes les sessions actives de ce compte sont immédiatement révoquées, forçant une reconnexion avec le nouveau mot de passe. | 🟩 Validée |
| D-028 | 30/07/2026 | Fusion des migrations | Les 8 migrations initiales ont été fusionnées en 5 fichiers cohérents : `001_db_access`, `002_accounts_and_profiles`, `003_student_guardians`, `004_school_structure`, `005_open_year_deletion`. La colonne `observations` a été retirée dès la migration 002. Les droits sur `student_guardians` et les colonnes `gender`/`photo_path` des responsables sont désormais complets. | 🟩 Validée |
| D-029 | 30/07/2026 | Réponse paginée `GET /accounts` | L'endpoint `GET /accounts` retourne `{items: [...], total: N}` au lieu d'un tableau nu. Le frontend utilise `total` pour les statistiques et `items` pour la liste. Un endpoint `GET /accounts/{id}` a été ajouté pour permettre le chargement direct par URL. | 🟩 Validée |
| D-030 | 02/08/2026 | Fin d'une affectation d'enseignement | Désaffecter un enseignant ne supprime pas son affectation : `teacher_assignments.end_date` conserve l'historique. Une affectation relie l'enseignant à une matière déjà associée à une classe ; le professeur principal reste défini séparément dans `classes.main_teacher_id`. | 🟩 Validée |
