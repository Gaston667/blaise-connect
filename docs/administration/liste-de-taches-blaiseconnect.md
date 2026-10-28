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
- [x] Ouvrir un portail responsable légal en lecture seule : choix de l’enfant, notes, emploi du temps, absences et bulletins validés.

## À tester ou à valider

- [~] Tester les droits réels de chaque rôle sur tous les parcours importants.
- [~] Tester entièrement le cycle des absences et des justificatifs avec des données réalistes.
- [~] Tester le parcours bulletin : préparation, aperçu PDF, validation et téléchargement.
- [~] Finaliser les détails d’affichage de l’emploi du temps : première semaine, vue jour, créneaux et pauses.
- [~] Tester le portail responsable légal avec un parent de plusieurs enfants et un parent d’un seul enfant, sans accès aux élèves non rattachés.
- [~] Vérifier la sécurité de production : hôtes autorisés, CORS, cookies sécurisés et accès aux fichiers privés.

## À faire avant une vraie mise en service

- [ ] Copier automatiquement les sauvegardes vers un stockage hors du VPS.
- [ ] Définir une durée de conservation des sauvegardes et tester une restauration périodique.
- [ ] Créer un historique global des actions sensibles consultable par l’administrateur.
- [ ] Tester le parcours complet avec un établissement pilote, de vrais comptes de test et une sauvegarde préalable.

## Prévu pour une version ultérieure

- [ ] DROITS DACCES DIFERER CPE SCREAIRE.
- [ ] Portail responsable légal : dépôt d’un justificatif d’absence par le parent et notifications.
- [ ] Cahier de textes et devoirs.
- [ ] Messagerie interne.
- [ ] Gestion financière complète : frais, factures et paiements.
- [ ] statistiques avancées et application mobile.
