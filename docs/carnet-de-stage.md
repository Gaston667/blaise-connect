# Carnet de stage — BlaiseConnect
- **20 juillet 2026 — Sprint 1 :** prise en main du dépôt et lecture des documents du projet.
- Les User Stories actives sont US-001, US-002 et US-025.
- PostgreSQL 16 fonctionne ; pgAdmin est activé dans Compose en attente de son secret local.
- **23 juillet 2026 — Sprint 1 :** les matricules commencent par `a`, `e`, `u` ou `p`, puis six chiffres.
- **22 juillet 2026 — Sprint 1 :** React est structuré en composants, pages, services, layouts, assets et styles.
- Les Dockerfiles, Compose et fichiers d'exclusion sont documentés et protègent les données générées.
- **Sécurité US-025 :** Argon2, le hash fictif anti-énumération et le contrôle des comptes verrouillés sont testés.
- La migration 001 est conservée ; le code V1 limitera l'authentification aux rôles `ADMIN` et `TEACHER`.
- **Prochaine étape :** implémenter et tester la route `POST /auth/login` de l'US-001.
