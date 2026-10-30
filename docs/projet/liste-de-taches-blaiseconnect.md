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
| Désinscription d'un élève depuis sa fiche et depuis la page de la classe (confirmation), et affichage de la vraie date d'inscription dans les listes et les fiches. |
| Inscription guidée par un compteur d'étapes ; en Terminale, choix limité aux spécialités suivies en Première. |
| Portail responsable légal : onglet « Dossier de l'enfant » (identité, scolarité et documents en lecture seule) et barre « Vous consultez » pour changer d'enfant. |
| Page Emploi du temps simplifiée (données et boutons en double retirés) ; la liste des emplois du temps générés ouvre l'aperçu du brouillon de la classe. |
| Visite guidée déplacée dans un onglet « Aide » de la barre latérale. |
| Audit des données affichées : aucune donnée métier écrite en dur dans l'application, hors la page publique des frais de scolarité. |

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
| Vérifier sur ordinateur et sur téléphone le portail parent (barre « Vous consultez », onglet « Dossier de l'enfant », ouverture et téléchargement d'un vrai document) et la position du bouton de masquage du menu. |

## 🔴 À faire

Les tâches sont classées de la plus courte à la plus importante.

| Ordre | Tâche |
|:-:|---|
| 1 | Appliquer les migrations `009` à `012` et le script `080` sur le VPS et chez le co-développeur. |
| 2 | Créer la table `schema_migrations` (numéro, fichier, date d'application, empreinte SHA-256) demandée par `AGENTS.md` §8.1, et y enregistrer les migrations déjà appliquées. |
| 3 | Publier les nouveaux emplois du temps générés ; les emplois du temps publiés actuels ont encore des spécialités simultanées signalées par les alertes. |
| 4 | Faire valider les volumes horaires par la direction et compléter les matières manquantes de la 3ème A dans les données de démonstration. |
| 5 | Ajouter l'action visible permettant de verrouiller ou déverrouiller un créneau d'emploi du temps déjà généré. |
| 6 | Contrôler la capacité d'une classe avant une inscription et refuser clairement une classe pleine. |
| 7 | Refuser la saisie de notes pour une évaluation future et contrôler la cohérence de la date de naissance et de l'âge de l'élève avec son niveau. |
| 8 | Exiger au moins un responsable légal et un contact principal avant l'inscription d'un élève. |
| 9 | Afficher les conséquences avant une désinscription et gérer le changement de classe en cours d'année avec historique. |
| 10 | Avertir puis bloquer la clôture d'une année lorsque des notes manquent ou que des bulletins ne sont pas validés. |
| 11 | Masquer les notes des élèves et parents jusqu'à ce que l'enseignant ait terminé toute la saisie de l'évaluation (liste, détail, moyennes, rang et portail responsable), avec un message « notes bientôt disponibles » et des tests. |
| 12 | Créer des types de documents précis (acte de naissance, certificat médical, autorisation…) à la place de « Administratif » et « Autre », et décider si le responsable peut déposer lui-même un document (avec validation par l'administration). |
| 13 | Rendre configurables le nom de l'école, les tarifs, les dates et le pied de page : la page publique des frais de scolarité est écrite en dur pour un seul établissement, ce qui bloque la vente à une deuxième école. |
| 14 | Brancher les tests automatisés dans GitHub Actions. |
| 15 | Définir la conservation des sauvegardes, tester périodiquement une restauration et copier automatiquement les sauvegardes vers un stockage hors du VPS. |
| 16 | Créer un historique global des actions sensibles pour l'administrateur. |
| 17 | Remplacer l'aperçu PDF des bulletins par une compilation locale : l'aperçu actuel ne doit pas être utilisé avec de vraies données scolaires, car il passe par un service en ligne tiers. |
| 18 | Préparer l'offre commerciale : grille de prix et abonnement, contrat de licence avec clause de répercussion des frais aux parents, conditions d'utilisation et protection des données des mineurs, à faire relire par un juriste. |
| 19 | Retirer les mentions de co-auteur automatiques de 12 anciens commits : la règle GitHub qui interdit le push forcé doit être levée temporairement, une sauvegarde faite avant et le co-développeur prévenu pour qu'il réinitialise ses branches. |
| 20 | Tester la génération d'emploi du temps avec une vraie école : enseignants, spécialités, salles et indisponibilités réelles. |
| 21 | Décider puis implémenter les règles avancées d'emploi du temps : salles spéciales, vacances, jours fériés, semaines A/B, options du collège et préférences. |
| 22 | Ajouter des rôles différenciés (CPE, secrétaire), les notifications parentales, le cahier de textes, la messagerie, la gestion financière complète, les statistiques avancées et une application mobile. |
