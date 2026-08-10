# Architecture technique de BlaiseConnect

## Organisation générale

| Zone | Rôle |
|---|---|
| `frontend/` | Interface React/Vite affichée dans le navigateur. |
| `backend/` | API FastAPI, règles métier et accès PostgreSQL. |
| `database/` | Création du schéma, migrations, données fictives et scripts d'initialisation. |
| `docs/` | Diagrammes, décisions et documentation du projet. |
| `compose.yaml` | Lance PostgreSQL, backend, frontend et pgAdmin en développement. |

## Frontend : `frontend/src`

| Groupe | Fichiers | Rôle |
|---|---|---|
| `pages/` | `.jsx` | Une page complète : comptes, élèves, emploi du temps… |
| `components/` | `.jsx` | Élément réutilisable d'une page : modal, tableau, barre latérale… |
| `layouts/` | `.jsx` | Structure commune d'écran : en-tête, navigation, zone principale. |
| `services/` | `.js` | Appels HTTP vers FastAPI. Aucun calcul métier officiel ici. |
| `utils/` | `.js` | Petites fonctions techniques réutilisables, sans règle métier officielle. |
| `hooks/` | `.js` | Logique React réutilisable utilisant des états ou effets. |
| `styles/` | `.css` | Styles par page ou composant. `global.css` : règles communes ; `variables.css` : charte graphique. |
| `assets/` | images, icônes | Ressources affichées par l'interface. |
| `App.jsx` | `.jsx` | Point central des routes, droits et pages affichées. |
| `main.jsx` | `.jsx` | Démarre React dans `index.html`. |

### Emploi du temps côté frontend

- `pages/timetable_management_page.jsx` : écran administrateur ; sélection de classe, brouillon, validation et cours particuliers.
- `services/timetable_service.js` : seul point d'appel de l'API emploi du temps.
- `pages/student_timetable_page.jsx` et `pages/teacher_timetable_page.jsx` : lecture du planning validé.
- `styles/timetable_management_page.css` : styles dédiés.

Les horaires, pauses, volumes et conflits ne doivent pas être décidés par React : ils viennent du backend et de PostgreSQL.

## Backend : `backend/app`

| Groupe | Fichiers | Rôle |
|---|---|---|
| `routes/` | `.py` | Endpoints HTTP FastAPI ; reçoit la requête et appelle un service. |
| `schemas/` | `.py` | Contrats Pydantic : données reçues et réponses contrôlées. |
| `services/` | `.py` | Règles métier, transactions et requêtes SQLAlchemy. |
| `models/` | `.py` | Modèles SQLAlchemy représentant les tables. |
| `core/` | `.py` | Configuration, connexion BD, authentification, erreurs et sécurité. |
| `main.py` | `.py` | Crée FastAPI et enregistre les routeurs. |

### Emploi du temps côté backend

- `routes/timetables.py` : API réservée à l'administrateur.
- `services/timetable_service.py` : configuration des horaires et pauses, génération du brouillon, validation, créneaux et cours individuels.
- `schemas/school_day_schedule_upsert.py` : horaire d'un cycle pour un jour.
- `schemas/break_schedule_create.py` : pause d'une journée configurée.
- `schemas/weekly_subject_requirement_upsert.py` : minutes hebdomadaires d'une matière pour un niveau.
- `schemas/timetable_generation_request.py` : demande de génération.
- `schemas/timetable_slot_create.py` et `schemas/special_course_create.py` : création manuelle des créneaux.

Le backend prépare un brouillon ; PostgreSQL refuse les conflits. Seule la validation publie un planning.

## Base de données : `database`

| Groupe | Fichiers | Rôle |
|---|---|---|
| `migration/` | `.sql` | Les six étapes versionnées de création du schéma. |
| `schema/` | `.sql` | Fragment SQL inclus par une migration pour conserver un gros sujet lisible ; ce n'est pas une migration supplémentaire. |
| `init/` | `.sql` | Données fictives locales, exécutées seulement lors de l'initialisation d'une base neuve. |

### Emploi du temps côté base

- `schema/timetable_schema.sql` crée les salles, horaires de journée, pauses, volumes par niveau, versions de planning, créneaux et cours particuliers.
- Les contraintes et triggers bloquent les chevauchements, les créneaux pendant une pause et les modifications d'un planning archivé.

## Règle de circulation d'une donnée

`Page JSX` → `service JS` → `route FastAPI` → `schéma Pydantic` → `service Python` → `PostgreSQL`.

Une règle importante est validée au moins dans FastAPI et, lorsqu'elle protège l'historique ou l'intégrité, dans PostgreSQL.
