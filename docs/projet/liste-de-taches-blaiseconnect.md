# 📋 Liste de tâches — BlaiseConnect

> Cette liste remplace le journal des décisions. Elle indique ce qui est
> réellement terminé, ce qui doit encore être validé et ce qui reste à faire.

## Légende

| Statut | Sens |
|---|---|
| 🟢 Terminé | Fonction développée et validée techniquement. |
| 🟡 À valider | Fonction développée, mais à tester sur un vrai usage ou un vrai environnement. |
| 🔴 À faire | Fonction ou action non terminée. |

Les tests automatisés sont décrits dans
[`docs/technique/tests-automatises.md`](../technique/tests-automatises.md).
Les idées à discuter sont dans [`docs/idee.md`](../idee.md).

---

## 🟢 Terminé

| Tâche |
|---|
| Connexion, déconnexion, sessions, rôles et gestion des comptes. |
| Gestion des années scolaires, périodes, classes, matières, enseignants, élèves et responsables légaux. |
| Inscription des élèves, historique scolaire, spécialités de Première et de Terminale. |
| Évaluations, notes, moyennes, demandes de correction et accès aux évaluations par matière. |
| Archivage, désarchivage et réactivation des profils et comptes. |
| Absences, retards, justification par le responsable légal et revue par l'administration. |
| Tableau de bord administrateur et interfaces mobiles principales. |
| Portail responsable légal : choix de l'enfant, notes, emploi du temps, absences et dépôt de justificatifs. |
| Gestion, génération et publication groupée des emplois du temps ; spécialités, alertes et créneaux verrouillés. |
| Cours particuliers avec contrôle des conflits et recherche de créneaux disponibles. |
| Déploiement HTTPS sur le VPS, sauvegarde/restauration locale et sauvegarde quotidienne planifiée. |
| Documentation organisée par thème et tests automatisés des droits, absences, portail parent, emploi du temps et sécurité locale. |
| Menu utilisateur en haut à droite avec accès au profil et déconnexion. |

## 🟡 À valider

| Tâche |
|---|
| Vérifier la sécurité sur le site en ligne depuis le PC du développeur : HTTPS, HSTS, CORS, cookies et accès aux fichiers privés. |
| Vérifier le rendu réel sur téléphone, y compris l'emploi du temps et une connexion lente. |
| Valider à la main le cycle des absences et justificatifs avec l'établissement pilote. |
| Valider le rendu PDF, la validation et le téléchargement des bulletins avec des données de démonstration. |
| Tester le parcours complet avec l'établissement pilote : comptes, inscriptions, notes, emplois du temps, absences et sauvegarde préalable. |
| Vérifier que la suppression d'une matière ou d'un enseignant utilisé est refusée avec un message clair. |
| Vérifier que la validation d'un bulletin est refusée lorsqu'une absence est encore en attente de décision. |

## 🔴 À faire

Les tâches sont classées de la plus courte à la plus importante.

| Ordre | Tâche |
|:-:|---|
| 1 | Appliquer les migrations `009` à `012` et le script `080` sur le VPS et chez le co-développeur. |
| 2 | Publier les nouveaux emplois du temps générés ; les emplois du temps publiés actuels ont encore des spécialités simultanées signalées par les alertes. |
| 3 | Faire valider les volumes horaires par la direction et compléter les matières manquantes de la 3ème A dans les données de démonstration. |
| 4 | Ajouter l'action visible permettant de verrouiller ou déverrouiller un créneau d'emploi du temps déjà généré. |
| 5 | Contrôler la capacité d'une classe avant une inscription et refuser clairement une classe pleine. |
| 6 | Refuser la saisie de notes pour une évaluation future et contrôler la cohérence de l'âge de l'élève avec son niveau. |
| 7 | Exiger au moins un responsable légal et un contact principal avant l'inscription d'un élève. |
| 8 | Afficher les conséquences avant une désinscription et gérer le changement de classe en cours d'année avec historique. |
| 9 | Avertir puis bloquer la clôture d'une année lorsque des notes manquent ou que des bulletins ne sont pas validés. |
| 10 | Masquer les notes des élèves et parents jusqu'à ce que l'enseignant ait terminé toute la saisie de l'évaluation. |
| 11 | Brancher les tests automatisés dans GitHub Actions. |
| 12 | Définir la conservation des sauvegardes, tester périodiquement une restauration et copier automatiquement les sauvegardes vers un stockage hors du VPS. |
| 13 | Créer un historique global des actions sensibles pour l'administrateur. |
| 14 | Remplacer l'aperçu PDF des bulletins par une compilation locale : l'aperçu actuel ne doit pas être utilisé avec de vraies données scolaires, car il passe par un service en ligne tiers. |
| 15 | Tester la génération d'emploi du temps avec une vraie école : enseignants, spécialités, salles et indisponibilités réelles. |
| 16 | Décider puis implémenter les règles avancées d'emploi du temps : salles spéciales, vacances, jours fériés, semaines A/B, options du collège et préférences. |
| 17 | Ajouter des rôles différenciés (CPE, secrétaire), les notifications parentales, le cahier de textes, la messagerie, la gestion financière complète, les statistiques avancées et une application mobile. |
