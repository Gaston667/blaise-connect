#!/usr/bin/env bash

# Arrête le script dès qu'une commande échoue, qu'une variable manque
# ou qu'une erreur survient dans une commande enchaînée.
set -Eeuo pipefail

# Empêche que les fichiers de sauvegarde soient accessibles à tous.
umask 077

# Dossier du projet Docker Compose.
project_directory="/opt/blaiseconnect"


# Dossier externe au projet : les sauvegardes ne sont pas dans Git.
backup_root="/opt/blaiseconnect-backups"
database_backup_directory="${backup_root}/database"
storage_backup_directory="${backup_root}/storage"

# Nombre de jours pendant lesquels les sauvegardes sont conservées.
# Les sauvegardes plus anciennes seront supprimées automatiquement.
retention_days=14

# Nom réel du volume Docker contenant photos, documents et bulletins.
storage_volume="blaiseconnect_account_storage"

# Date utilisée dans les noms de fichiers.
backup_date="$(date '+%Y-%m-%d_%H%M%S')"


# Noms des deux sauvegardes.
database_filename="postgres_${backup_date}.dump"
storage_filename="account_storage_${backup_date}.tar.gz"

# Création des dossiers de destination s'ils n'existent pas.
mkdir -p "${database_backup_directory}"
mkdir -p "${storage_backup_directory}"


# Vérifie que le volume de documents existe avant de commencer.
if ! docker volume inspect "${storage_volume}" > /dev/null 2>&1; then
    echo "[ERREUR] Le volume Docker ${storage_volume} est introuvable."
    exit 1
fi


echo "[INFO] Début de la sauvegarde : ${backup_date}"

# Sauvegarde complète PostgreSQL au format personnalisé PostgreSQL.
# Le mot de passe n'est pas affiché : pg_dump s'exécute dans le conteneur.
docker compose --project-directory "${project_directory}" exec -T postgres \
    sh -c 'exec pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' \
    > "${database_backup_directory}/${database_filename}"

# Génère une empreinte pour détecter une sauvegarde base corrompue.
sha256sum "${database_backup_directory}/${database_filename}" \
    > "${database_backup_directory}/${database_filename}.sha256"

echo "[INFO] Base PostgreSQL sauvegardée."


# Archive le volume privé des comptes :
# photos, documents, justificatifs et bulletins.
docker run --rm \
    -v "${storage_volume}:/source:ro" \
    -v "${storage_backup_directory}:/backup" \
    alpine:3.20 \
    tar -czf "/backup/${storage_filename}" -C /source .

    # Génère une empreinte pour l'archive des documents.
sha256sum "${storage_backup_directory}/${storage_filename}" \
    > "${storage_backup_directory}/${storage_filename}.sha256"

echo "[INFO] Documents sauvegardés."


# Supprime uniquement les anciennes sauvegardes du dossier database.
find "${database_backup_directory}" \
    -maxdepth 1 \
    -type f \
    -mtime +"${retention_days}" \
    -delete

# Supprime uniquement les anciennes sauvegardes du dossier storage.
find "${storage_backup_directory}" \
    -maxdepth 1 \
    -type f \
    -mtime +"${retention_days}" \
    -delete

echo "[INFO] Sauvegarde terminée avec succès."