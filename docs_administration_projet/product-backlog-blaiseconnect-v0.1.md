# Product Backlog — BlaiseConnect

**Version du backlog :** 0.1  
**Date de création :** 17/07/2026  
**Source :** Cahier des charges fonctionnel BlaiseConnect — Version 1  
**État du document :** Backlog initial à valider avec le responsable de l’établissement

## 1. Objectif du document

Ce Product Backlog transforme les besoins du cahier des charges en éléments de travail priorisés. Il est évolutif : les priorités, règles de gestion et critères d’acceptation seront ajustés après les échanges et démonstrations avec le responsable de l’établissement.

Une fonctionnalité indiquée dans ce document n’est considérée comme confirmée qu’après sa validation par le responsable.

## 2. Légende

### Priorités

- **Indispensable pour le MVP** : nécessaire pour qu’une première version soit utilisable.
- **Important** : apporte une valeur importante, mais peut être décalé si le temps manque.
- **Utile** : améliore l’utilisation sans bloquer le lancement.
- **Prévu pour plus tard** : hors de la Version 1 actuelle.

### Statuts

- 🟩 Terminé
- 🟨 En cours
- 🟥 À faire

### Estimation

- **XS** : moins d’une demi-journée
- **S** : environ une journée
- **M** : deux à trois jours
- **L** : quatre à cinq jours
- **XL** : plus d’une semaine ou besoin à découper

Les estimations comprennent le développement, les tests et la documentation.

## 3. Vue d’ensemble du backlog

| ID | Domaine | User Story résumée | Priorité proposée | Estimation | Statuts |
|---|---|---|---|---|---|
| US-001 | Authentification | Se connecter et se déconnecter | Indispensable pour le MVP | M | 🟥 À faire |
| US-002 | Comptes et droits | Gérer les comptes et leurs rôles | Indispensable pour le MVP | M | 🟥 À faire |
| US-003 | Années scolaires | Gérer les années et périodes scolaires | Indispensable pour le MVP | M | 🟥 À faire |
| US-004 | Classes | Gérer les classes du lycée | Indispensable pour le MVP | M | 🟥 À faire |
| US-005 | Matières | Gérer les matières et coefficients | Indispensable pour le MVP | M | 🟥 À faire |
| US-006 | Enseignants | Gérer les enseignants | Indispensable pour le MVP | M | 🟥 À faire |
| US-007 | Affectations | Affecter enseignants, classes et matières | Indispensable pour le MVP | L | 🟥 À faire |
| US-008 | Élèves | Gérer les fiches des élèves | Indispensable pour le MVP | L | 🟥 À faire |
| US-009 | Cycle de vie élève | Activer, désactiver, archiver et réactiver un élève | Important | M | 🟥 À faire |
| US-010 | Responsables légaux | Gérer et associer les responsables légaux | Indispensable pour le MVP | L | 🟥 À faire |
| US-011 | Inscriptions | Inscrire un élève dans une classe et une année | Indispensable pour le MVP | M | 🟥 À faire |
| US-012 | Consultation | Rechercher et consulter les élèves autorisés | Indispensable pour le MVP | M | 🟥 À faire |
| US-013 | Évaluations | Créer et gérer une évaluation | Indispensable pour le MVP | M | 🟥 À faire |
| US-014 | Notes | Saisir les notes d’une évaluation | Indispensable pour le MVP | L | 🟥 À faire |
| US-015 | Moyennes | Calculer les moyennes automatiquement | Indispensable pour le MVP | L | 🟥 À faire |
| US-016 | Notes | Demander et valider la modification d’une note | Important | L | 🟥 À faire |
| US-017 | Appréciations | Saisir les appréciations des élèves | Important | M | 🟥 À faire |
| US-018 | Absences | Enregistrer et consulter une absence | Indispensable pour le MVP | L | 🟥 À faire |
| US-019 | Absences | Justifier, corriger et historiser une absence | Important | L | 🟥 À faire |
| US-020 | Absence à une évaluation | Appliquer ABS, rattrapage ou zéro | Important | L | 🟥 À faire |
| US-021 | Bulletins | Préparer, valider et générer un bulletin PDF | Indispensable pour le MVP | XL | 🟥 À faire |
| US-022 | Bulletins | Conserver les versions successives d’un bulletin | Important | M | 🟥 À faire |
| US-023 | Tableau de bord | Consulter le tableau de bord administrateur | Utile | M | 🟥 À faire |
| US-024 | Tableau de bord | Consulter le tableau de bord enseignant | Utile | M | 🟥 À faire |
| US-025 | Sécurité | Sécuriser les accès, sessions et échanges | Indispensable pour le MVP | L | 🟥 À faire |
| US-026 | Traçabilité | Consulter l’historique des actions importantes | Important | M | 🟥 À faire |
| US-027 | Sauvegardes | Sauvegarder et restaurer les données et fichiers | Indispensable pour le MVP | L | 🟥 À faire |
| US-028 | Déploiement | Installer et utiliser la version pilote | Indispensable pour le MVP | L | 🟥 À faire |
| US-029 | Emplois du temps | Gérer les emplois du temps | Prévu pour plus tard | XL | 🟥 À faire |
| US-030 | Cahier de textes | Publier cours et devoirs | Prévu pour plus tard | XL | 🟥 À faire |
| US-031 | Messagerie | Échanger des messages dans l’application | Prévu pour plus tard | XL | 🟥 À faire |
| US-032 | Portail familles | Donner un accès aux parents et élèves | Prévu pour plus tard | XL | 🟥 À faire |
| US-033 | CNED | Suivre inscriptions, devoirs et résultats CNED | Prévu pour plus tard | XL | 🟥 À faire |
| US-034 | Discipline | Suivre incidents, sanctions et observations | Prévu pour plus tard | L | 🟥 À faire |
| US-035 | Gestion financière | Gérer frais, factures et paiements | Prévu pour plus tard | XL | 🟥 À faire |
| US-036 | Application mobile | Proposer une version installable sur téléphone | Prévu pour plus tard | XL | 🟥 À faire |
| US-037 | Statistiques avancées | Analyser les résultats et absences | Prévu pour plus tard | XL | 🟥 À faire |

## 4. User Stories détaillées — Version 1

### US-001 — Se connecter et se déconnecter

**User Story :** En tant qu’utilisateur, je veux me connecter avec mon compte personnel afin d’accéder aux fonctionnalités autorisées par mon rôle.

- **Besoin :** authentifier les administrateurs et les enseignants.
- **Utilisateur concerné :** administrateur, enseignant.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** compte personnel obligatoire ; mot de passe jamais stocké en clair ; déconnexion manuelle et automatique après inactivité.
- **Critères d’acceptation :** les identifiants valides ouvrent une session ; les identifiants invalides affichent un message sans révéler l’information incorrecte ; la déconnexion ferme la session ; une session inactive expire.
- **Dépendances :** aucune.
- **Tâches techniques :** modèle utilisateur ; hachage des mots de passe ; API de connexion ; gestion des jetons ou sessions ; écrans de connexion et déconnexion ; tests.
- **Cas d’erreur :** compte inexistant, mot de passe incorrect, compte désactivé, session expirée.
- **Estimation :** M.

### US-002 — Gérer les comptes et les rôles

**User Story :** En tant qu’administrateur, je veux gérer les comptes utilisateurs afin de contrôler l’accès à BlaiseConnect.

- **Besoin :** créer, consulter, modifier, désactiver et rechercher les comptes.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** seuls les administrateurs gèrent les comptes ; rôles V1 : administrateur et enseignant ; un compte désactivé ne peut plus se connecter.
- **Critères d’acceptation :** l’administrateur peut créer un compte avec un rôle ; modifier ses informations ; le désactiver ; rechercher un compte ; les droits appliqués correspondent au rôle.
- **Dépendances :** US-001.
- **Tâches techniques :** autorisations par rôle ; API CRUD ; formulaire et liste ; validation des données ; tests d’accès.
- **Cas d’erreur :** identifiant ou adresse déjà utilisé, rôle invalide, tentative d’accès par un enseignant.
- **Estimation :** M.

### US-003 — Gérer les années et périodes scolaires

**User Story :** En tant qu’administrateur, je veux gérer les années et périodes scolaires afin d’organiser les inscriptions, notes, absences et bulletins dans le temps.

- **Besoin :** créer et consulter les années scolaires ainsi que leurs périodes.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À étudier.
- **Règles de gestion :** les données historiques restent attachées à leur année ; le découpage en trimestres ou semestres doit être confirmé.
- **Critères d’acceptation :** une année peut être créée ; ses dates et périodes sont enregistrées ; une année utilisée ne peut pas être supprimée sans contrôle ; l’historique reste consultable.
- **Dépendances :** décision QD-5.
- **Tâches techniques :** modèles année et période ; API ; écrans de gestion ; contraintes de dates ; tests.
- **Cas d’erreur :** années en doublon, périodes qui se chevauchent, dates incohérentes, suppression d’une année utilisée.
- **Estimation :** M.

### US-004 — Gérer les classes

**User Story :** En tant qu’administrateur, je veux gérer les classes afin d’organiser les élèves et les enseignements pour une année scolaire.

- **Besoin :** ajouter, consulter, modifier, rechercher et archiver les classes.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** une classe possède un nom, un niveau et une année scolaire ; elle peut avoir un professeur principal, des matières et des élèves.
- **Critères d’acceptation :** l’administrateur peut créer et modifier une classe ; rechercher une classe ; consulter sa composition ; une classe est rattachée à une année.
- **Dépendances :** US-003.
- **Tâches techniques :** modèle classe ; API CRUD ; liste, recherche et formulaire ; tests.
- **Cas d’erreur :** classe en doublon pour la même année, année inexistante, archivage d’une classe encore active.
- **Estimation :** M.

### US-005 — Gérer les matières et coefficients

**User Story :** En tant qu’administrateur, je veux gérer les matières et leurs coefficients afin de configurer les enseignements et le calcul des moyennes.

- **Besoin :** ajouter, consulter, modifier et associer des matières aux classes.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À étudier.
- **Règles de gestion :** une matière possède un nom et un coefficient ; les coefficients exacts doivent être confirmés ; une matière peut concerner plusieurs classes.
- **Critères d’acceptation :** une matière peut être créée et modifiée ; son coefficient est valide ; elle peut être associée à une ou plusieurs classes.
- **Dépendances :** US-004 et décision QD-7.
- **Tâches techniques :** modèles matière et associations ; API ; formulaires ; contrôles numériques ; tests.
- **Cas d’erreur :** nom en doublon, coefficient nul ou négatif, association à une classe inexistante.
- **Estimation :** M.

### US-006 — Gérer les enseignants

**User Story :** En tant qu’administrateur, je veux gérer les enseignants afin de conserver leurs informations et préparer leurs affectations.

- **Besoin :** ajouter, consulter, modifier, rechercher et désactiver un enseignant.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** chaque enseignant possède un numéro d’identification, un nom, des coordonnées, une photo éventuelle et un statut de compte.
- **Critères d’acceptation :** l’administrateur peut créer, modifier, rechercher et désactiver une fiche ; le numéro d’identification est unique ; la fiche affiche les affectations.
- **Dépendances :** US-002.
- **Tâches techniques :** modèle enseignant ; API CRUD ; téléversement de photo ; écrans ; tests.
- **Cas d’erreur :** numéro ou adresse électronique en doublon, format de photo invalide, données obligatoires manquantes.
- **Estimation :** M.

### US-007 — Affecter les enseignants

**User Story :** En tant qu’administrateur, je veux affecter un enseignant à des classes et des matières afin de définir les enseignements dont il est responsable.

- **Besoin :** associer enseignants, classes, matières et professeur principal.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** un enseignant n’accède qu’aux classes et matières qui lui sont affectées ; une classe peut avoir un professeur principal.
- **Critères d’acceptation :** une affectation peut être créée, consultée et retirée ; l’enseignant voit seulement les données correspondant à ses affectations ; le professeur principal est identifiable.
- **Dépendances :** US-004, US-005, US-006.
- **Tâches techniques :** modèle d’affectation ; API ; interface d’affectation ; filtre d’autorisation ; tests de droits.
- **Cas d’erreur :** affectation en doublon, matière non proposée dans la classe, enseignant ou classe inactif.
- **Estimation :** L.

### US-008 — Gérer les fiches des élèves

**User Story :** En tant qu’administrateur, je veux gérer les fiches des élèves afin de centraliser les informations nécessaires à leur suivi scolaire.

- **Besoin :** ajouter, consulter, modifier et rechercher un élève.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À étudier.
- **Règles de gestion :** numéro d’identification unique ; informations limitées au besoin scolaire ; liste définitive des champs obligatoires à confirmer.
- **Critères d’acceptation :** une fiche peut être créée et modifiée ; elle est retrouvée par numéro, nom ou prénom ; la photo peut être ajoutée ; les champs obligatoires sont contrôlés.
- **Dépendances :** décision QD-10.
- **Tâches techniques :** modèle élève ; API CRUD ; recherche ; formulaire ; gestion de photo ; tests.
- **Cas d’erreur :** numéro en doublon, date de naissance invalide, fichier photo non accepté, champ obligatoire absent.
- **Estimation :** L.

### US-009 — Gérer le cycle de vie d’un élève

**User Story :** En tant qu’administrateur, je veux modifier le statut d’un élève afin de conserver son historique sans créer de doublon lorsqu’il quitte ou rejoint l’établissement.

- **Besoin :** gérer les statuts Actif, Inactif et Archivé.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Important.
- **Statut :** À faire valider.
- **Règles de gestion :** un élève inactif peut être réactivé ; une fiche archivée ne peut être réactivée qu’exceptionnellement ; l’historique est conservé.
- **Critères d’acceptation :** le changement de statut est possible selon les règles ; la réactivation réutilise la fiche existante ; les anciennes inscriptions et résultats restent disponibles.
- **Dépendances :** US-008, US-011, US-026.
- **Tâches techniques :** statuts et transitions ; contrôles métier ; interface de confirmation ; historisation ; tests.
- **Cas d’erreur :** transition interdite, réactivation sans nouvelle inscription, création d’un doublon.
- **Estimation :** M.

### US-010 — Gérer les responsables légaux

**User Story :** En tant qu’administrateur, je veux gérer les responsables légaux et les associer aux élèves afin de conserver les contacts familiaux utiles.

- **Besoin :** créer, modifier, rechercher et associer les responsables.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** un élève peut avoir plusieurs responsables ; un responsable peut être lié à plusieurs élèves ; le lien avec chaque élève est enregistré.
- **Critères d’acceptation :** un responsable peut être créé et modifié ; il peut être lié à plusieurs élèves ; la fiche d’un élève affiche ses responsables ; un lien peut être retiré sans supprimer les autres.
- **Dépendances :** US-008.
- **Tâches techniques :** modèles responsable et association ; API ; écrans ; contrôles téléphone et courriel ; tests.
- **Cas d’erreur :** élève inexistant, association en doublon, coordonnées invalides, suppression d’un responsable encore lié.
- **Estimation :** L.

### US-011 — Inscrire un élève

**User Story :** En tant qu’administrateur, je veux inscrire un élève dans une classe pour une année scolaire afin d’enregistrer sa scolarité actuelle et son historique.

- **Besoin :** rattacher un élève, une classe et une année scolaire.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** une inscription correspond à une année scolaire ; une ancienne inscription n’est pas supprimée ; un élève ne peut pas avoir deux classes actives pour la même période sauf règle contraire validée.
- **Critères d’acceptation :** l’administrateur peut inscrire un élève ; consulter son historique ; changer sa classe avec une trace ; la liste de classe est mise à jour.
- **Dépendances :** US-003, US-004, US-008.
- **Tâches techniques :** modèle inscription ; API ; formulaire ; historique ; tests.
- **Cas d’erreur :** élève inactif ou archivé, classe inexistante, inscription en doublon, année fermée.
- **Estimation :** M.

### US-012 — Rechercher et consulter les élèves autorisés

**User Story :** En tant qu’utilisateur autorisé, je veux rechercher et consulter un élève afin d’accéder rapidement aux informations nécessaires à mon travail.

- **Besoin :** consultation des élèves avec filtrage selon le rôle.
- **Utilisateur concerné :** administrateur, enseignant.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** l’administrateur voit tous les élèves ; l’enseignant voit seulement les élèves de ses classes.
- **Critères d’acceptation :** la recherche fonctionne par numéro, nom, classe et statut ; un enseignant ne peut ni afficher ni récupérer les données d’une autre classe ; l’administrateur peut consulter toutes les fiches.
- **Dépendances :** US-007, US-008, US-011, US-025.
- **Tâches techniques :** API filtrée ; recherche et pagination ; écran de liste et fiche ; tests d’accès directs.
- **Cas d’erreur :** élève introuvable, tentative d’accès non autorisée, filtre invalide.
- **Estimation :** M.

### US-013 — Créer et gérer une évaluation

**User Story :** En tant qu’enseignant, je veux créer une évaluation pour l’une de mes classes et matières afin de préparer la saisie des résultats.

- **Besoin :** créer, consulter et modifier un devoir ou un examen.
- **Utilisateur concerné :** enseignant.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À étudier.
- **Règles de gestion :** l’enseignant utilise uniquement ses classes et matières ; titre, date, barème, coefficient et période sont enregistrés.
- **Critères d’acceptation :** une évaluation valide peut être créée ; elle apparaît pour la classe concernée ; un enseignant ne peut pas créer une évaluation hors affectation ; les valeurs numériques et dates sont contrôlées.
- **Dépendances :** US-003, US-005, US-007 et décisions QD-5 à QD-7.
- **Tâches techniques :** modèle évaluation ; API ; formulaire ; contrôles de droits ; tests.
- **Cas d’erreur :** classe ou matière non autorisée, barème ou coefficient invalide, période fermée, date incohérente.
- **Estimation :** M.

### US-014 — Saisir les notes

**User Story :** En tant qu’enseignant, je veux saisir les notes de mes élèves pour une évaluation afin d’enregistrer leurs résultats.

- **Besoin :** saisie collective ou individuelle des résultats.
- **Utilisateur concerné :** enseignant.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À étudier.
- **Règles de gestion :** l’enseignant saisit seulement les notes de ses propres évaluations ; la note respecte le barème ; une seule note courante par élève et évaluation.
- **Critères d’acceptation :** la liste des élèves de la classe est affichée ; les notes valides sont enregistrées ; les notes hors barème sont refusées ; les données restent disponibles après reconnexion.
- **Dépendances :** US-011, US-013 et décision QD-6.
- **Tâches techniques :** modèle note ; API de saisie ; tableau de saisie ; validations ; tests.
- **Cas d’erreur :** note hors barème, élève non inscrit, évaluation non autorisée, doublon, erreur réseau pendant l’enregistrement.
- **Estimation :** L.

### US-015 — Calculer les moyennes

**User Story :** En tant qu’utilisateur autorisé, je veux que les moyennes soient calculées automatiquement afin d’obtenir des résultats fiables par matière et par période.

- **Besoin :** calculer les moyennes de matière et la moyenne générale.
- **Utilisateur concerné :** administrateur, enseignant.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À étudier.
- **Règles de gestion :** calcul fondé sur les notes, barèmes et coefficients ; règles d’arrondi à confirmer ; résultats regroupés par période.
- **Critères d’acceptation :** les moyennes correspondent à des jeux de données de référence ; une modification de note déclenche un recalcul ; les absences sont traitées selon leur statut ; aucune division par zéro n’est possible.
- **Dépendances :** US-003, US-005, US-014, US-020 et décisions QD-5 à QD-7.
- **Tâches techniques :** service de calcul ; tests unitaires avec exemples validés ; affichage des moyennes ; gestion des arrondis.
- **Cas d’erreur :** aucun résultat, coefficient manquant, barème nul, absence en attente, données incohérentes.
- **Estimation :** L.

### US-016 — Demander et valider une modification de note

**User Story :** En tant qu’enseignant, je veux demander la modification d’une note déjà enregistrée afin de corriger une erreur tout en conservant une validation et un historique.

- **Besoin :** workflow de demande, validation ou refus d’une correction.
- **Utilisateur concerné :** enseignant, professeur principal, administrateur.
- **Priorité :** Important.
- **Statut :** À faire valider.
- **Règles de gestion :** la nouvelle note reste en attente ; le professeur principal valide, sauf pour sa propre note qui est validée par un administrateur ; ancienne et nouvelle valeurs sont conservées.
- **Critères d’acceptation :** une demande contient l’ancienne et la nouvelle note ; la note courante ne change qu’après validation ; le bon valideur est appliqué ; le refus conserve la note d’origine ; l’historique est consultable.
- **Dépendances :** US-007, US-014, US-026.
- **Tâches techniques :** modèle de demande ; workflow ; API ; interfaces demande et validation ; notifications internes visuelles ; tests de rôles.
- **Cas d’erreur :** auto-validation interdite, demande concurrente, note hors barème, utilisateur non autorisé.
- **Estimation :** L.

### US-017 — Saisir les appréciations

**User Story :** En tant qu’enseignant, je veux ajouter une appréciation sur le travail d’un élève afin de compléter ses résultats et son bulletin.

- **Besoin :** appréciation par matière et appréciation générale du professeur principal.
- **Utilisateur concerné :** enseignant, professeur principal.
- **Priorité :** Important.
- **Statut :** À faire valider.
- **Règles de gestion :** l’enseignant écrit pour ses classes et matières ; seul le professeur principal saisit l’appréciation générale de sa classe.
- **Critères d’acceptation :** une appréciation peut être enregistrée et modifiée avant validation du bulletin ; l’accès respecte les affectations ; l’appréciation apparaît dans le bulletin.
- **Dépendances :** US-007, US-011, US-021.
- **Tâches techniques :** modèle ou champ d’appréciation ; API ; formulaire ; contrôle de longueur ; tests.
- **Cas d’erreur :** classe non autorisée, période fermée, texte trop long, bulletin déjà validé.
- **Estimation :** M.

### US-018 — Enregistrer et consulter une absence

**User Story :** En tant qu’utilisateur autorisé, je veux enregistrer et consulter une absence afin d’assurer le suivi de l’assiduité des élèves.

- **Besoin :** créer et rechercher les absences.
- **Utilisateur concerné :** administrateur, enseignant.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** l’enseignant agit uniquement pour ses classes ; l’administrateur agit pour tous les élèves ; une nouvelle absence est en attente tant que son statut n’est pas traité.
- **Critères d’acceptation :** une absence enregistre élève, date, heure, durée, classe, auteur et motif éventuel ; la consultation respecte les droits ; les filtres par élève, classe, date et statut fonctionnent.
- **Dépendances :** US-007, US-011, US-012.
- **Tâches techniques :** modèle absence ; API ; formulaire et liste filtrée ; contrôles de droits ; tests.
- **Cas d’erreur :** élève absent de la classe, date ou durée invalide, doublon, utilisateur non autorisé.
- **Estimation :** L.

### US-019 — Justifier et corriger une absence

**User Story :** En tant qu’administrateur, je veux traiter et corriger les absences afin de distinguer les absences justifiées des absences non justifiées.

- **Besoin :** gérer statuts, motifs, justificatifs, corrections et historique.
- **Utilisateur concerné :** administrateur ; enseignant pour le signalement d’erreur.
- **Priorité :** Important.
- **Statut :** À étudier.
- **Règles de gestion :** statuts En attente, Justifiée et Non justifiée ; seul l’administrateur accepte un justificatif ou corrige définitivement ; les modifications sont historisées.
- **Critères d’acceptation :** l’administrateur peut modifier le statut avec une trace ; joindre un justificatif valide ; corriger ou supprimer logiquement une absence ; un enseignant peut signaler une erreur sans la corriger directement.
- **Dépendances :** US-018, US-026 et décision QD-9.
- **Tâches techniques :** workflow ; stockage sécurisé des justificatifs ; interface de traitement ; historique ; tests.
- **Cas d’erreur :** fichier non accepté, transition de statut invalide, correction non autorisée, absence déjà supprimée.
- **Estimation :** L.

### US-020 — Traiter une absence à une évaluation

**User Story :** En tant qu’enseignant, je veux enregistrer l’absence d’un élève à une évaluation afin d’appliquer correctement le rattrapage ou la note zéro.

- **Besoin :** relier les absences aux résultats d’évaluation.
- **Utilisateur concerné :** enseignant, administrateur.
- **Priorité :** Important.
- **Statut :** À étudier.
- **Règles de gestion :** mention ABS ; absence justifiée non comptée comme zéro et suivie d’un rattrapage ; absence non justifiée transformée en zéro.
- **Critères d’acceptation :** ABS peut remplacer une note ; une justification empêche le zéro ; une non-justification applique zéro ; la note de rattrapage remplace ABS ; la moyenne est recalculée.
- **Dépendances :** US-014, US-019, US-015.
- **Tâches techniques :** lien absence-évaluation ; règles de conversion ; interface de rattrapage ; tests de calcul.
- **Cas d’erreur :** note et ABS simultanés, statut en attente, rattrapage en doublon, absence sans évaluation.
- **Estimation :** L.

### US-021 — Générer un bulletin PDF

**User Story :** En tant qu’administrateur, je veux vérifier, valider et générer le bulletin PDF d’un élève afin de fournir un document scolaire imprimable.

- **Besoin :** produire un bulletin par élève et période.
- **Utilisateur concerné :** administrateur ; enseignant pour consultation et appréciations.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À étudier.
- **Règles de gestion :** contenu conforme au modèle de l’école ; génération après vérification ; bulletin avec identité, classe, période, matières, coefficients, moyennes, appréciations, moyenne générale, absences, logo et nom de l’école.
- **Critères d’acceptation :** un aperçu permet de vérifier les informations ; le PDF est généré sans donnée manquante obligatoire ; il est lisible, téléchargeable et imprimable ; seuls les utilisateurs autorisés y accèdent.
- **Dépendances :** US-003, US-015, US-017, US-018 et décision QD-8.
- **Tâches techniques :** modèle de bulletin ; service PDF ; écran de vérification et validation ; stockage sécurisé ; tests de contenu et rendu.
- **Cas d’erreur :** notes ou appréciations incomplètes, modèle absent, erreur de génération, utilisateur non autorisé.
- **Estimation :** XL, à découper avant planification.

### US-022 — Versionner les bulletins

**User Story :** En tant qu’administrateur, je veux générer une nouvelle version d’un bulletin après une correction afin de conserver le document précédent dans l’historique.

- **Besoin :** recalcul et conservation des versions PDF.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Important.
- **Statut :** À faire valider.
- **Règles de gestion :** une correction validée déclenche le recalcul ; l’ancien bulletin n’est pas supprimé ; chaque version est datée et identifiable.
- **Critères d’acceptation :** une nouvelle version peut être générée ; les anciennes versions restent consultables par les personnes autorisées ; la version courante est clairement indiquée.
- **Dépendances :** US-016, US-021, US-026.
- **Tâches techniques :** modèle de versions ; régénération PDF ; écran d’historique ; contrôles d’accès ; tests.
- **Cas d’erreur :** correction non validée, version concurrente, fichier historique manquant, échec de génération.
- **Estimation :** M.

### US-023 — Consulter le tableau de bord administrateur

**User Story :** En tant qu’administrateur, je veux consulter un résumé de la situation scolaire afin d’identifier rapidement les actions en attente.

- **Besoin :** afficher les effectifs et tâches importantes.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Utile.
- **Statut :** À faire valider.
- **Règles de gestion :** données limitées à l’année scolaire sélectionnée ; liens vers les éléments concernés.
- **Critères d’acceptation :** affichage du nombre d’élèves, enseignants et classes ; absences à traiter ; notes incomplètes ; modifications de notes ; bulletins en attente ; chiffres cohérents avec les listes.
- **Dépendances :** US-004, US-006, US-008, US-016, US-018, US-021.
- **Tâches techniques :** API d’agrégation ; cartes de synthèse ; liens de navigation ; tests de cohérence.
- **Cas d’erreur :** aucune donnée, année non sélectionnée, requête partiellement indisponible.
- **Estimation :** M.

### US-024 — Consulter le tableau de bord enseignant

**User Story :** En tant qu’enseignant, je veux consulter un résumé de mes classes et tâches afin de savoir quelles actions réaliser.

- **Besoin :** afficher affectations, évaluations, notes, absences et demandes en attente.
- **Utilisateur concerné :** enseignant.
- **Priorité :** Utile.
- **Statut :** À faire valider.
- **Règles de gestion :** seules les données de l’enseignant et de ses classes sont visibles.
- **Critères d’acceptation :** affichage des classes et matières ; prochaines évaluations ; notes restant à saisir ; absences des classes ; demandes de modification en attente ; aucun accès à une autre classe.
- **Dépendances :** US-007, US-013, US-014, US-016, US-018.
- **Tâches techniques :** API filtrée ; composants de synthèse ; tests d’autorisation et de cohérence.
- **Cas d’erreur :** enseignant sans affectation, aucune donnée, tentative d’accès à une autre classe.
- **Estimation :** M.

### US-025 — Sécuriser les accès et les sessions

**User Story :** En tant qu’établissement, je veux que les accès et échanges soient sécurisés afin de protéger les données scolaires.

- **Besoin :** sécurité transversale de l’application.
- **Utilisateur concerné :** établissement, tous les utilisateurs.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À faire valider.
- **Règles de gestion :** HTTPS ; mots de passe hachés ; droits contrôlés côté serveur ; expiration des sessions ; fichiers non accessibles publiquement.
- **Critères d’acceptation :** toute API sensible refuse un utilisateur non autorisé ; les mots de passe sont hachés ; la connexion de production utilise HTTPS ; une session expirée est refusée ; les tests de rôles passent.
- **Dépendances :** US-001, architecture et environnement de déploiement.
- **Tâches techniques :** middleware d’autorisation ; configuration HTTPS ; stockage protégé ; validation des entrées ; tests de sécurité essentiels.
- **Cas d’erreur :** jeton invalide, rôle insuffisant, session expirée, accès direct à un fichier, entrée malveillante.
- **Estimation :** L, répartie sur toutes les stories.

### US-026 — Historiser les actions importantes

**User Story :** En tant qu’administrateur, je veux consulter l’historique des actions importantes afin d’assurer la traçabilité des modifications sensibles.

- **Besoin :** enregistrer notamment les modifications de notes, absences, statuts et bulletins.
- **Utilisateur concerné :** administrateur.
- **Priorité :** Important.
- **Statut :** À faire valider.
- **Règles de gestion :** auteur, date, action, ancienne valeur et nouvelle valeur lorsque pertinent ; historique non modifiable par un utilisateur standard.
- **Critères d’acceptation :** chaque action définie comme sensible crée une trace ; l’administrateur peut filtrer l’historique ; un enseignant ne peut pas supprimer une trace.
- **Dépendances :** US-001 et fonctionnalités historisées.
- **Tâches techniques :** modèle audit ; service d’écriture ; écran de consultation ; filtres ; tests.
- **Cas d’erreur :** action sans auteur, données historiques incomplètes, tentative de modification ou suppression.
- **Estimation :** M.

### US-027 — Sauvegarder et restaurer les données

**User Story :** En tant qu’administrateur technique, je veux sauvegarder et restaurer les données et fichiers afin de pouvoir reprendre le service après une perte ou une panne.

- **Besoin :** sauvegarder base de données, photos, justificatifs et bulletins.
- **Utilisateur concerné :** administrateur technique de l’application.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À étudier.
- **Règles de gestion :** une copie hors du serveur principal ; procédure documentée ; restauration testée ; fréquence et durée de conservation à définir.
- **Critères d’acceptation :** une sauvegarde complète peut être produite ; son résultat est contrôlé ; une restauration de test récupère la base et les fichiers ; la procédure est documentée.
- **Dépendances :** infrastructure choisie et décision QD-11.
- **Tâches techniques :** scripts de sauvegarde ; stockage secondaire ; planification ; contrôle des journaux ; test de restauration ; documentation.
- **Cas d’erreur :** stockage indisponible, espace insuffisant, sauvegarde incomplète, archive corrompue, échec de restauration.
- **Estimation :** L.

### US-028 — Déployer la version pilote

**User Story :** En tant que responsable de l’établissement, je veux utiliser BlaiseConnect avec un groupe pilote afin de vérifier son fonctionnement avant son ouverture générale.

- **Besoin :** installer, initialiser, présenter et tester l’application en situation réelle.
- **Utilisateur concerné :** responsable, administrateurs pilotes, enseignants pilotes.
- **Priorité :** Indispensable pour le MVP.
- **Statut :** À étudier.
- **Règles de gestion :** lancement limité à quelques enseignants et une ou deux classes ; problèmes bloquants corrigés avant extension.
- **Critères d’acceptation :** application installée sur le serveur ; comptes et données pilotes créés ou importés ; utilisateurs formés ; scénario réel de notes et absences effectué ; retours enregistrés ; aucun problème bloquant ouvert.
- **Dépendances :** MVP testé, US-025, US-027 et décisions QD-1 à QD-4, QD-11 et QD-12.
- **Tâches techniques :** Docker et configuration ; données initiales ; procédure d’installation ; support de démonstration ; collecte de retours ; corrections bloquantes.
- **Cas d’erreur :** serveur indisponible, Internet insuffisant, données d’import incorrectes, utilisateur non formé, anomalie bloquante.
- **Estimation :** L.

## 5. User Stories reportées

### US-029 — Gérer les emplois du temps

**User Story :** En tant qu’administrateur, je veux organiser les horaires des classes, matières et enseignants afin de publier les emplois du temps.

- **Besoin :** planification des créneaux et prévention des conflits.
- **Utilisateur concerné :** administrateur, enseignant.
- **Priorité :** Prévu pour plus tard.
- **Statut :** Reporté.
- **Règles de gestion :** à définir avec l’établissement.
- **Critères d’acceptation :** un emploi du temps peut être créé et consulté sans conflit de classe, salle ou enseignant.
- **Dépendances :** classes, matières et affectations stabilisées.
- **Tâches techniques :** analyse métier, modèle de créneaux, moteur de conflits, calendrier, tests.
- **Cas d’erreur :** double affectation, créneau invalide, ressource indisponible.
- **Estimation :** XL.

### US-030 — Publier le cahier de textes

**User Story :** En tant qu’enseignant, je veux publier les cours et devoirs afin de conserver les travaux demandés à la classe.

- **Besoin :** cahier de textes par classe, matière et date.
- **Utilisateur concerné :** enseignant.
- **Priorité :** Prévu pour plus tard.
- **Statut :** Reporté.
- **Règles de gestion :** publication limitée aux affectations de l’enseignant.
- **Critères d’acceptation :** un enseignant peut créer, modifier et consulter une entrée pour sa classe et sa matière.
- **Dépendances :** affectations et éventuellement comptes élèves/parents.
- **Tâches techniques :** analyse, modèle, API, éditeur, pièces jointes, tests.
- **Cas d’erreur :** classe non autorisée, date invalide, pièce jointe refusée.
- **Estimation :** XL.

### US-031 — Utiliser une messagerie interne

**User Story :** En tant qu’utilisateur, je veux échanger des messages dans BlaiseConnect afin de centraliser les communications scolaires.

- **Besoin :** envoi, réception et consultation des messages.
- **Utilisateur concerné :** utilisateurs à définir.
- **Priorité :** Prévu pour plus tard.
- **Statut :** Reporté.
- **Règles de gestion :** destinataires, modération, conservation et notifications à définir.
- **Critères d’acceptation :** un utilisateur autorisé peut envoyer et recevoir un message avec une traçabilité minimale.
- **Dépendances :** comptes utilisateurs et règles de communication validées.
- **Tâches techniques :** analyse, modèle, API, boîte de réception, notifications, sécurité, tests.
- **Cas d’erreur :** destinataire inexistant, pièce jointe interdite, envoi en doublon.
- **Estimation :** XL.

### US-032 — Donner un accès aux parents et élèves

**User Story :** En tant que parent ou élève, je veux consulter les notes, absences et bulletins afin de suivre la scolarité concernée.

- **Besoin :** portail sécurisé pour les familles et élèves.
- **Utilisateur concerné :** parent, élève.
- **Priorité :** Prévu pour plus tard.
- **Statut :** Reporté.
- **Règles de gestion :** un compte accède uniquement aux élèves qui lui sont associés ; règles spécifiques aux mineurs à définir.
- **Critères d’acceptation :** l’utilisateur consulte uniquement ses données autorisées ; aucune modification scolaire sensible n’est possible sans droit.
- **Dépendances :** comptes, responsables légaux, notes, absences et bulletins stabilisés.
- **Tâches techniques :** rôles supplémentaires ; activation de comptes ; portail ; récupération de mot de passe ; tests de confidentialité.
- **Cas d’erreur :** association familiale incorrecte, compte partagé, accès à un autre élève.
- **Estimation :** XL.

### US-033 — Suivre le CNED

**User Story :** En tant qu’administrateur, je veux suivre les inscriptions, devoirs et résultats du CNED afin de centraliser le parcours CNED des élèves concernés.

- **Besoin :** module spécifique au CNED.
- **Utilisateur concerné :** administrateur, enseignant à préciser.
- **Priorité :** Prévu pour plus tard.
- **Statut :** Reporté.
- **Règles de gestion :** processus et données à étudier avec l’établissement.
- **Critères d’acceptation :** à définir après analyse des documents et pratiques CNED.
- **Dépendances :** gestion des élèves stabilisée et analyse métier dédiée.
- **Tâches techniques :** atelier métier, modèle, API, interface, éventuel import, tests.
- **Cas d’erreur :** données CNED incomplètes, doublons, formats incompatibles.
- **Estimation :** XL.

### US-034 — Suivre la discipline

**User Story :** En tant qu’administrateur, je veux enregistrer les incidents, sanctions et observations afin d’assurer le suivi disciplinaire des élèves.

- **Besoin :** dossier disciplinaire sécurisé.
- **Utilisateur concerné :** administrateur, personnels autorisés à définir.
- **Priorité :** Prévu pour plus tard.
- **Statut :** Reporté.
- **Règles de gestion :** droits, durée de conservation et types d’incidents à valider.
- **Critères d’acceptation :** seuls les utilisateurs autorisés enregistrent et consultent un incident avec historique.
- **Dépendances :** gestion des élèves et politique de confidentialité.
- **Tâches techniques :** analyse, modèle, permissions renforcées, interface, audit, tests.
- **Cas d’erreur :** accès non autorisé, donnée sensible excessive, modification non tracée.
- **Estimation :** L.

### US-035 — Gérer les frais, factures et paiements

**User Story :** En tant qu’administrateur financier, je veux gérer les frais scolaires, factures et paiements afin de suivre la situation financière des familles.

- **Besoin :** gestion financière scolaire.
- **Utilisateur concerné :** personnel financier à définir.
- **Priorité :** Prévu pour plus tard.
- **Statut :** Reporté.
- **Règles de gestion :** règles comptables, devise, échéances et droits à étudier.
- **Critères d’acceptation :** à définir après analyse comptable et réglementaire.
- **Dépendances :** élèves, responsables légaux et validation du processus financier.
- **Tâches techniques :** analyse métier, sécurité, facturation, paiements, exports, tests.
- **Cas d’erreur :** double paiement, montant incohérent, facture modifiée après validation.
- **Estimation :** XL.

### US-036 — Proposer une application mobile

**User Story :** En tant qu’utilisateur, je veux utiliser BlaiseConnect sur mon téléphone afin d’accéder plus facilement aux services scolaires.

- **Besoin :** application mobile ou web installable.
- **Utilisateur concerné :** utilisateurs à définir.
- **Priorité :** Prévu pour plus tard.
- **Statut :** Reporté.
- **Règles de gestion :** choix PWA ou application native à étudier ; mêmes droits que la version web.
- **Critères d’acceptation :** l’application s’installe sur les appareils ciblés et permet les fonctions retenues sans contourner les droits.
- **Dépendances :** version web stable et choix technologique.
- **Tâches techniques :** étude PWA/native ; adaptation de l’interface ; gestion hors ligne éventuelle ; tests appareils.
- **Cas d’erreur :** appareil incompatible, connexion instable, données locales non protégées.
- **Estimation :** XL.

### US-037 — Consulter des statistiques avancées

**User Story :** En tant que responsable, je veux analyser les résultats et les absences afin d’observer les évolutions scolaires et d’orienter les actions de l’établissement.

- **Besoin :** indicateurs, filtres et évolutions dans le temps.
- **Utilisateur concerné :** responsable, administrateur.
- **Priorité :** Prévu pour plus tard.
- **Statut :** Reporté.
- **Règles de gestion :** indicateurs et niveaux d’agrégation à valider ; confidentialité des données individuelles.
- **Critères d’acceptation :** les statistiques correspondent aux données sources et peuvent être filtrées selon les dimensions validées.
- **Dépendances :** historique suffisant de notes et d’absences.
- **Tâches techniques :** définition des indicateurs ; requêtes d’agrégation ; visualisations ; exports éventuels ; tests de cohérence.
- **Cas d’erreur :** données insuffisantes, indicateur mal défini, petit groupe révélant une donnée sensible.
- **Estimation :** XL.

## 6. Questions de cadrage bloquantes ou importantes

| ID | Question à poser au responsable | Stories concernées | Statut |
|---|---|---|---|
| QD-1 | Quels outils sont actuellement utilisés par l’école ? | US-028 | À étudier |
| QD-2 | Existe-t-il déjà des fichiers contenant les élèves et enseignants ? | US-006, US-008, US-028 | À étudier |
| QD-3 | Combien y a-t-il d’élèves, d’enseignants et de classes au lycée ? | Performance et déploiement | À étudier |
| QD-4 | Quelles classes participeront au lancement pilote ? | US-028 | À étudier |
| QD-5 | L’année est-elle divisée en trimestres ou en semestres ? | US-003, US-013, US-015, US-021 | À étudier |
| QD-6 | Quel barème est utilisé pour les notes ? | US-013, US-014, US-015 | À étudier |
| QD-7 | Quels coefficients et règles d’arrondi sont appliqués ? | US-005, US-013, US-015 | À étudier |
| QD-8 | Existe-t-il un modèle officiel de bulletin ? | US-021, US-022 | À étudier |
| QD-9 | Quels justificatifs d’absence sont acceptés ? | US-019, US-020 | À étudier |
| QD-10 | Quelles informations sont obligatoires sur la fiche d’un élève ? | US-008 | À étudier |
| QD-11 | L’école possède-t-elle un serveur, un domaine et une connexion suffisante ? | US-025, US-027, US-028 | À étudier |
| QD-12 | Qui sera chargé de valider les fonctionnalités ? | Toutes | À étudier |

## 7. Risques identifiés

| ID | Risque | Conséquence possible | Réponse proposée |
|---|---|---|---|
| R-01 | Périmètre V1 trop important pour cinq semaines | Fonctionnalités incomplètes ou peu testées | Définir un MVP de démonstration et reporter les éléments non essentiels |
| R-02 | Règles de notes et de moyennes non confirmées | Calculs incorrects et reprise du développement | Valider QD-5, QD-6 et QD-7 avant US-015 |
| R-03 | Modèle officiel du bulletin indisponible | Retard sur la génération PDF | Obtenir un exemple avant de commencer US-021 |
| R-04 | Données existantes de mauvaise qualité | Import long ou erreurs dans les fiches | Examiner un échantillon avant de prévoir l’import |
| R-05 | Infrastructure de l’école inconnue | Déploiement ou sauvegardes impossibles | Valider QD-11 dès le cadrage initial |
| R-06 | Données scolaires sensibles | Accès non autorisé ou perte de données | Appliquer les droits côté serveur, les sauvegardes et les tests de sécurité |

## 8. Ordre fonctionnel recommandé

Cet ordre indique les dépendances générales. Il ne constitue pas encore un Sprint Backlog.

1. Valider les questions de cadrage prioritaires.
2. Mettre en place l’authentification et les droits.
3. Configurer les années, classes, matières et enseignants.
4. Gérer les élèves, responsables légaux et inscriptions.
5. Mettre en place les affectations et la consultation selon les droits.
6. Développer les évaluations, notes et moyennes.
7. Ajouter les absences et appréciations.
8. Générer les bulletins.
9. Ajouter les tableaux de bord et fonctions avancées si le temps le permet.
10. Tester, sauvegarder et déployer le pilote.

## 9. Prochaine validation attendue

Avant de préparer le premier sprint, le responsable doit au minimum confirmer :

- les fonctionnalités indispensables pour la démonstration de fin de stage ;
- le découpage de l’année scolaire ;
- le barème, les coefficients et les règles de moyenne ;
- les informations obligatoires des élèves ;
- les classes et utilisateurs du pilote ;
- l’existence du modèle officiel de bulletin ;
- l’infrastructure disponible pour le déploiement.

