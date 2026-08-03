# Carnet de stage — BlaiseConnect
- **28 juillet 2026 — Correction US-003 :** création d’année réparée sans étendre les privilèges SQL de `blaise_app`.
- **28 juillet 2026 — Liste des années :** en-tête, fil d’Ariane et formulaire de création réalignés en mobile-first.
- **28 juillet 2026 — Interface US-003 :** statuts d’année distingués visuellement entre ouverte, courante et clôturée.
- **28 juillet 2026 — Interface US-003 :** identifiants techniques masqués et actions déplacées dans l’en-tête de la fiche année.
- **28 juillet 2026 — Décision D-021 :** suppression complète d’une année ouverte ajoutée avec confirmation du nom, transaction et audit.
- **28 juillet 2026 — US-003 :** sauvegarde année/périodes rendue atomique, contrats nettoyés et diagrammes MVC actualisés.
- **28 juillet 2026 — Fiche année :** tous les champs techniques et métier des années et périodes sont maintenant visibles en consultation.
- **28 juillet 2026 — Fiche année :** résumé et actions réorganisés ; formulaire global ajouté pour modifier l’année et ses périodes.
- **28 juillet 2026 — Navigation US-003 :** tableau des périodes retiré de la liste ; la fiche d'une année regroupe désormais son résumé et ses périodes.
- **28 juillet 2026 — Frontend US-003 :** onglet Périodes retiré et rôle transversal des périodes clarifié dans l'interface.
- **28 juillet 2026 — Données fictives :** seed 007 enrichi avec profils, année, périodes, classes, matières, coefficients et inscriptions ; ancien script PowerShell supprimé.
- **28 juillet 2026 — US-003 :** gestion des années et périodes terminée ; modification des frontières, navigation, tests backend, lint et build frontend validés.
- **20 juillet 2026 — Sprint 1 :** prise en main du dépôt et lecture des documents du projet.
- Les User Stories actives sont US-001, US-002 et US-025.
- **26 juillet 2026 - Planning Sprint 2 :** fichiers métier renseignés pour US-003 à US-006 et fichiers transversaux de conception ajoutés au Sprint Planning.
- **Correction du 26 juillet 2026 - Base Sprint 2 :** retour temporaire au schéma du Sprint 1 avant la consolidation des migrations.
- **26 juillet 2026 - Vérification finale base Sprint 2 :** FastAPI et compilation réussis, 19 tests réussis, lint/build frontend et Compose valides, privilèges contrôlés et zéro donnée temporaire restante.
- **26 juillet 2026 - Base de données :** anciennes migrations 001 à 008 consolidées en quatre fichiers ordonnés ; Compose actualisé, nouvelle séquence non exécutée.
- **26 juillet 2026 - Périodes :** une année active peut exister sans période ; chaque fin est choisie par l'administrateur et le début suivant est calculé automatiquement.
- **26 juillet 2026 - Niveaux :** codes et cycles uniformisés avec des énumérations PostgreSQL/FastAPI et une correspondance niveau-cycle contrôlée.
- **26 juillet 2026 - Vérification préparation Sprint 2 :** compilation et imports backend réussis, lint et build frontend réussis ; validation automatique PlantUML impossible car la CLI n’est pas installée.
- **26 juillet 2026 - Préparation Sprint 2 :** diagramme MVC global actualisé, diagramme détaillé Sprint 2 créé et ossature US-003 à US-006 ajoutée ; routes non montées, services non implémentés et migrations non créées en attente des validations QD-5/QD-7. Sprint Planning complété avec les fichiers concernés.
- **26 juillet 2026 - US-002 frontend :** survol visuel ajouté aux lignes du tableau pour préparer leur future navigation vers une fiche de compte.
- **26 juillet 2026 - US-002 frontend :** fil d’Ariane `Accueil > Comptes` rendu navigable ; ouverture future d’une fiche de compte depuis une ligne conservée comme prochaine étape.
- **26 juillet 2026 - US-002 frontend :** colonne Actions et contrôles inactifs retirés du tableau des comptes.
- **26 juillet 2026 - US-002 frontend :** export CSV et bouton associé retirés car non nécessaires au périmètre actuel.
- **26 juillet 2026 - US-002 frontend :** colonne « Nom et prénom » ajoutée au tableau et à l’export ; valeur provisoire « Non renseigné » tant que les profils ne sont pas exposés par l’API.
- **26 juillet 2026 - Migration 004 :** migration appliquée avec succès sur la base existante ; `blaise_app` peut insérer matricule, hash et rôle, mais pas `is_active`, et ne possède aucun droit `DELETE`.
- **26 juillet 2026 - Correction US-002 :** import et route `POST /accounts` restaurés ; `is_active` laissé à la valeur par défaut PostgreSQL ; aucun droit `DELETE` dans la migration 004. Migration non appliquée.
- **26 juillet 2026 - Audit US-002 :** Compose valide et 14 tests réussis, mais chargement FastAPI bloqué par l'import incomplet `crea` ; conflit détecté entre `is_active=True` et les droits de la migration 004. Migration non appliquée.
- **26 juillet 2026 - Vérification US-002 :** compilation backend réussie et 14 tests réussis, dont création, doublon, rôles et longueur du mot de passe.
- **26 juillet 2026 - US-002 :** préparation de `POST /accounts`, hachage, refus des doublons, rôles V1, migration 004 de moindre privilège et tests ; vérifications restant à exécuter.
- **26 juillet 2026 - US-002 :** restauration des styles mobile first des cartes de statistiques, absents de `App.css` malgré leur utilisation dans la page.
- **25 juillet 2026 - US-001 :** connexion, restauration de session et déconnexion validées ; US-001 passée au statut Terminé dans le backlog et le Sprint Planning.
- **25 juillet 2026 - US-002/025 :** accès frontend à la gestion des comptes limité au rôle ADMIN ; menu masqué et navigation refusée aux enseignants.
- **25 juillet 2026 - US-002 :** ajout visuel des indicateurs Élèves et Responsables, affichés à zéro car leurs comptes sont hors périmètre V1.
- **25 juillet 2026 - US-002 :** quatre indicateurs connectés à `GET /accounts`, avec chargement, erreur et rendu mobile first ; lint et build réussis.
- **Correction du 24 juillet — Docker pgAdmin :** secrets et ancien volume retirés ; nouvelle instance initialisée depuis le `.env`, accès HTTP local vérifié après son démarrage lent.
- **23 juillet 2026 — Sprint 1 :** les matricules commencent par `a`, `e`, `u` ou `p`, puis six chiffres.
- **22 juillet 2026 — Sprint 1 :** React est structuré en composants, pages, services, layouts, assets et styles.
- **Correction du 24 juillet — US-001/025 :** seed retiré ; une note locale ignorée par Git est prévue, sans mot de passe enregistré par l’agent.
- **Sécurité US-025 :** la migration 002 suit l'activité des sessions sur 15 minutes ; les JWT attendront la V2.
- **24 juillet 2026 :** chaque classe backend possède son fichier documenté ; aucun `lambda` n'est utilisé.
- **24 juillet 2026 — Audit Sprint 1 :** documentation complète, 9 tests, lint/build, droits SQL et parcours `login/me/logout` réussis ; US-002 et validation visuelle restent à finir.
- **25 juillet 2026 — Conception MVC :** diagramme classé par blocs View vert, Controller orange, contrats rouges, Model bleu et utilitaires gris ; SVG à régénérer.
- **25 juillet 2026 — US-002 frontend :** interface mobile first découpée en `Sidebar`, `AppHeader`, `LogoutButton` et `MainLayout` ; branchement de `GET /accounts` restant.
- **25 juillet 2026 — Interface connectée :** l’en-tête conserve une icône ouvrant `UserMenu` avec identité disponible, rôle, profil futur et seconde déconnexion.
- **28 juillet 2026 — Comptes :** `GET /accounts` retourne désormais le profil non sensible associé à chaque rôle afin d’alimenter les listes et fiches détaillées.
- **US-004 — Classes :** modèle, contrats et API alignés sur la table `classes` ; aucun archivage indépendant n’est exposé.
- **US-002 — Comptes :** bouton et formulaire de création activés pour les quatre rôles de BlaiseConnect.
- **US-004 — Classes :** le champ d’observation de classe et sa migration dédiée ont été retirés du périmètre.
- **US-004 — Fiche classe :** le professeur principal et le résumé sont affichés avant les informations générales avec les données réelles de l’API.
- **US-004 — Modification :** niveau, groupe, capacité et professeur principal sont éditables ; le niveau est verrouillé dès qu’une inscription existe.
- La modification d'une classe permet désormais de rechercher le professeur principal par nom ou matricule.
- L'onglet d'une classe affiche ses élèves depuis l'API, avec recherche, filtre par statut et accès à leur dossier.
- L'en-tête de la fiche classe possède maintenant un titre, un fil d'Ariane complet et un badge de statut coloré.
- L'onglet matières d'une classe est connecté au backend et permet une recherche et un filtre par statut.
Ajout d'une fenêtre de création de classe avec confirmation et connexion à l'API.
Ajout de la recherche du professeur principal par nom, prénom ou matricule.
Modernisation du carrousel des statistiques de gestion des comptes.
Limitation de l'onglet d'identité personnelle aux comptes administrateurs.
Mise en place de React Router pour gérer les URL et l'historique du navigateur.
Création d'une page adaptative pour ajouter atomiquement un compte et son profil.
29/07/2026 — Génération sécurisée des matricules et ajout d’un récapitulatif de compte imprimable.
30/07/2026 — Matricule : rôle, code date UTC sur 2 chiffres et code horaire sur 4 chiffres.
29/07/2026 — Affichage de la classe et de l’année scolaire dans les fiches élèves.
29/07/2026 — Association d’un responsable existant depuis le dossier élève.
29/07/2026 — Aperçu verrouillé du matricule et notifications contextuelles en fenêtre.
29/07/2026 — Activation, désactivation et archivage des comptes depuis leur fiche.
30/07/2026 — Confirmations intégrées à la plateforme et actions de compte compactées.
30/07/2026 — Simplification des informations de sécurité affichées sur la fiche compte.
30/07/2026 — Retrait de la colonne « Matières principales » du tableau des enseignants.
30/07/2026 — Création des élèves centralisée dans Comptes, inscription séparée et ajout des photos de profil.
30/07/2026 — Stockage documentaire organisé par matricule : photos, justificatifs et bulletins.
30/07/2026 — Remplacement de la photo depuis les formulaires de modification.
30/07/2026 — Champs de création obligatoires et avertissement avant affichage unique du mot de passe.
Correction de l’apparence du bouton « Ajouter un compte » : il est désormais présenté comme une action principale active.
Amélioration de la gestion des enseignants : filtres, lignes cliquables et nouvelle fiche de détail.
Correction du chargement de la gestion des classes après l’évolution de la route des enseignants.
Réorganisation de la sécurité des comptes et ajout d’une réinitialisation de mot de passe confirmée par l’administrateur.
Amélioration de la fiche compte : actions d’état compactes et réinitialisation sécurisée du mot de passe.
02/08/2026 — Fiche enseignant complétée et affectations matière-classe historisées sans suppression.
02/08/2026 — Affectation guidée par classe et blocage des matières possédant déjà un enseignant.
02/08/2026 — Ajout de la fiche matière avec classes, enseignants et emplacements des futures meilleures moyennes.
03/08/2026 — Schéma des évaluations, notes, appels, documents et bulletins consolidé en six migrations avec données fictives et diagrammes dédiés.
