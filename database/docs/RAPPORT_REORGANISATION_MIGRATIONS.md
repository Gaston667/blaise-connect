# Rapport de réorganisation des migrations

Date : 26 juillet 2026.

## Résultat

La séquence a été consolidée en quatre migrations destinées à initialiser une base vide :

1. `001_grant_application_privileges.sql` : révoque les droits publics inutiles et accorde uniquement la connexion à la base et l'usage du schéma à `blaise_app`.
2. `002_create_accounts_and_profiles.sql` : crée les comptes, sessions, élèves, enseignants, administrateurs et responsables, avec genre, photo et archivage logique.
3. `003_grant_account_profile_privileges.sql` : accorde les droits utiles `SELECT`, `INSERT` et `UPDATE`. Aucun droit `DELETE` n'est accordé.
4. `004_create_school_structure.sql` : crée les années, périodes, niveaux, classes, matières et coefficients ainsi que leurs contraintes et droits applicatifs.

## Docker Compose

Le service PostgreSQL monte uniquement ces quatre fichiers, dans cet ordre, après la création du rôle `blaise_app`.

## Sécurité et intégrité

- L'application ne reçoit aucun droit de création dans le schéma.
- Les suppressions physiques restent interdites à `blaise_app`.
- Les profils archivés avec un compte exigent un compte inactif et archivé.
- Les classes ne possèdent pas d'archivage indépendant.
- Les rôles des comptes liés aux profils sont contrôlés par des triggers différables.
- Une année peut être courante sans période. Les périodes sont ensuite ajoutées progressivement à partir d'une date de fin choisie par l'administrateur.
- Les codes des niveaux et des cycles sont des énumérations ; PostgreSQL refuse un code inconnu ou un niveau associé au mauvais cycle.

## Vérification effectuée

Seuls la présence des quatre fichiers, leur ordre, leurs références documentaires et la configuration Compose ont été contrôlés statiquement.

Les migrations n'ont pas été exécutées, conformément à la demande. Elles doivent être testées sur une base temporaire ou vide avant toute réinitialisation du volume principal.

## Attention

Cette consolidation redéfinit le sens des numéros 001 à 004. Elle convient à une nouvelle base vide, mais ne doit pas être rejouée directement sur la base existante ayant reçu l'ancienne séquence.
