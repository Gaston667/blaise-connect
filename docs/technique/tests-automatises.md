# 🧪 Tests automatisés de BlaiseConnect

> [!NOTE]
> Ce document dit **ce qui est testé automatiquement**, **comment le lancer**, et **ce qui reste à vérifier à la main**.

**Sommaire :** [Les quatre niveaux](#1-les-quatre-niveaux-de-tests) · [Ce qui est couvert](#2-ce-qui-est-couvert) · [Ce qui ne peut pas être automatisé](#3-ce-qui-ne-peut-pas-être-automatisé-ici-️) · [Problèmes révélés](#4-problèmes-révélés-par-ces-tests-à-connaître)

---

## 1. Les quatre niveaux de tests

| Niveau | Où | Base de données | Durée | Lancer |
|---|---|---|---|---|
| Logique pure (planificateur, schémas, services) | `backend/tests/services`, `backend/tests/schemas` | non | quelques secondes | commande 1 |
| API et base de développement | `backend/tests/integration` | oui, **transaction annulée** | environ 1 minute 30 (130 tests) | commande 2 |
| Affichage sur téléphone | `tests/e2e/mobile_layout_check.py` | oui (application démarrée) | 2 à 3 minutes | commande 3 |
| Sécurité d'un serveur en ligne | `tests/e2e/check_production_security.py` | non (aucune écriture) | quelques secondes | commande 4 |

```bash
# 1. logique pure (sans base)
docker exec -w /app container-backend python -m unittest discover -s tests -t .

# 2. API + base de développement : rien n'est écrit, tout est annulé à la fin
docker exec -e RUN_DB_TESTS=1 -w /app container-backend python -m unittest discover -s tests -t .

# 3. affichage mobile (pip install playwright ; Edge ou Chrome installé)
# Le script demande les quatre matricules de test et le mot de passe au lancement.
python tests/e2e/mobile_layout_check.py

# 4. sécurité d'un serveur en ligne (le VPS) ; compte de test uniquement
python tests/e2e/check_production_security.py https://portail.blaiseconnect.fr --api-prefix /api

Les scripts sont exécutés depuis le PC du développeur. Ils demandent les
identifiants de test au lancement : ne les placer ni dans Git, ni dans un fichier
`.env`, ni dans la ligne de commande.
```

Sans `RUN_DB_TESTS=1`, les tests qui touchent la base sont simplement ignorés. Les tests d'intégration partagent une seule session SQL dont les `commit` sont remplacés par des `flush` : les données de développement ne bougent jamais.

## 2. Ce qui est couvert

### Droits de chaque rôle (`test_access_control.py`)
- Toutes les routes de l'API (127 chemins) refusent un visiteur sans connexion, sauf les routes volontairement publiques.
- Pour 4 rôles (administrateur, enseignant, élève, parent) et plus de 40 routes : chacun accède à ses routes et reçoit « interdit » sur les autres.
- Les actions d'écriture sensibles (créer un compte, générer ou publier les emplois du temps, clôturer une année, supprimer…) sont réservées à l'administrateur.
- `/auth/me` n'expose jamais de mot de passe, de hash ni de jeton.

### Portail responsable légal (`test_guardian_portal.py`)
- Un parent de deux enfants voit ses deux enfants et seulement eux ; un parent d'un enfant ne voit que celui-là.
- Chaque écran de l'enfant (notes, résumé, absences, emploi du temps, bulletins) est lisible par sa famille.
- L'enfant d'une autre famille est « introuvable » (même réponse qu'un élève qui n'existe pas) sur tous les écrans.
- Un enfant archivé disparaît du portail.
- Un parent ne peut pas utiliser les routes élève ou personnel, et inversement.
- Une autre famille ne peut pas justifier l'absence d'un enfant qui n'est pas le sien.

### Absences et justificatifs (`test_absence_cycle.py`)
- Cycle complet : l'enseignant fait l'appel, le parent voit l'absence, dépose un motif (« en attente »), l'administration accepte (« justifiée »).
- Un justificatif refusé ne peut plus être redéposé ; un second dépôt en attente ou déjà justifié est refusé.
- Le délai de 7 jours est appliqué.
- Un motif trop court et un fichier de type interdit sont refusés.
- Seule la famille de l'élève peut justifier ; l'élève et l'enseignant ne peuvent pas trancher.
- Un commentaire de décision trop court donne un message clair.

### Bulletins (`test_report_cards_access.py`)
- La famille ne voit que les bulletins **validés** de ses enfants ; un brouillon est invisible pour elle.
- Le bulletin d'une autre famille est introuvable.
- L'administration voit tout, y compris les brouillons ; l'enseignant et l'élève n'ont aucun accès.
- L'aperçu PDF est réservé à l'administrateur ; un délai dépassé du service distant est signalé proprement (503).
- Test documenté « à corriger » : voir 4.

### Sécurité HTTP (`test_security_config.py`)
- Hôte inconnu refusé ; CORS fermé aux origines non déclarées.
- En-têtes de sécurité présents ; cookie de session `HttpOnly`, `SameSite=Lax`.
- La déconnexion révoque la session, un jeton volé ne marche plus après déconnexion.
- La connexion ne révèle pas si un matricule existe ; verrouillage après des échecs répétés ; injection SQL inoffensive.
- Photos privées réservées à l'administrateur ; traversée de dossier refusée ; documents protégés sans connexion.
- En production, la configuration refuse de démarrer sans hôtes ni origines déclarés, et la documentation de l'API est fermée.

### Inscription dans une classe (`test_class_enrollment.py`)
- La fiche détaillée d'une classe donne son niveau (`level_code`), dont l'écran d'inscription a besoin pour demander les spécialités.
- Inscrire un élève en Terminale sans ses 2 spécialités, ou en Première sans ses 3, est refusé avec un message clair ; avec le bon nombre de spécialités, l'inscription réussit et les spécialités sont enregistrées ; une classe sans spécialités n'en demande pas.
- En Terminale, seules les spécialités suivies en Première sont proposées (`/students/{id}/specialty-options`) ; en choisir une autre est refusé avec un message clair ; deux spécialités de Première sont acceptées.

### Emploi du temps (`test_timetable_database.py`, `test_timetable_planner.py`)
- Planificateur : 20 tests de logique pure (barrettes, plafonds, répartition, créneaux verrouillés…).
- Base : génération de toutes les classes sans conflit de professeur ni de salle, sans spécialités simultanées, plafonds d'heures respectés, publication groupée, publication partielle refusée, créneau verrouillé conservé, cours particulier refusé pendant les cours de l'élève et accepté sur un créneau libre, API qui refuse de démarrer si une migration manque.

### Affichage mobile (`tests/e2e/mobile_layout_check.py`)
- 4 rôles × toutes les pages du menu × 2 largeurs (360 et 390 px) : aucun défilement horizontal, aucune erreur JavaScript ni réponse 5xx, zones tactiles d'au moins 40 px.
- Emploi du temps de l'élève, du parent et de l'enseignant : onglets des jours, navigation par semaine, semaine vide, cours de la semaine courante.

### Sécurité en ligne (`tests/e2e/check_production_security.py`)
Redirection HTTP vers HTTPS, HSTS, en-têtes, documentation fermée, hôte inconnu, CORS, routes et photos protégées, attributs du cookie (`Secure` compris). À lancer contre le VPS : **ce contrôle n'a été exécuté qu'en local, pas encore sur le serveur de production.**

## 3. Ce qui ne peut pas être automatisé ici 🖐️
- Le rendu sur un **vrai téléphone** et sur une connexion lente.
- L'aspect visuel d'un **bulletin PDF** (seulement son accès et sa production sont testés).
- La **restauration d'une sauvegarde** et la copie hors du VPS : à tester sur le serveur.
- Un **établissement pilote** avec de vraies données.

## 4. Problèmes révélés par ces tests (à connaître)

> [!CAUTION]
> **Aperçu PDF des bulletins : données personnelles envoyées à un tiers.** Voir le point 1 ci-dessous.

1. **Aperçu PDF des bulletins** : le bulletin complet (nom, matricule, notes) est envoyé à un service en ligne tiers (LaTeX.Online) dans l'adresse de la requête. À ne pas utiliser avec de vraies données d'élèves ; il faut compiler en local. Le test `test_pdf_preview_must_not_send_personal_data_to_a_third_party_service` est marqué « échec attendu » : retirer le marqueur quand ce sera corrigé.
2. **Documentation de l'API** (`/docs`, `/openapi.json`) : elle était accessible publiquement en production. Elle est maintenant fermée en production.
3. **Décision d'une absence avec un commentaire de moins de 3 caractères** : renvoyait « Ces informations ne respectent pas une règle de l'école ». Elle renvoie maintenant « Le commentaire doit contenir au moins 3 caractères ».
4. **Aperçu PDF et délai dépassé** : une coupure du service distant donnait une erreur 500 ; elle donne maintenant un 503 lisible.
