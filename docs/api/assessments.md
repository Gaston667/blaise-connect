# API des évaluations et notes

- `GET/POST /assessments` : liste indépendante des notes et création autorisée.
- `GET /assessments/summary` : indicateurs calculés par le backend.
- `GET /assessments/assignment-options` : affectations permises pour l’acteur.
- `GET/PATCH /assessments/{id}` : détail et modification contrôlée.
- `GET/POST /assessments/{id}/grade-sheet` : feuille de tous les inscrits et saisie atomique.
- `GET/POST /grade-change-requests` : consultation et demande de correction.
- `PATCH /grade-change-requests/{id}/decision` : décision sans auto-validation.
- `GET/POST /grades/{id}/documents` : justificatifs d’absence.
- `GET /grades/{id}/documents/{document_id}/content` : téléchargement authentifié.
- `PATCH /grades/{id}/absence-review` : validation ou rejet administratif.

Les notes sont normalisées sur 20 côté backend. Une absence justifiée ou en attente est exclue ; une absence non justifiée ou rejetée vaut zéro pendant le calcul. L’arrondi définitif reste à valider : l’interface limite seulement l’affichage à deux décimales.
