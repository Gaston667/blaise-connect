# Cartographie des rubriques et fichiers du projet

Ce document indique, pour chaque rubrique de BlaiseConnect, les principaux fichiers qui participent à son fonctionnement.

## Fichiers transversaux

### Frontend

- `frontend/src/App.jsx` : point central de navigation entre les pages.
- `frontend/src/main.jsx` : démarrage React.
- `frontend/src/layouts/main_layout.jsx` : structure générale après connexion.
- `frontend/src/components/sidebar.jsx` : menu latéral.
- `frontend/src/components/app_header.jsx` : en-tête.
- `frontend/src/components/notification_popup.jsx` : messages utilisateur.
- `frontend/src/components/confirmation_popup.jsx` : confirmations.
- `frontend/src/utils/apiErrorHandler.js` : appels API et gestion des erreurs.
- `frontend/src/styles/variables.css` : couleurs et charte.
- `frontend/src/styles/global.css` : règles globales.
- `frontend/src/styles/layout.css` : mise en page principale.

### Backend

- `backend/app/main.py` : création de l’application FastAPI et enregistrement des routes.
- `backend/app/core/database.py` : connexion PostgreSQL.
- `backend/app/core/authentication.py` : dépendances d’authentification.
- `backend/app/core/security.py` : hash et vérification des mots de passe.
- `backend/app/core/exception_handlers.py` : traduction des erreurs.

### Base de données

- `database/migration/001_db_access.sql` : accès base et rôle applicatif.
- `database/migration/002_accounts_and_profiles.sql` : comptes et profils.
- `database/migration/003_relationships_and_documents.sql` : responsables et documents.
- `database/migration/004_school_structure.sql` : années, périodes, classes, matières.
- `database/migration/005_academic_activity.sql` : affectations, évaluations, notes, absences.
- `database/migration/006_report_cards_year_deletion.sql` : bulletins et audit de suppression d’année.
- `database/migration/007_timetable.sql` : emploi du temps.
- `database/init/*.sql` : données fictives de développement.

## Connexion et session

### Frontend

- `frontend/src/pages/login_page.jsx`
- `frontend/src/pages/logout_button.jsx`
- `frontend/src/services/auth_service.js`
- `frontend/src/styles/connexion.css`

### Backend

- `backend/app/routes/auth.py`
- `backend/app/services/auth_service.py`
- `backend/app/services/session_service.py`
- `backend/app/models/account.py`
- `backend/app/models/auth_session.py`
- `backend/app/schemas/login_request.py`
- `backend/app/schemas/login_response.py`
- `backend/app/schemas/current_account_response.py`

## Tableau de bord

### Frontend

- `frontend/src/pages/home_page.jsx`
- `frontend/src/styles/dashboard.css`

### Backend

- Pas de route dédiée complète pour le moment. Les données viennent surtout des rubriques métier.

## Gestion des comptes

### Frontend

- `frontend/src/pages/accounts_page.jsx`
- `frontend/src/pages/account_create_page.jsx`
- `frontend/src/pages/account_details_page.jsx`
- `frontend/src/services/account_service.js`
- `frontend/src/services/password_generator.js`
- `frontend/src/utils/profileDisplay.js`
- `frontend/src/styles/accounts_list.css`
- `frontend/src/styles/accounts_overview.css`
- `frontend/src/styles/account_create.css`
- `frontend/src/styles/account_details.css`

### Backend

- `backend/app/routes/accounts.py`
- `backend/app/routes/account_files.py`
- `backend/app/services/account_service.py`
- `backend/app/services/account_storage_service.py`
- `backend/app/services/profile_photo_service.py`
- `backend/app/models/account.py`
- `backend/app/schemas/account_create.py`
- `backend/app/schemas/account_complete_create.py`
- `backend/app/schemas/account_profile_create.py`
- `backend/app/schemas/account_response.py`
- `backend/app/schemas/account_profile_response.py`
- `backend/app/schemas/account_update.py`
- `backend/app/schemas/account_password_reset.py`
- `backend/app/schemas/registration_number.py`

## Élèves

### Frontend

- `frontend/src/pages/students_page.jsx`
- `frontend/src/pages/student_details_page.jsx`
- `frontend/src/pages/student_grades_page.jsx`
- `frontend/src/services/students_service.js`
- `frontend/src/services/student_grades_service.js`
- `frontend/src/styles/students_page.css`
- `frontend/src/styles/students_shared.css`
- `frontend/src/styles/student_details_page.css`
- `frontend/src/styles/student_grades_page.css`

### Backend

- `backend/app/routes/students.py`
- `backend/app/routes/student_grades.py`
- `backend/app/services/student_service.py`
- `backend/app/services/student_document_service.py`
- `backend/app/services/student_grade_service.py`
- `backend/app/services/student_specialty_service.py`
- `backend/app/models/student.py`
- `backend/app/schemas/student_response.py`
- `backend/app/schemas/student_update.py`
- `backend/app/schemas/student_enrollment_create.py`
- `backend/app/schemas/student_guardian_response.py`
- `backend/app/schemas/student_academic_summary.py`
- `backend/app/schemas/student_specialties_update.py`

## Responsables légaux

### Frontend

- `frontend/src/pages/guardians_page.jsx`
- `frontend/src/pages/guardian_details_page.jsx`
- `frontend/src/components/add_guardian_modal.jsx`
- `frontend/src/services/guardians_service.js`
- `frontend/src/services/guardians_overview_service.js`
- `frontend/src/styles/guardians_page.css`
- `frontend/src/styles/guardian_details_page.css`

### Backend

- `backend/app/routes/guardians.py`
- `backend/app/services/guardian_service.py`
- `backend/app/models/guardian.py`
- `backend/app/schemas/guardian_create.py`
- `backend/app/schemas/guardian_update.py`
- `backend/app/schemas/guardian_response.py`
- `backend/app/schemas/guardian_detail.py`
- `backend/app/schemas/guardian_link_create.py`
- `backend/app/schemas/guardian_link_update.py`

## Enseignants

### Frontend

- `frontend/src/pages/teachers_page.jsx`
- `frontend/src/pages/teacher_details_page.jsx`
- `frontend/src/pages/teacher_timetable_page.jsx`
- `frontend/src/services/teacher_service.js`
- `frontend/src/services/teachers_overview_service.js`
- `frontend/src/services/teacher_timetable_service.js`
- `frontend/src/styles/teachers_page.css`
- `frontend/src/styles/teacher_details_page.css`

### Backend

- `backend/app/routes/teachers.py`
- `backend/app/routes/teacher_timetable.py`
- `backend/app/services/teacher_service.py`
- `backend/app/models/teacher.py`
- `backend/app/schemas/teacher_create.py`
- `backend/app/schemas/teacher_update.py`
- `backend/app/schemas/teacher_response.py`
- `backend/app/schemas/teacher_detail.py`
- `backend/app/schemas/teacher_assignment_create.py`
- `backend/app/schemas/teacher_assignment_end.py`
- `backend/app/schemas/teacher_assignment_option.py`

## Administrateurs

### Frontend

- `frontend/src/pages/administrators_page.jsx`
- `frontend/src/pages/administrator_details_page.jsx`
- `frontend/src/services/administrators_overview_service.js`
- `frontend/src/styles/administrators_page.css`
- `frontend/src/styles/administrator_details_page.css`

### Backend

- `backend/app/routes/administrators.py`
- `backend/app/services/administrator_service.py`
- `backend/app/models/administrator.py`
- `backend/app/schemas/administrator_update.py`
- `backend/app/schemas/administrator_overview.py`

## Années scolaires et périodes

### Frontend

- `frontend/src/pages/school_years_page.jsx`
- `frontend/src/pages/school_year_details_page.jsx`
- `frontend/src/services/school_year_service.js`
- `frontend/src/styles/school_years.css`

### Backend

- `backend/app/routes/school_years.py`
- `backend/app/routes/reporting_periods.py`
- `backend/app/services/school_year_service.py`
- `backend/app/services/reporting_period_service.py`
- `backend/app/models/school_year.py`
- `backend/app/models/school_period.py`
- `backend/app/schemas/school_year_create.py`
- `backend/app/schemas/school_year_update.py`
- `backend/app/schemas/school_year_details_response.py`
- `backend/app/schemas/reporting_period_create.py`
- `backend/app/schemas/reporting_period_update.py`

## Classes

### Frontend

- `frontend/src/pages/school_classes_page.jsx`
- `frontend/src/pages/school_class_details_page.jsx`
- `frontend/src/services/school_class_service.js`
- `frontend/src/services/school_classes_overview_service.js`
- `frontend/src/styles/school_classes_page.css`
- `frontend/src/styles/school_class_details_page.css`

### Backend

- `backend/app/routes/school_classes.py`
- `backend/app/routes/class_levels.py`
- `backend/app/services/school_class_service.py`
- `backend/app/models/school_class.py`
- `backend/app/models/class_level.py`
- `backend/app/models/class_subject.py`
- `backend/app/schemas/school_class_create.py`
- `backend/app/schemas/school_class_update.py`
- `backend/app/schemas/school_class_response.py`
- `backend/app/schemas/school_class_detail.py`
- `backend/app/schemas/school_class_overview.py`
- `backend/app/schemas/class_level_response.py`

## Matières

### Frontend

- `frontend/src/pages/subjects_page.jsx`
- `frontend/src/pages/subject_details_page.jsx`
- `frontend/src/services/subject_service.js`
- `frontend/src/styles/subjects_page.css`
- `frontend/src/styles/subject_details_page.css`

### Backend

- `backend/app/routes/subjects.py`
- `backend/app/services/subject_service.py`
- `backend/app/models/subject.py`
- `backend/app/models/class_subject.py`
- `backend/app/schemas/subject_create.py`
- `backend/app/schemas/subject_update.py`
- `backend/app/schemas/subject_response.py`
- `backend/app/schemas/subject_detail.py`
- `backend/app/schemas/subject_overview.py`
- `backend/app/schemas/class_subject_create.py`
- `backend/app/schemas/class_subject_response.py`

## Notes, évaluations et corrections

### Frontend

- `frontend/src/pages/notes_page.jsx`
- `frontend/src/services/notes_service.js`
- `frontend/src/styles/notes_page.css`

### Backend

- `backend/app/routes/assessments.py`
- `backend/app/routes/grades.py`
- `backend/app/routes/grade_change_requests.py`
- `backend/app/services/assessment_service.py`
- `backend/app/services/grade_service.py`
- `backend/app/services/grade_change_request_service.py`
- `backend/app/services/grade_justification_service.py`
- `backend/app/services/academic_calculation_service.py`
- `backend/app/core/grade_authorization.py`
- `backend/app/schemas/assessment_create.py`
- `backend/app/schemas/assessment_update.py`
- `backend/app/schemas/assessment_overview.py`
- `backend/app/schemas/assessment_grade_sheet_response.py`
- `backend/app/schemas/grade_create.py`
- `backend/app/schemas/grade_sheet_submit.py`
- `backend/app/schemas/grade_change_request_create.py`
- `backend/app/schemas/grade_change_request_response.py`

## Absences et justificatifs

### Frontend

- `frontend/src/pages/attendance_page.jsx` : interface selon le rôle ADMIN, TEACHER ou STUDENT.
- `frontend/src/services/attendance_service.js` : appels HTTP des appels, incidents, corrections et justificatifs.
- `frontend/src/styles/attendance_page.css` : styles mobile-first de la rubrique.
- `frontend/src/App.jsx` et `frontend/src/components/sidebar.jsx` : route et navigation.
- Les absences d’évaluation restent dans `frontend/src/pages/notes_page.jsx`.
- Les documents généraux des élèves restent dans `frontend/src/pages/student_details_page.jsx`.

### Backend

- `backend/app/routes/attendance.py`
- `backend/app/services/attendance_service.py`
- `backend/app/services/attendance_document_service.py`
- `backend/app/schemas/attendance_*.py`
- `backend/app/services/grade_justification_service.py`
- `backend/app/routes/grades.py`
- `database/migration/008_attendance.sql` contient les tables d’assiduité de cours.
- `compose.yaml` monte la migration 008 lors de l’initialisation d’une base neuve.

## Emploi du temps

### Frontend

- `frontend/src/pages/timetable_management_page.jsx`
- `frontend/src/pages/student_timetable_page.jsx`
- `frontend/src/pages/teacher_timetable_page.jsx`
- `frontend/src/services/timetable_service.js`
- `frontend/src/services/student_timetable_service.js`
- `frontend/src/services/teacher_timetable_service.js`
- `frontend/src/utils/timetable_display.js`
- `frontend/src/styles/timetable_management_page.css`
- `frontend/src/styles/student_timetable_page.css`

### Backend

- `backend/app/routes/timetables.py`
- `backend/app/routes/student_timetable.py`
- `backend/app/routes/teacher_timetable.py`
- `backend/app/services/timetable_service.py`
- `backend/app/schemas/school_day_schedule_upsert.py`
- `backend/app/schemas/break_schedule_create.py`
- `backend/app/schemas/weekly_subject_requirement_upsert.py`
- `backend/app/schemas/timetable_generation_request.py`
- `backend/app/schemas/timetable_slot_create.py`
- `backend/app/schemas/special_course_create.py`
- `backend/app/schemas/room_create.py`

## Documents et stockage

### Frontend

- `frontend/src/pages/student_details_page.jsx`
- `frontend/src/services/students_service.js`

### Backend

- `backend/app/routes/students.py`
- `backend/app/routes/account_files.py`
- `backend/app/services/account_storage_service.py`
- `backend/app/services/student_document_service.py`
- `backend/app/services/profile_photo_service.py`

### Stockage local

- `storage/accounts/` : dossiers privés des comptes.
- `storage/accounts/<matricule>/photos/` : photos.
- `storage/accounts/<matricule>/documents/` : documents généraux.
- `storage/accounts/<matricule>/justificatifs/` : justificatifs.
- `storage/accounts/<matricule>/bulletins/` : bulletins.

## Documentation et suivi

- `AGENTS.md` : règles globales du projet.
- `docs/carnet-de-stage.md` : avancement court du projet.
- `docs/architecture-technique.md` : architecture générale.
- `docs/administration/journal-des-decisions-blaiseconnect.md` : décisions métier.
- `docs/administration/product-backlog-blaiseconnect-v0.1.md` : backlog.
- `docs/administration/sprint-planning-blaiseconnect-5-semaines.md` : sprint planning.
- `docs/diagramme/*.plantuml` : diagrammes.
- `database/docs/RAPPORT_SECURITE_BD.md` : sécurité base de données.
