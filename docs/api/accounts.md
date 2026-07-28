# API des comptes

## `GET /accounts`

Cette route est réservée aux administrateurs. Elle renvoie chaque compte avec
ses informations de sécurité non sensibles et, lorsqu’il existe, son profil
dans `students`, `teachers`, `administrators` ou `guardians`.

Le champ `profile` contient notamment le nom, le prénom, les coordonnées et les
informations propres au rôle. Il vaut `null` si aucun dossier métier n’est lié.

Le mot de passe, son hash et les données de session ne sont jamais exposés.
La jointure utilise `account_id` et sélectionne uniquement le profil compatible
avec le rôle fixe du compte.
