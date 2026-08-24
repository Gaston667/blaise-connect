# Securite de production — US-025

## Configuration requise

- Deployer l'application derriere un proxy HTTPS avec un certificat valide.
- Copier `.env.production.example` vers `.env` uniquement sur le serveur.
- Renseigner le domaine reel dans `ALLOWED_HOSTS` et `ALLOWED_ORIGINS`.
- Garder `SESSION_COOKIE_SECURE=true` : un cookie de session ne circule alors qu'en HTTPS.
- Ne jamais versionner le fichier `.env` ni les mots de passe PostgreSQL.

## Protections appliquees par l'API

- mots de passe Argon2 et jetons de session hashes ;
- expiration des sessions inactives ;
- controle des roles cote serveur ;
- CORS limite aux origines configurees ;
- hotes HTTP autorises explicitement ;
- fichiers prives accessibles seulement par routes authentifiees ;
- en-tetes `nosniff`, anti-iframe, anti-cache et HSTS en production.

## Verification avant mise en ligne

1. Ouvrir l'interface uniquement en `https://`.
2. Verifier qu'une session expiree retourne `401`.
3. Verifier qu'un compte non administrateur recoit `403` sur une route admin.
4. Verifier qu'un fichier prive ne peut pas etre ouvert sans session.
5. Verifier que l'origine d'un autre site est refusee par CORS.
