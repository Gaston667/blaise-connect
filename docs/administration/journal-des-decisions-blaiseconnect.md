# Journal des décisions — BlaiseConnect

Ce document conserve les décisions projet et leur état.

## Statuts

- ⬜ Proposition
- 🟨 À valider
- 🟩 Validée
- 🟥 Refusée

## Suivi des décisions

| N° | Date | Sujet | Décision | Statut |
|---:|---|---|---|---|
| D-001 | 22/07/2026 | Périmètre des comptes V1 | Conserver la migration 001 complète, mais limiter l'authentification applicative V1 aux rôles `ADMIN` et `TEACHER` ; les rôles `STUDENT` et `GUARDIAN` ne seront pas exposés par le code V1. | 🟩 Validée |
| D-002 | 23/07/2026 | Format des matricules V1 | Normaliser le matricule en minuscules et imposer exactement `a`, `e`, `u` ou `p`, suivi de six chiffres. | 🟩 Validée |
| D-003 | 23/07/2026 | Durée des sessions V1 | Fermer une session après 15 minutes consécutives sans activité de l'utilisateur. | 🟩 Validée |
| D-004 | 24/07/2026 | Technologie des sessions | Reporter les JWT et le couple access/refresh token à la V2 ; la V1 utilisera une session contrôlée côté backend. | 🟩 Validée |
| D-005 | 24/07/2026 | Verrouillage des comptes | Verrouiller un compte pendant 5 minutes après 5 mots de passe incorrects consécutifs ; remettre le compteur à zéro après une authentification réussie. | 🟩 Validée |

## Exemple

| N° | Date | Sujet | Décision | Statut |
|---:|---|---|---|---|
| D-001 | 17/07/2026 | Gestion des absences | Prévue après la gestion des notes | 🟩 Validée |
