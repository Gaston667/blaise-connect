# 🗓️ Fonctionnement de l'emploi du temps (BlaiseConnect)

> [!NOTE]
> Document destiné au co-développeur. Il décrit comment l'emploi du temps est **configuré, généré, publié et consulté**, et ses limites actuelles.

**Sommaire :** [Vue d'ensemble](#1-vue-densemble-) · [Configuration](#2-ce-que-ladministrateur-configure-avant-de-générer) · [Génération](#3-la-génération-️) · [Brouillon](#4-le-brouillon) · [Publication](#5-la-publication-) · [Cours particuliers](#6-les-cours-particuliers-soutien-rattrapage) · [Consultation](#7-la-consultation) · [Alertes](#8-alertes-bandeau-en-haut-de-la-page-admin) · [Sécurité](#9-sécurité-et-robustesse) · [Limites](#10-limites-actuelles-️) · [Mise en place](#11-mise-en-place-sur-une-base-) · [Tests](#12-tests)

---

## 1. Vue d'ensemble 🧭

```
Configuration  →  Génération  →  Brouillon  →  Contrôles  →  Publication  →  Consultation
(horaires,        (une classe     (modifiable)   (à la         (une classe     (élève, parent,
 volumes, profs)   ou toutes)                    publication)   ou toutes)      enseignant, admin)
```

Un emploi du temps est **hebdomadaire et récurrent** : un créneau = un jour de la semaine + une heure de début et de fin, rattaché à une affectation (enseignant + matière + classe). Il est valable sur une période (par défaut toute l'année scolaire). Un cours à date unique existe séparément (`timetable_date_slots`).

## 2. Ce que l'administrateur configure avant de générer

| Élément | Où | Détail |
|---|---|---|
| Horaires et pauses | Emploi du temps → onglet Configuration | Par cycle (maternelle, primaire, collège, lycée) et par jour : début, fin, durée d'un cours, récréations, déjeuner. |
| Volumes hebdomadaires | Génération d'une classe, ou script `database/init/080_official_weekly_volumes.sql` | Heures par matière et par niveau (programme officiel, arrondies à l'heure). Une matière sans volume n'est pas planifiée mais reste dans la classe (notes, bulletins). |
| Enseignants | Affectations | Une matière d'une classe a un seul enseignant à la fois. Une matière sans enseignant est signalée comme non placée. |
| Indisponibilités | Base (`teacher_unavailabilities`) | Jours ou heures où un enseignant ne peut pas enseigner. |
| Salles | `rooms` | Utilisées pour les spécialités. |
| Spécialités des élèves | Fiche élève (Première : 3, Terminale : 2) | Servent à déduire les barrettes. |
| Taille d'une séance | `subjects.session_periods` | 1 = séance d'une période (langues, EMC, arts), 2 = bloc de deux périodes. |

## 3. La génération ⚙️

Deux façons de générer, toujours sous forme de **brouillon** (jamais publié automatiquement) :
- **Une classe** : onglet « Créer le brouillon ».
- **Toutes les classes** : bouton « Générer pour toutes les classes » (page Emploi du temps), avec confirmation. Toutes les classes de l'année courante sont planifiées ensemble, en mémoire, dans plusieurs ordres (jusqu'à 20, 40 secondes maximum) ; seul le meilleur ordre est enregistré. C'est ce qui évite qu'une classe prenne les meilleurs créneaux et que les suivantes n'aient que les restes.

### 🔒 Règles toujours respectées (règles dures)
- Une seule matière régulière à la fois pour la classe ; jamais de cours à cheval sur une pause.
- Un enseignant n'est jamais à deux endroits en même temps, en tenant compte des emplois du temps publiés **et des brouillons** des autres classes (même année, période qui se recoupe) et de ses indisponibilités.
- Une salle n'est jamais occupée deux fois en même temps.
- Plafond d'heures par jour pour la classe : 5 h (maternelle), 6 h (primaire), 7 h (collège), 8 h (lycée). Un enseignant : 7 h par jour au maximum, en comptant toutes ses classes.
- Un cours publié pour toute la classe n'est jamais écrasé.

### 🎓 Les spécialités et les barrettes
Au lycée, les élèves d'une même classe ne suivent pas les mêmes spécialités. Le générateur les regroupe en **barrettes** :
- toutes les spécialités d'une barrette ont **exactement les mêmes horaires** (blocs de 2 h) ;
- deux spécialités qu'un même élève a choisies ensemble ne sont **jamais** dans la même barrette, donc jamais en même temps ;
- une spécialité n'a lieu qu'une fois par jour ;
- le tronc commun, lui, réunit toute la classe ;
- le nombre de barrettes est déduit des choix des élèves (au moins 3 en Première, 2 en Terminale). Si les choix l'exigent, il peut y en avoir davantage.

### 🎯 Règles souples (optimisées par un score)
Peu de trous dans la journée, jours équilibrés, une matière une seule fois par jour, séances d'une matière pas deux jours de suite, journées qui démarrent tôt. Le générateur essaie plusieurs variantes déterministes et garde la meilleure.

### Arrondis et résultats
- Un volume qui n'est pas un multiple de la durée d'un cours est arrondi au supérieur et signalé.
- Les heures qui n'ont pas pu être placées sont listées **avec la raison** (créneaux pris par la classe, enseignant occupé ou au maximum d'heures, plafond de la journée). Une matière demandée sans enseignant est signalée aussi.

## 4. Le brouillon

- Il est visible dans l'onglet « Emploi du temps » de la classe (grille hebdomadaire, détail d'un cours au clic : matière, enseignant, salle, jour, horaire, type, statut, placement).
- L'admin peut **ajouter** ou **supprimer** un créneau. Un créneau ajouté à la main est **verrouillé** : une régénération le conserve et planifie le reste autour.
- Régénérer remplace le brouillon, sauf les créneaux verrouillés.

## 5. La publication 🚀

Contrôles avant publication (un seul échec bloque) :
1. Aucun élève n'a deux spécialités en même temps.
2. Chaque volume horaire configuré est entièrement placé.
3. Aucun cours particulier ne tombe pendant un cours que l'élève suit.
4. Aucune partie d'un emploi du temps publié sur une autre période n'est perdue (un recouvrement partiel est refusé).
5. Les contrôles de la base : horaires et pauses, indisponibilités, enseignants et salles déjà pris dans un autre emploi du temps publié.

> [!IMPORTANT]
> **Publier classe par classe échoue** quand on remplace tout l'établissement : le nouveau brouillon d'une classe est comparé aux anciens emplois du temps encore publiés des autres. Le bouton **« Publier les N emplois du temps complets »** publie donc les classes complètes ensemble, dans une seule transaction : si l'une échoue, rien n'est modifié.

À la publication, l'ancienne version publiée sur la même période passe en archive (elle n'est jamais supprimée).

## 6. Les cours particuliers (soutien, rattrapage)

- Un cours individuel ne retire **aucun créneau à la classe** et ne tombe **jamais** pendant un cours que l'élève suit (son tronc commun et ses propres spécialités). Il peut tomber pendant une spécialité qu'il n'a pas choisie.
- Le bouton « Proposer des créneaux libres » donne les créneaux où l'élève n'a pas cours, l'enseignant est libre (cours, indisponibilités, autres cours particuliers) et une salle est disponible ; le samedi matin est proposé si l'école y enseigne.
- Un cours valide est publié immédiatement et prend par défaut l'enseignant de la matière dans la classe.

## 7. La consultation

| Rôle | Ce qu'il voit |
|---|---|
| Élève | Le planning publié de sa classe, avec uniquement **ses** spécialités, plus ses cours particuliers. Navigation semaine par semaine. |
| Parent | Idem, pour l'enfant sélectionné (lecture seule). |
| Enseignant | Ses cours dans toutes ses classes (y compris cours datés). |
| Administrateur | Tous les plannings, brouillons, détail d'un cours, alertes. |

Navigation par semaine : un cours à date unique n'apparaît qu'à sa date ; un cours hebdomadaire apparaît chaque semaine de sa période de validité.

## 8. Alertes (bandeau en haut de la page admin)
- Un élève a deux spécialités en même temps dans l'emploi du temps **publié** (par exemple après un changement de spécialités). Le choix des spécialités n'est jamais bloqué par l'emploi du temps : c'est l'emploi du temps qui s'adapte, on le régénère.
- Un enseignant a été remplacé après la publication.

## 9. Sécurité et robustesse
- Génération et publication ne peuvent pas s'exécuter en même temps (verrou PostgreSQL).
- L'API refuse de démarrer, avec le nom de la migration manquante, si la base n'est pas à jour.
- Les messages d'erreur de la base sont traduits en phrases lisibles ; aucun détail technique n'est exposé.

## 10. Limites actuelles ⚠️
- Les barrettes sont déduites des choix des élèves, l'école ne peut pas les définir.
- Pas de salles spéciales (laboratoire, gymnase, salle informatique) ni de capacité.
- Pas de vacances ni de jours fériés, pas de semaines A/B, pas d'options de collège (LV2, latin), pas de classes dédoublées, pas de créneaux d'examens.
- Pas de préférences par matière ou par enseignant (par exemple « pas de Maths l'après-midi »).
- Pas de bouton pour verrouiller un créneau déjà généré ; seuls les créneaux ajoutés à la main sont verrouillés.
- Au-delà d'environ 40 classes, la génération globale peut atteindre son délai de 40 secondes avant d'avoir trouvé le meilleur ordre.
- Primaire et maternelle : prévus (séances d'une période, plafonds) mais testés seulement par des essais artificiels.
- Avec trop peu d'enseignants, des heures restent non placées. Le générateur le signale, il ne peut pas inventer de professeurs.

## 11. Mise en place sur une base 🧱

> [!WARNING]
> À exécuter **dans cet ordre, une seule fois chacun** :
1. migrations `009`, `010`, `011`, `012` (dossier `database/migration`) ;
2. script `database/init/080_official_weekly_volumes.sql`.

Les migrations `001` à `012` ont été appliquées avec succès sur une base vide.

## 12. Tests
- `backend/tests/services/test_timetable_planner.py` : 20 tests de la logique du planificateur (sans base).
- `backend/tests/integration/test_timetable_database.py` : 8 tests sur la base de développement, qui ne laissent aucune trace (transaction annulée). À lancer avec :

```bash
docker exec -e RUN_DB_TESTS=1 -w /app container-backend python -m unittest tests.integration.test_timetable_database
```

- Une simulation d'échelle (14, 28 et 42 classes, enseignants à 18-20 h) a donné 0 heure non placée et aucun conflit ; elle porte sur le planificateur seul, pas sur la base.
