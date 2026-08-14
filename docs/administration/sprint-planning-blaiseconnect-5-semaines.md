# Sprint Planning — BlaiseConnect

**Période :** du 20 juillet au 21 août 2026  
**Durée :** 5 sprints d’une semaine  
**Version :** 0.2 — planning simplifié  

## Utilisation du tableau

- **US** : identifiant de la User Story dans le Product Backlog.
- **Deadline** : date à laquelle la User Story doit être terminée et testée.
- **Nom de l’US** : titre court de la fonctionnalité.
- **Description** : besoin exprimé sous forme de User Story.
- **Statut** : état actuel de la User Story.
- **Fichiers concernés** : fichiers réellement créés ou modifiés. Cette colonne sera complétée pendant le développement.

### Statuts utilisés

- 🟩 Terminé
- 🟨 En cours
- 🟥 À faire

---

## Semaine 1 — Du 20 au 24 juillet 2026

**Objectif :** mettre en place la connexion, les comptes et les premiers droits d’accès.

| US | Deadline | Nom de l’US | Description de l’US | Statut | Fichiers concernés |
|---|---|---|---|---|---|
| US-001 | 22/07/2026 | Connexion et déconnexion | En tant qu’utilisateur, je veux me connecter avec mon compte personnel afin d’accéder aux fonctionnalités autorisées par mon rôle. | 🟩 Terminé | `backend/app/routes/auth.py`, `backend/app/services/auth_service.py`, `backend/app/services/session_service.py`, `frontend/src/pages/login_page.jsx`, `frontend/src/pages/home_page.jsx`, `frontend/src/services/auth_service.js`, `backend/tests/services/` |
| US-002 | 23/07/2026 | Gestion des comptes et rôles | En tant qu'administrateur, je veux gérer les comptes utilisateurs afin de contrôler l'accès à BlaiseConnect. | 🟩 Terminé | `backend/app/models/account.py`, `backend/app/schemas/account_*.py`, `backend/app/routes/accounts.py`, `backend/app/services/account_service.py`, `frontend/src/App.jsx`, `frontend/src/layouts/main_layout.jsx`, `frontend/src/components/`, `frontend/src/pages/accounts_page.jsx`, `frontend/src/styles/App.css` |
| US-025 | 24/07/2026 | Sécurité des accès | En tant qu’établissement, je veux sécuriser les accès et les sessions afin de protéger les données scolaires. | 🟨 En cours | `backend/app/core/security.py`, `backend/app/core/authentication.py`, `backend/app/core/session_cookie_config.py`, `database/migration/001_db_access.sql`, `database/migration/002_accounts_and_profiles.sql`, `database/migration/003_relationships_and_documents.sql`, `compose.yaml` |

---

## Semaine 2 — Du 27 au 31 juillet 2026

**Objectif :** permettre à l’administrateur de configurer la structure scolaire.

| US | Deadline | Nom de l’US | Description de l’US | Statut | Fichiers concernés |
|---|---|---|---|---|---|
| US-003 | 28/07/2026 | Années et périodes scolaires | En tant qu’administrateur, je veux gérer les années et périodes scolaires afin d’organiser les données dans le temps. | 🟩 Terminé | `backend/app/models/school_year.py`, `backend/app/models/school_period.py`, `backend/app/schemas/school_year_*.py`, `backend/app/schemas/reporting_period_*.py`, `backend/app/routes/school_years.py`, `backend/app/routes/reporting_periods.py`, `backend/app/services/school_year_service.py`, `backend/app/services/reporting_period_service.py`, `backend/app/core/school_year_periods_mismatch_error.py`, `backend/app/core/school_year_confirmation_mismatch_error.py`, `database/migration/006_report_cards_and_year_deletion.sql`, `backend/tests/services/test_school_year_service.py`, `backend/tests/services/test_reporting_period_service.py`, `frontend/src/pages/school_years_page.jsx`, `frontend/src/pages/school_year_details_page.jsx`, `frontend/src/services/school_year_service.js`, `docs/diagramme/diagramme_mvc_us_003.plantuml` |
| US-004 | 29/07/2026 | Gestion des classes | En tant qu'administrateur, je veux gérer les classes afin d'organiser les élèves et les enseignements. | 🟩 Terminé | `backend/app/models/school_class.py`, `backend/app/schemas/school_class_*.py`, `backend/app/routes/school_classes.py`, `backend/app/services/school_class_service.py`, `database/migration/004_school_structure.sql`, `frontend/src/pages/school_classes_page.jsx`, `frontend/src/pages/school_class_details_page.jsx`, `frontend/src/services/school_classes_overview_service.js` |
| US-005 | 30/07/2026 | Gestion des matières | En tant qu’administrateur, je veux gérer les matières et leurs coefficients afin de configurer les enseignements et les calculs. | 🟩 Terminé | `backend/app/models/subject.py`, `backend/app/models/class_subject.py`, `backend/app/schemas/subject_*.py`, `backend/app/schemas/class_subject_*.py`, `backend/app/routes/subjects.py`, `backend/app/services/subject_service.py`, `frontend/src/pages/subjects_page.jsx`, `frontend/src/pages/subject_details_page.jsx`, `frontend/src/services/subject_service.js`, `frontend/src/styles/subject_details_page.css` |
| US-006 | 31/07/2026 | Gestion des enseignants | En tant qu’administrateur, je veux gérer les enseignants afin de conserver leurs informations et préparer leurs affectations. | 🟩 Terminé | `backend/app/models/teacher.py`, `backend/app/schemas/teacher_*.py`, `backend/app/routes/teachers.py`, `backend/app/services/teacher_service.py`, `frontend/src/pages/teachers_page.jsx`, `frontend/src/pages/teacher_details_page.jsx`, `frontend/src/services/teachers_overview_service.js`, `frontend/src/styles/teacher_details_page.css` |

**Fichiers transversaux du Sprint 2 :** `docs/diagramme/diagramme_mvc_sprint_2.plantuml`, `docs/diagramme/diagrame_classe.plantuml`, `docs/administration/journal-des-decisions-blaiseconnect.md`.

---

## Semaine 3 — Du 3 au 7 août 2026

**Objectif :** enregistrer les élèves, leurs responsables et leurs relations avec les classes et les enseignants.

| US | Deadline | Nom de l’US | Description de l’US | Statut | Fichiers concernés |
|---|---|---|---|---|---|
| US-007 | 04/08/2026 | Affectation des enseignants | En tant qu’administrateur, je veux affecter un enseignant à des classes et des matières afin de définir les enseignements dont il est responsable. | 🟨 En cours | `database/migration/005_academic_activity.sql`, `backend/app/routes/teachers.py`, `backend/app/services/teacher_service.py`, `backend/app/schemas/teacher_assignment_*.py`, `frontend/src/pages/teacher_details_page.jsx`, `frontend/src/services/teachers_overview_service.js` |
| US-008 | 05/08/2026 | Gestion des élèves | En tant qu’administrateur, je veux gérer les fiches des élèves afin de centraliser les informations nécessaires à leur suivi scolaire. | 🟩 Terminé | `backend/app/models/student.py`, `backend/app/schemas/student_*.py`, `backend/app/routes/students.py`, `backend/app/services/student_service.py`, `frontend/src/pages/students_page.jsx`, `frontend/src/pages/student_details_page.jsx`, `frontend/src/services/students_service.js`, `frontend/src/styles/students_page.css`, `frontend/src/styles/student_details_page.css` |
| US-010 | 06/08/2026 | Gestion des responsables légaux | En tant qu’administrateur, je veux gérer les responsables légaux et les associer aux élèves afin de conserver les contacts familiaux utiles. | 🟩 Terminé | `backend/app/models/guardian.py`, `backend/app/schemas/guardian_*.py`, `backend/app/routes/guardians.py`, `backend/app/services/guardian_service.py`, `frontend/src/pages/guardians_page.jsx`, `frontend/src/pages/guardian_details_page.jsx`, `frontend/src/pages/student_details_page.jsx`, `frontend/src/services/guardians_service.js`, `frontend/src/services/guardians_overview_service.js` |
| US-011 | 07/08/2026 | Inscription des élèves | En tant qu’administrateur, je veux inscrire un élève dans une classe pour une année scolaire afin de conserver son parcours scolaire. | 🟩 Terminé | `backend/app/schemas/student_enrollment_create.py`, `backend/app/routes/students.py`, `backend/app/services/student_service.py`, `frontend/src/pages/student_details_page.jsx`, `frontend/src/services/students_service.js` |
| US-012 | 07/08/2026 | Consultation des élèves | En tant qu’utilisateur autorisé, je veux rechercher et consulter un élève afin d’accéder aux informations nécessaires à mon travail. | 🟩 Terminé | `backend/app/routes/students.py`, `backend/app/services/student_service.py`, `frontend/src/pages/students_page.jsx`, `frontend/src/pages/student_details_page.jsx`, `frontend/src/services/students_service.js` |

**Tâche complémentaire du Sprint 3 :** implémenter la suppression contrôlée d’une année scolaire dans un service FastAPI transactionnel : vérifier que l’année est ouverte et non clôturée, demander une confirmation exacte, créer `school_year_deletion_audits`, supprimer l’année et ses dépendances atomiquement, puis verrouiller la ligne pour éviter les suppressions concurrentes.

---

## Semaine 4 — Du 10 au 14 août 2026

**Objectif :** permettre aux enseignants de créer des évaluations, saisir les notes et consulter les moyennes.

| US | Deadline | Nom de l’US | Description de l’US | Statut | Fichiers concernés |
|---|---|---|---|---|---|
| US-013 | 11/08/2026 | Création des évaluations | En tant qu’enseignant, je veux créer une évaluation pour l’une de mes classes et matières afin de préparer la saisie des résultats. | 🟩 Terminé | `backend/app/routes/assessments.py`, `backend/app/services/assessment_service.py`, `backend/app/schemas/assessment_*.py`, `frontend/src/pages/notes_page.jsx`, `frontend/src/services/notes_service.js` |
| US-014 | 13/08/2026 | Saisie des notes | En tant qu’enseignant, je veux saisir les notes de mes élèves pour une évaluation afin d’enregistrer leurs résultats. | 🟩 Terminé | Feuille collective dans `backend/app/services/assessment_service.py`, `backend/app/schemas/grade_sheet_*.py`, `frontend/src/pages/notes_page.jsx` et tests ciblés dans `backend/tests/` |
| US-015 | 14/08/2026 | Calcul des moyennes | En tant qu’utilisateur autorisé, je veux que les moyennes soient calculées automatiquement afin d’obtenir des résultats fiables par matière et par période. | 🟩 Terminé | Calculs backend dans `backend/app/services/academic_calculation_service.py`, `assessment_service.py` et `subject_service.py` ; arrondi fixé à deux décimales |
| US-016 | 14/08/2026 | Correction des notes | En tant qu’enseignant, je veux demander une correction contrôlée d’une note existante. | 🟩 Terminé | `backend/app/routes/grade_change_requests.py`, `backend/app/services/grade_change_request_service.py`, schémas associés et interface dans `frontend/src/pages/notes_page.jsx` |

---

## Semaine 5 — Du 17 au 21 août 2026

**Objectif :** générer un bulletin simple, tester le parcours complet et préparer la démonstration finale.

| US | Deadline | Nom de l’US | Description de l’US | Statut | Fichiers concernés |
|---|---|---|---|---|---|
| US-017 | 18/08/2026 | Saisie des appréciations | En tant qu’enseignant, je veux ajouter une appréciation sur le travail d’un élève afin de compléter ses résultats et son bulletin. | À tester | `database/migration/009_appreciations.sql`, `backend/app/routes/appreciations.py`, `backend/app/services/appreciation_service.py`, `frontend/src/pages/appreciations_page.jsx` |
| US-021 | 19/08/2026 | Génération du bulletin PDF | En tant qu’administrateur, je veux vérifier et générer le bulletin PDF d’un élève afin de fournir un document scolaire imprimable. | 🟥 À faire | `database/migration/006_report_cards_and_year_deletion.sql`, `docs/diagramme/database_05_report_cards.plantuml` ; génération PDF à créer |
| US-027 | 20/08/2026 | Sauvegarde des données | En tant qu’administrateur technique, je veux sauvegarder les données et les fichiers afin de limiter le risque de perte. | 🟥 À faire | À compléter pendant le développement |
| US-028 | 21/08/2026 | Version pilote | En tant que responsable de l’établissement, je veux utiliser une version pilote de BlaiseConnect afin de vérifier son fonctionnement avant une ouverture plus large. | 🟥 À faire | À compléter pendant le développement |

## User Stories non planifiées pendant les cinq semaines

| US | Nom | Statut |
|---|---|---|
| US-009 | Cycle de vie complet des élèves | 🟥 À faire |
| US-016 | Validation des modifications de notes | 🟩 Terminé |
| US-018 et US-019 | Gestion complète des absences de cours | 🟨 En cours — migration 008, API et interfaces créées ; tests réels restant à faire |
| US-020 | Absences aux évaluations | 🟩 Terminé |
| US-022 | Versionnement des bulletins | 🟥 À faire |
| US-023 et US-024 | Tableaux de bord | 🟥 À faire |
| US-026 | Historique général des actions | 🟥 À faire |
| US-029 à US-037 | Fonctionnalités prévues pour les versions futures | 🟥 À faire |
us30 : gerer le renvoie des des profs et la reaffectation a un nouveaux profs 

## Mise à jour pendant le stage

Lorsqu’une User Story avance :

1. mettre à jour son statut ;
2. ajouter les fichiers réellement créés ou modifiés ;
3. modifier la deadline uniquement si le changement est justifié ;
4. déplacer une User Story non terminée dans le sprint suivant ;
5. enregistrer dans le journal des décisions tout changement important de priorité ou de périmètre.
