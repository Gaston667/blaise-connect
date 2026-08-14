# API d’assiduité

La rubrique `/attendance` sépare les droits par rôle.

- ADMIN : consulte tous les incidents, effectue un appel, corrige ou supprime logiquement un incident, traite les justificatifs et les signalements.
- TEACHER : effectue l’appel uniquement pour ses affectations, consulte ses appels et signale une correction.
- STUDENT : consulte uniquement ses absences et retards, puis transmet un justificatif privé.

La présence est implicite : `attendance_records` ne stocke que `ABSENT` ou `LATE`. Les corrections appliquées sont copiées dans `attendance_record_history`. Les fichiers restent hors PostgreSQL et sont reliés par `attendance_record_documents`.

Routes principales :

- `GET /attendance/options` et `GET /attendance/roster` ;
- `POST/GET /attendance/events` ;
- `GET/PATCH /attendance/records` ;
- `POST /attendance/records/{id}/change-requests` ;
- `GET/PATCH /attendance/change-requests` ;
- `PATCH /attendance/records/{id}/justification` ;
- `GET /attendance/me` et `POST /attendance/me/{id}/justification`.

La migration `database/migration/005_academic_activity.sql` doit être appliquée avant d’utiliser ces routes.
