# 📚 Documentation BlaiseConnect

> [!TIP]
> Vous cherchez **ce qu'il reste à faire** ? → [Liste de tâches](projet/liste-de-taches-blaiseconnect.md).
> Vous avez **une idée** ? → [Idées](idee.md).
> Vous voulez comprendre **l'emploi du temps** ? → [Fonctionnement de l'emploi du temps](fonctionnel/fonctionnement-emploi-du-temps.md).

## 🗂️ Organisation

```text
docs/
├── README.md              ← ce sommaire
├── idee.md                ← idées à discuter (à deux)
├── projet/                ← pilotage du projet
├── fonctionnel/           ← comment l'application fonctionne, côté métier
├── technique/             ← architecture, sécurité, tests, déploiement
├── api/                   ← description des routes de l'API
├── diagramme/             ← diagrammes (PlantUML, SVG, Mermaid)
├── juridique/             ← guide juridique
└── presentation/          ← présentation des fonctionnalités
```

## 📌 Projet — `projet/`

| Document | Contenu |
|---|---|
| [Liste de tâches](projet/liste-de-taches-blaiseconnect.md) | Ce qui est fait, à valider, à faire (avec la date d'ajout). |
| [Product backlog](projet/product-backlog-blaiseconnect-v0.1.md) | Les besoins fonctionnels (user stories). |
| [Sprint planning](projet/sprint-planning-blaiseconnect-5-semaines.md) | Découpage du travail sur 5 semaines. |
| [Carnet de stage](projet/carnet-de-stage.md) | Journal d'avancement. |
| [Cahier des charges](projet/cahier-des-charges-premiere-version.pdf) | Première version du cahier des charges (PDF). |

## 🧭 Fonctionnel — `fonctionnel/`

| Document | Contenu |
|---|---|
| [Fonctionnement de l'emploi du temps](fonctionnel/fonctionnement-emploi-du-temps.md) | Configuration, génération, publication, cours particuliers, limites. |

## 🛠️ Technique — `technique/`

| Document | Contenu |
|---|---|
| [Architecture technique](technique/architecture-technique.md) | Vue d'ensemble de l'application. |
| [Cartographie des fichiers](technique/cartographie-rubriques-fichiers.md) | Où se trouve chaque rubrique dans le code. |
| [Sécurité de production](technique/securite-production.md) | Configuration et protections à appliquer en ligne. |
| [Tests automatisés](technique/tests-automatises.md) | Ce qui est testé, comment le lancer, ce qui reste manuel. |
| [Déploiement sur un VPS Ubuntu](technique/deploiement-vps-ubuntu-docker.md) | Mise en ligne avec Docker. |

## 🔌 Autres dossiers

| Dossier | Contenu |
|---|---|
| `api/` | Documentation des routes : [comptes](api/accounts.md), [évaluations](api/assessments.md), [assiduité](api/attendance.md). |
| `diagramme/` | Diagrammes de classes, de base de données, d'architecture MVC et d'agilité. |
| `juridique/` | [Guide juridique](juridique/guide-juridique-blaiseconnect.pdf). |
| `presentation/` | [Présentation des fonctionnalités](presentation/BlaiseConnect-presentation-fonctionnalites.pptx). |

> [!NOTE]
> Les règles du modèle de données destinées aux agents de développement sont dans [`AGENTS.md`](../AGENTS.md) (à la racine du dépôt).
