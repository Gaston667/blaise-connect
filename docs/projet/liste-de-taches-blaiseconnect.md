# 📋 Liste de tâches — BlaiseConnect

> [!NOTE]
> Cette liste remplace le journal des décisions. Elle suit **ce qui est terminé**, **ce qui doit être validé** et **ce qui reste à réaliser**.
> La colonne **Ajoutée le** indique le jour où la tâche est apparue dans la liste.

## 📊 Avancement

`████████████░░░░░░░░` **62 %** des tâches prévues pour la mise en service sont terminées.

| ✅ Terminées | 🔍 À valider | ⬜ À faire | 🔮 Plus tard |
|:-:|:-:|:-:|:-:|
| **28** | **3** | **14** | **6** |

## 🗝️ Légende

| Icône | Sens |
|:-:|---|
| ✅ | Terminé |
| 🔍 | À tester ou à valider |
| ⬜ | À faire |
| 🔮 | Prévu pour une version ultérieure |

> [!TIP]
> Les tests automatisés (droits des rôles, parent, absences, sécurité, emploi du temps, affichage mobile) sont décrits dans [`docs/technique/tests-automatises.md`](../technique/tests-automatises.md). Les idées à discuter sont dans [`docs/idee.md`](../idee.md).

---

## ✅ Terminé

| | Tâche | Ajoutée le |
|:-:|---|:-:|
| ✅ | Mettre en place la connexion, la déconnexion, les rôles et la gestion des comptes. | 28/10/2026 |
| ✅ | Gérer les années scolaires, périodes, classes, matières, enseignants, élèves et responsables légaux. | 28/10/2026 |
| ✅ | Inscrire les élèves dans une classe et conserver leur historique scolaire. | 28/10/2026 |
| ✅ | Gérer les affectations enseignant, classe et matière. | 28/10/2026 |
| ✅ | Créer les évaluations, saisir les notes, calculer les moyennes et traiter les demandes de correction. | 28/10/2026 |
| ✅ | Mettre en place l’archivage et la réactivation des élèves et de leurs comptes. | 28/10/2026 |
| ✅ | Retirer le bloc indicatif « Droits d’accès » de la fiche compte : les droits sont appliqués côté serveur, pas configurables depuis cette page en V1. | 28/10/2026 |
| ✅ | Ajouter le tableau de bord administrateur. | 28/10/2026 |
| ✅ | Ajouter la gestion et la consultation des emplois du temps. | 28/10/2026 |
| ✅ | Ajouter la gestion des absences, retards et justificatifs. | 28/10/2026 |
| ✅ | Déployer l’application avec HTTPS sur le VPS. | 28/10/2026 |
| ✅ | Mettre en place les scripts de sauvegarde et de restauration de la base et des documents sur le VPS. | 28/10/2026 |
| ✅ | Planifier la sauvegarde locale quotidienne du VPS. | 28/10/2026 |
| ✅ | Ouvrir un portail responsable légal : choix de l’enfant, notes (page dédiée par matière), emploi du temps, absences et retards, dépôt de justificatifs d’absence. Les bulletins y sont consultables mais grisés (« Bientôt ») pour le moment. | 28/10/2026 |
| ✅ | Générer les emplois du temps : planificateur avec barrettes de spécialités, génération pour toutes les classes, publication groupée, créneaux verrouillés, alertes après publication. | 29/10/2026 |
| ✅ | Gérer les cours particuliers sans jamais les placer pendant les cours de l’élève, avec recherche de créneaux libres. | 29/10/2026 |
| ✅ | Aligner les volumes horaires sur le programme officiel (script `database/init/080_official_weekly_volumes.sql`). | 29/10/2026 |
| ✅ | Afficher des messages d’erreur clairs (dates de naissance, règles de la base) à la place de « erreur interne ». | 29/10/2026 |
| ✅ | Mettre en place les tests automatisés (130 tests avec la base) : droits de chaque rôle, portail parent, absences et justificatifs, bulletins, sécurité HTTP, emploi du temps, affichage mobile. Détail et commandes : `docs/technique/tests-automatises.md`. | 29/10/2026 |
| ✅ | Fermer la documentation publique de l’API (`/docs`, `/openapi.json`) en production et rendre lisible le refus d’un commentaire de décision trop court. | 29/10/2026 |
| ✅ | Choisir les spécialités dès l’inscription depuis la page d’une classe (3 en Première, 2 en Terminale), comme depuis la fiche de l’élève. | 29/10/2026 |
| ✅ | Guider l’inscription par un compteur d’étapes (« Étape 2 sur 3 ») et, en Terminale, ne proposer que les spécialités suivies en Première. | 29/10/2026 |
| ✅ | Ajouter un bouton pour masquer et réafficher le menu latéral sur ordinateur (choix mémorisé). | 29/10/2026 |
| ✅ | Afficher un message clair avec un bouton « Réessayer » quand la fiche d’un élève ne peut pas se charger. | 29/10/2026 |
| ✅ | Ranger la documentation par thème (`projet`, `technique`, `fonctionnel`) et ajouter un sommaire `docs/README.md`. | 29/10/2026 |

## 🔍 À tester ou à valider

| | Tâche | Ajoutée le |
|:-:|---|:-:|
| ✅ | Finaliser l'affichage mobile des matières : une page dédiée affiche les évaluations d'une matière. | 29/10/2026 |
| ⬜ | Déplacer l'action de déconnexion en haut de page pour qu'elle soit plus facilement accessible. | 29/10/2026 |
| ✅ | Tester les droits réels de chaque rôle sur tous les parcours importants : automatisé (`test_access_control.py`, 127 routes, 4 rôles + visiteur). | 28/10/2026 |
| ✅ | Tester le cycle des absences et des justificatifs : automatisé (`test_absence_cycle.py` : appel, parent, administration, délai, refus, droits). Reste à le rejouer avec l’établissement pilote. | 29/10/2026 |
| 🔍 | Tester le parcours bulletin : l’accès (famille, administration, rôles) et la production de l’aperçu sont automatisés (`test_report_cards_access.py`) ; reste à valider à la main le rendu du PDF, la validation et le téléchargement. Le bouton Bulletins est grisé (« Bientôt ») pour l’admin et le parent tant que ce parcours n’est pas prêt. | 28/10/2026 |
| 🔍 | Valider sur un vrai téléphone l’affichage de l’emploi du temps. Automatisé (`e2e/mobile_layout_check.py`, 37 contrôles : aucun dépassement, zones tactiles, onglets des jours, navigation par semaine) ; reste le rendu réel et une connexion lente. | 29/10/2026 |
| ✅ | Tester le portail responsable légal : automatisé (`test_guardian_portal.py` : parent de 2 enfants, parent d’un enfant, enfant d’une autre famille introuvable, enfant archivé masqué). | 28/10/2026 |
| 🔍 | Vérifier la sécurité de production : hôtes, CORS, cookies, fichiers privés, en-têtes. Automatisé en local (`test_security_config.py`) et rejouable sur le VPS avec `e2e/check_production_security.py` ; **ce contrôle reste à lancer contre le serveur en ligne** (HTTPS, HSTS, cookie `Secure`). | 28/10/2026 |

## 🗓️ Emploi du temps : à faire

| | Tâche | Ajoutée le |
|:-:|---|:-:|
| ⬜ | Publier les nouveaux emplois du temps avec le bouton de publication groupée : les emplois du temps actuellement publiés ont encore des spécialités simultanées (le bandeau d’alertes le signale). | 29/10/2026 |
| ⬜ | Appliquer les migrations `009`, `010`, `011`, `012` et le script `080` sur la base du VPS et sur celle du co-développeur (l’API refuse de démarrer si une migration manque). | 29/10/2026 |
| ⬜ | Faire valider les volumes horaires par la direction (programme officiel arrondi à l’heure pleine). | 29/10/2026 |
| ⬜ | Compléter la 3ème A : elle n’a que 4 matières dans les données de test. | 29/10/2026 |
| ⬜ | Tester l’emploi du temps sur une vraie école : vrais enseignants, vraies spécialités, vraies indisponibilités. | 29/10/2026 |
| ⬜ | Décider des règles non faites : barrettes définies par l’école, salles spéciales (labo, gymnase), vacances et jours fériés, semaines A et B, options du collège (LV2, latin), préférences par matière ou par enseignant. | 29/10/2026 |
| ⬜ | Ajouter un bouton pour verrouiller ou déverrouiller un créneau déjà généré. | 29/10/2026 |

## 🧩 Règles métier à ajouter

La règle de visibilité des notes (masquer les notes tant que la saisie n’est pas complète) est listée dans la section suivante.

| | Tâche | Ajoutée le |
|:-:|---|:-:|
| ⬜ | **Appliquer la capacité d’une classe à l’inscription** : elle est affichée mais jamais contrôlée, on peut inscrire un élève au-delà. Refuser (ou avertir clairement) quand la classe est pleine. | 29/10/2026 |
| ⬜ | **Refuser les notes d’une évaluation datée dans le futur** : aucun contrôle de la date n’existe aujourd’hui à la saisie. | 29/10/2026 |
| ⬜ | Contrôler la cohérence de la date de naissance d’un élève (pas dans le futur, âge plausible pour le niveau de la classe). | 29/10/2026 |
| ⬜ | Exiger au moins un responsable légal et un contact principal avant d’inscrire un élève dans une classe. | 29/10/2026 |
| ⬜ | Afficher à la désinscription ce que l’élève perd (emploi du temps, spécialités, évaluations en cours) avant de confirmer. | 29/10/2026 |
| ⬜ | Gérer le changement de classe en cours d’année (transfert avec date, motif « changement de classe », historique conservé). | 29/10/2026 |
| ⬜ | Avertir avant la clôture d’une année scolaire quand des notes manquent ou que des bulletins ne sont pas validés, et bloquer la clôture si nécessaire. | 29/10/2026 |
| 🔍 | Vérifier que la suppression d’une matière ou d’un enseignant déjà utilisés (classes, évaluations, emploi du temps) est bien refusée par le serveur ou la base, avec un message clair. | 29/10/2026 |
| 🔍 | Vérifier que le serveur refuse la validation d’un bulletin tant qu’une absence est en attente de décision (règle prévue dans `AGENTS.md`), et ajouter un test. | 29/10/2026 |

## 🚀 À faire avant une vraie mise en service

| | Tâche | Ajoutée le |
|:-:|---|:-:|
| ⬜ | **Masquer les notes à l’élève et au parent tant que l’enseignant n’a pas saisi toutes les notes de l’évaluation** (tous les élèves de la classe pour la matière concernée). Cette règle n’existe pas aujourd’hui : `student_grade_service.py` renvoie chaque note dès qu’elle est saisie, ce qui permet à un élève de voir sa note et de se comparer avant la fin de la saisie. Elle doit être appliquée côté serveur (liste, détail, moyennes, rang, portail responsable), avec un message du type « notes bientôt disponibles », et testée. | 29/10/2026 |
| ⬜ | **Remplacer l’aperçu PDF des bulletins par une compilation locale** : il envoie le bulletin complet (nom, matricule, notes) à un service en ligne tiers (LaTeX.Online). À ne pas utiliser avec de vraies données d’élèves. | 29/10/2026 |
| ⬜ | Brancher les tests automatisés dans une intégration continue (GitHub Actions) pour qu’ils tournent à chaque envoi. | 29/10/2026 |
| ⬜ | Copier automatiquement les sauvegardes vers un stockage hors du VPS. | 28/10/2026 |
| ⬜ | Définir une durée de conservation des sauvegardes et tester une restauration périodique. | 28/10/2026 |
| ⬜ | Créer un historique global des actions sensibles consultable par l’administrateur. | 28/10/2026 |
| ⬜ | Tester le parcours complet avec un établissement pilote, de vrais comptes de test et une sauvegarde préalable. | 28/10/2026 |

## 🔮 Prévu pour une version ultérieure

| | Tâche | Ajoutée le |
|:-:|---|:-:|
| 🔮 | Droits d’accès différenciés : CPE et secrétaire. | 29/10/2026 |
| 🔮 | Portail responsable légal : notifications liées aux absences et aux justificatifs. | 28/10/2026 |
| 🔮 | Cahier de textes et devoirs. | 28/10/2026 |
| 🔮 | Messagerie interne. | 28/10/2026 |
| 🔮 | Gestion financière complète : frais, factures et paiements. | 28/10/2026 |
| 🔮 | Statistiques avancées et application mobile. | 29/10/2026 |
