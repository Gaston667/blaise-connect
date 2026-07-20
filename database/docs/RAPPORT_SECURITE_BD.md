# Rapport de sécurité de la base de données

## Périmètre

- **Projet :** BlaiseConnect
- **Sprint :** Semaine 1 — du 20 au 24 juillet 2026
- **User Story :** US-025 — Sécuriser les accès et les sessions
- **Contrôle :** privilèges du rôle applicatif PostgreSQL `blaise_app`
- **Statut :** contrôle à exécuter après la création de la table `public.accounts`

## Objectif

Vérifier que le rôle utilisé par l'application peut se connecter à la base et manipuler uniquement les données nécessaires, sans pouvoir modifier la structure du schéma PostgreSQL.

Cette requête est un contrôle en lecture seule : elle n'accorde et ne retire aucun droit.

## Requête de contrôle

La requête doit être exécutée en étant connecté à la base `blaise_connect`, après l'application de la migration qui crée `public.accounts`.

```sql
SELECT
    has_database_privilege(
        'blaise_app',
        'blaise_connect',
        'CONNECT'
    ) AS connexion,

    has_schema_privilege(
        'blaise_app',
        'public',
        'USAGE'
    ) AS acces_schema,

    has_schema_privilege(
        'blaise_app',
        'public',
        'CREATE'
    ) AS creation_objet,

    has_table_privilege(
        'blaise_app',
        'public.accounts',
        'SELECT'
    ) AS lecture,

    has_table_privilege(
        'blaise_app',
        'public.accounts',
        'INSERT'
    ) AS insertion,

    has_table_privilege(
        'blaise_app',
        'public.accounts',
        'UPDATE'
    ) AS modification,

    has_table_privilege(
        'blaise_app',
        'public.accounts',
        'DELETE'
    ) AS suppression;
```

## Interprétation des colonnes

| Colonne | Privilège contrôlé | Signification |
|---|---|---|
| `connexion` | `CONNECT` sur `blaise_connect` | Le rôle peut ouvrir une connexion à la base. |
| `acces_schema` | `USAGE` sur `public` | Le rôle peut accéder aux objets contenus dans le schéma. |
| `creation_objet` | `CREATE` sur `public` | Le rôle peut créer des tables, vues, fonctions ou autres objets dans le schéma. |
| `lecture` | `SELECT` sur `public.accounts` | Le rôle peut consulter les comptes. |
| `insertion` | `INSERT` sur `public.accounts` | Le rôle peut créer des comptes. |
| `modification` | `UPDATE` sur `public.accounts` | Le rôle peut modifier, désactiver ou archiver des comptes. |
| `suppression` | `DELETE` sur `public.accounts` | Le rôle peut supprimer physiquement des comptes. |

Les fonctions `has_*_privilege` retournent `true` ou `false`. Elles tiennent compte des privilèges directs ainsi que des privilèges hérités par l'intermédiaire d'autres rôles.

## Résultat

Cette proposition applique le principe du moindre privilège. Elle doit être validée avant d'être considérée comme une décision du projet.

| Contrôle | Valeur recommandée | Justification |
|---|---:|---|
| `connexion` | `true` | L'application doit pouvoir se connecter à sa base. |
| `acces_schema` | `true` | L'application doit pouvoir utiliser les tables autorisées. |
| `creation_objet` | `false` | Les créations et modifications du schéma sont réservées au rôle de migration. |
| `lecture` | `true` | L'authentification et la gestion des comptes nécessitent la lecture. |
| `insertion` | `true` | US-002 prévoit la création de comptes par un administrateur autorisé. |
| `modification` | `true` | US-002 prévoit la modification, la désactivation et l'archivage des comptes. |
| `suppression` | `false` | L'archivage logique est préféré à la suppression physique d'un compte. |

Le rôle `blaise_app` ne doit pas être superutilisateur, propriétaire de la base ou propriétaire des migrations. Un rôle distinct doit appliquer les migrations versionnées.


