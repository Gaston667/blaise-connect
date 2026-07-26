# Rapport de cohérence des profils

Date du contrôle : 26 juillet 2026.

## Réponse sur le genre

- Les quatre profils possèdent désormais `gender` et `photo_path` dans la séquence de migrations.
- `gender` reste facultatif et aucune liste de valeurs n'est encore contrôlée.
- Ce modèle ne permet pas encore de produire sûrement « M. » ou « Mme » lorsque le genre n'est pas renseigné.
- Il reste à décider si l'interface utilise `gender`, une civilité (`salutation`) ou simplement le nom sans titre.

## Incohérences constatées

### Priorité haute

1. `AGENTS.md` présente `students.birth_date` et `students.gender` comme des informations attendues, mais la migration 001 les autorise à `NULL`.
2. La liste des valeurs de `gender` n'est pas validée : aucune contrainte `CHECK` PostgreSQL ni validation Pydantic n'existe.
3. Le rôle applicatif ne possède pas encore les droits complets de lecture et de gestion des profils `students`, `administrators` et `guardians`. Ces droits devront être ajoutés avec les fonctionnalités correspondantes.
4. Les modèles SQLAlchemy et contrats Pydantic de `Student`, `Administrator` et `Guardian` n'existent pas encore.

### Priorité moyenne

1. Seul l'email des enseignants devient unique sans tenir compte de la casse. La politique d'unicité des emails des élèves, administrateurs et responsables n'est pas définie.
2. Le téléphone du responsable est `NOT NULL`, mais une chaîne vide ou composée d'espaces est encore acceptée.
3. Les emails et téléphones ne possèdent aucune contrainte de format dans PostgreSQL. Une validation backend reste nécessaire.
4. Les prénoms et noms ne peuvent pas être vides, mais des espaces avant ou après la valeur restent stockables.
5. `photo_path` accepte une chaîne vide. Il serait préférable d'accepter `NULL` ou un chemin non vide.
6. Les contraintes `PRIMARY KEY` et `UNIQUE` de la migration 001 ne portent pas toutes un nom explicite, contrairement aux conventions actuelles du projet.

## Éléments cohérents

- Les quatre catégories restent séparées sans table générique `persons`.
- `account_id` est obligatoire et unique pour les élèves, enseignants et administrateurs.
- `guardians.account_id` est correctement facultatif et unique.
- Les clés étrangères utilisent `ON DELETE RESTRICT`.
- Les quatre profils possèdent un genre facultatif et une photo facultative stockée sous forme de chemin.
- Les quatre profils peuvent être archivés logiquement avec `archived_at`.
- Le rôle du compte lié au profil est contrôlé par un trigger différable.
- Les colonnes `created_at` et `updated_at` existent sur les quatre profils.

## Décisions nécessaires

1. L'affichage doit-il utiliser le genre, une civilité (`MR`, `MRS`, etc.) ou aucun titre ?
2. `students.birth_date` et `students.gender` doivent-ils réellement être obligatoires ?
3. Les emails doivent-ils être uniques pour toutes les catégories ?
4. Quelles valeurs exactes de genre ou de civilité l'école accepte-t-elle ?

Les validations restantes devront faire l'objet d'une nouvelle décision avant toute contrainte SQL supplémentaire.
