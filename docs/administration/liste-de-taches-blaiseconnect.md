# Liste de tâches — BlaiseConnect

Cette liste remplace le journal des décisions. Elle sert à suivre ce qui est terminé, ce qui doit être validé et ce qui reste à réaliser.

## Légende

- [x] Terminé
- [ ] À faire
- [~] À tester ou à valider

## Terminé

- [x] Mettre en place la connexion, la déconnexion, les rôles et la gestion des comptes.
- [x] Gérer les années scolaires, périodes, classes, matières, enseignants, élèves et responsables légaux.
- [x] Inscrire les élèves dans une classe et conserver leur historique scolaire.
- [x] Gérer les affectations enseignant, classe et matière.
- [x] Créer les évaluations, saisir les notes, calculer les moyennes et traiter les demandes de correction.
- [x] Mettre en place l’archivage et la réactivation des élèves et de leurs comptes.
- [x] Retirer le bloc indicatif « Droits d’accès » de la fiche compte : les droits sont appliqués côté serveur, pas configurables depuis cette page en V1.
- [x] Ajouter le tableau de bord administrateur.
- [x] Ajouter la gestion et la consultation des emplois du temps.
- [x] Ajouter la gestion des absences, retards et justificatifs.
- [x] Déployer l’application avec HTTPS sur le VPS.
- [x] Mettre en place les scripts de sauvegarde et de restauration de la base et des documents sur le VPS.
- [x] Planifier la sauvegarde locale quotidienne du VPS.
- [x] Ouvrir un portail responsable légal en lecture seule : choix de l’enfant, notes (page dédiée par matière), emploi du temps, absences et retards.
- [x] Générer les emplois du temps : planificateur avec barrettes de spécialités, génération pour toutes les classes, publication groupée, créneaux verrouillés, alertes après publication.
- [x] Gérer les cours particuliers sans jamais les placer pendant les cours de l’élève, avec recherche de créneaux libres.
- [x] Aligner les volumes horaires sur le programme officiel (script `database/init/080_official_weekly_volumes.sql`).
- [x] Afficher des messages d’erreur clairs (dates de naissance, règles de la base) à la place de « erreur interne ».

## À tester ou à valider

- [x] Finaliser l'affichage mobile des matières : une page dédiée affiche les évaluations d'une matière.
- [ ] Déplacer l'action de déconnexion en haut de page pour qu'elle soit plus facilement accessible.
- [~] Tester les droits réels de chaque rôle sur tous les parcours importants.
- [~] Tester entièrement le cycle des absences et des justificatifs avec des données réalistes.
- [~] Tester le parcours bulletin : préparation, aperçu PDF, validation et téléchargement. Le bouton Bulletins est grisé (« Bientôt ») pour l’admin et le parent tant que ce parcours n’est pas prêt.
- [~] Valider sur un vrai téléphone l’affichage de l’emploi du temps : vue jour, navigation par semaine, créneaux, pauses et spécialités côte à côte.
- [~] Valider le portail responsable légal avec de vraies données (testé dans le navigateur : parent de 2 enfants, parent d’un enfant, élève non rattaché introuvable).
- [~] Vérifier la sécurité de production : hôtes autorisés, CORS, cookies sécurisés et accès aux fichiers privés.

## Emploi du temps : à faire

- [ ] Publier les nouveaux emplois du temps avec le bouton de publication groupée : les emplois du temps actuellement publiés ont encore des spécialités simultanées (le bandeau d’alertes le signale).
- [ ] Appliquer les migrations `009`, `010`, `011`, `012` et le script `080` sur la base du VPS et sur celle du co-développeur (l’API refuse de démarrer si une migration manque).
- [ ] Faire valider les volumes horaires par la direction (programme officiel arrondi à l’heure pleine).
- [ ] Compléter la 3ème A : elle n’a que 4 matières dans les données de test.
- [ ] Tester l’emploi du temps sur une vraie école : vrais enseignants, vraies spécialités, vraies indisponibilités.
- [ ] Décider des règles non faites : barrettes définies par l’école, salles spéciales (labo, gymnase), vacances et jours fériés, semaines A et B, options du collège (LV2, latin), préférences par matière ou par enseignant.
- [ ] Ajouter un bouton pour verrouiller ou déverrouiller un créneau déjà généré.
- [ ] Parent : déposer un justificatif d’absence depuis le portail.

## À faire avant une vraie mise en service

- [ ] Copier automatiquement les sauvegardes vers un stockage hors du VPS.
- [ ] Définir une durée de conservation des sauvegardes et tester une restauration périodique.
- [ ] Créer un historique global des actions sensibles consultable par l’administrateur.
- [ ] Tester le parcours complet avec un établissement pilote, de vrais comptes de test et une sauvegarde préalable.

## Prévu pour une version ultérieure

- [ ] DROITS DACCES DIFERER CPE SCREAIRE.
- [ ] Portail responsable légal : notifications liées aux absences et aux justificatifs.
- [ ] Cahier de textes et devoirs.
- [ ] Messagerie interne.
- [ ] Gestion financière complète : frais, factures et paiements.
- [ ] statistiques avancées et application mobile.
