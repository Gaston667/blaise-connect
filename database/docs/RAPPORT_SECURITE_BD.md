# Rapport de sécurité de la base de données

## Suppression contrôlée d'une année ouverte

La migration `005_delete_open_school_year.sql` n'accorde aucun droit `DELETE`
direct à `blaise_app`. Elle expose uniquement une fonction `SECURITY DEFINER`
qui vérifie le rôle administrateur, refuse les années clôturées, exige le nom
exact de l'année, supprime ses dépendances dans la transaction courante et
conserve les comptages dans `school_year_deletion_audits`.

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

## Comptes fictifs de développement

Le script `database/init/007_create_test_accounts.sql` prépare 30 comptes :

| Rôle | Matricules | Nombre |
|---|---|---:|
| `ADMIN` | `a000001` à `a000003` | 3 |
| `TEACHER` | `e000001` à `e000007` | 7 |
| `STUDENT` | `u000001` à `u000010` | 10 |
| `GUARDIAN` | `p000001` à `p000010` | 10 |

Le même script crée leurs profils fictifs, une année scolaire avec trois
périodes, trois classes, six matières avec coefficients et les inscriptions
des dix élèves. Il associe aussi chaque élève à un responsable fictif principal,
légal et joignable en urgence. Les affectations, évaluations et notes ne sont pas simulées
tant que leurs tables ne sont pas créées par des migrations versionnées.

Ils utilisent uniquement en développement le mot de passe commun `test@1234`, stocké dans PostgreSQL sous forme de hash Argon2. Le mot de passe en clair n'est jamais enregistré dans `accounts`.

Mesures obligatoires :

- ne jamais exécuter ce script en production ;
- ne jamais réutiliser ce mot de passe pour un compte réel ;
- conserver `database/local/compte_fictif.txt` hors de Git ;
- remplacer ou désactiver ces comptes avant tout déploiement accessible publiquement.

Le script est monté après les migrations et ne s'exécute automatiquement que pendant l'initialisation d'un nouveau volume PostgreSQL.

## Liens entre élèves et responsables

La migration `006_create_student_guardians.sql` accorde à `blaise_app` les
droits `SELECT`, `INSERT`, `UPDATE` et `DELETE` uniquement sur la table
d'association `student_guardians`. `INSERT` et `UPDATE` sont limités aux
colonnes métier : les clés d'un lien existant et ses horodatages d'audit ne sont
pas modifiables par l'application. Le droit `DELETE` retire un lien entre deux
dossiers sans supprimer l'élève ni le responsable. Le rôle applicatif ne reçoit
aucun droit de création ou de modification du schéma.
