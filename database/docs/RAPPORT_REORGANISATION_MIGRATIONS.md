# Rapport de réorganisation des migrations

Date : 3 août 2026.

## Résultat

La séquence d'initialisation d'une base vide contient désormais six migrations :

1. `001_db_access.sql` : accès minimal de `blaise_app` à la base et au schéma.
2. `002_accounts_and_profiles.sql` : comptes, sessions, profils et historique du statut des élèves.
3. `003_relationships_and_documents.sql` : responsables d'élèves, catalogue documentaire et métadonnées des fichiers.
4. `004_school_structure.sql` : années, périodes, niveaux, classes, inscriptions, matières et coefficients.
5. `005_academic_activity.sql` : affectations, évaluations, notes, demandes de correction, appels, absences, retards, justificatifs et historique.
6. `006_report_cards_and_year_deletion.sql` : bulletins historiques et suppression auditée d'une année non clôturée.

Les anciennes migrations correctives `007` et `008` ont été fusionnées : le retrait d'une matière de classe se trouve dans `004` et l'unicité temporelle de son enseignant dans `005`.

## Nouvelles protections

- une note ne dépasse pas le barème de son évaluation ;
- un élève noté ou absent appartient obligatoirement à la classe concernée ;
- une absence à une évaluation conserve `score = NULL` ;
- une absence justifiée est exclue de la moyenne, une absence non justifiée ou rejetée vaut zéro pendant le calcul ;
- un bulletin ne peut pas être validé avec une justification en attente ;
- un bulletin validé, ses lignes, ses notes et sa période sont immuables ;
- les corrections d'assiduité sont historisées et les suppressions sont logiques ;
- les documents sont référencés par de vraies clés étrangères, sans relation polymorphe.

## Docker Compose et données fictives

`compose.yaml` monte uniquement les six migrations dans l'ordre, puis `050_creat_teste_data.sql`. Le seed prépare des affectations, évaluations, notes, absences justifiées et non justifiées, appels, justificatifs, demandes de correction et bulletins provisoires.

## Attention

Cette consolidation est destinée à une nouvelle base vide. Elle ne doit pas être rejouée sur une base ayant déjà reçu l'ancienne numérotation. Les migrations et les tests n'ont pas été exécutés pendant cette modification.
