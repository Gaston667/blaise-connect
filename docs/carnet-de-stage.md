# Carnet de stage — BlaiseConnect
- **20 juillet 2026 — Sprint 1 :** prise en main du dépôt et lecture des documents du projet.
- Les User Stories actives sont US-001, US-002 et US-025.
- PostgreSQL 16 fonctionne ; pgAdmin est activé dans Compose en attente de son secret local.
- Le backend FastAPI possède SQLAlchemy, Psycopg et `/health` ; le venv local a été supprimé au profit de Docker.
- React a été initialisé avec Vite 8 ; son Dockerfile de développement utilise Node.js 22.
- Les Dockerfiles, Compose et fichiers d'exclusion sont documentés et protègent les données générées.
- Un rapport de sécurité PostgreSQL a été ajouté dans `database/docs/`.
- La migration 001 reste bloquée par une contradiction sur les comptes élève et responsable.
- **Prochaine étape :** créer le secret pgAdmin, puis intégrer et tester le frontend avec Compose.
