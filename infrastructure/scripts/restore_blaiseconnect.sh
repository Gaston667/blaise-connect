#!/usr/bin/env bash

# Arrête le script dès qu'une commande échoue.
set -Eeuo pipefail

# Dossiers principaux.
project_directory="/opt/blaiseconnect"
backup_root="/opt/blaiseconnect-backups"
storage_volume="blaiseconnect_account_storage"

# Vérifie les paramètres fournis :
# database <fichier.dump>
# storage  <fichier.tar.gz>
# all      <fichier.dump> <fichier.tar.gz>
restore_mode="${1:-}"
database_backup_file="${2:-}"
storage_backup_file="${3:-}"

show_usage() {
    echo "Utilisation :"
    echo "  $0 database /chemin/vers/postgres_xxx.dump"
    echo "  $0 storage  /chemin/vers/account_storage_xxx.tar.gz"
    echo "  $0 all      /chemin/vers/postgres_xxx.dump /chemin/vers/account_storage_xxx.tar.gz"
}

restore_database() {
    # PostgreSQL reste la source de vérité : le script ne compare aucun rôle
    # avant la restauration. Toute erreur de rôle est lue dans pg_restore.
    local restore_error_file

    restore_error_file="$(mktemp)"

    if ! docker compose --project-directory "${project_directory}" exec -T postgres \
        sh -c 'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
        < "${database_backup_file}" 2> "${restore_error_file}"; then
        echo "[ERREUR] La restauration PostgreSQL a échoué."

        if grep -qiE 'role ".+" does not exist' "${restore_error_file}"; then
            echo "[ERREUR] Un rôle PostgreSQL exigé par la sauvegarde n'existe pas dans cette base."
            grep -iE 'role ".+" does not exist' "${restore_error_file}"
        else
            cat "${restore_error_file}"
        fi

        rm -f "${restore_error_file}"
        return 1
    fi

    rm -f "${restore_error_file}"
}

# Vérifie que le mode est correct.
if [[ "${restore_mode}" != "database" &&
      "${restore_mode}" != "storage" &&
      "${restore_mode}" != "all" ]]; then
    show_usage
    exit 1
fi

# Vérifie les fichiers nécessaires selon le mode choisi.
if [[ "${restore_mode}" == "database" || "${restore_mode}" == "all" ]]; then
    if [[ ! -f "${database_backup_file}" ]]; then
        echo "[ERREUR] Sauvegarde PostgreSQL introuvable : ${database_backup_file}"
        exit 1
    fi
fi

if [[ "${restore_mode}" == "storage" ]]; then
    storage_backup_file="${database_backup_file}"

    if [[ ! -f "${storage_backup_file}" ]]; then
        echo "[ERREUR] Archive des documents introuvable : ${storage_backup_file}"
        exit 1
    fi
fi

if [[ "${restore_mode}" == "all" ]]; then
    if [[ ! -f "${storage_backup_file}" ]]; then
        echo "[ERREUR] Archive des documents introuvable : ${storage_backup_file}"
        exit 1
    fi
fi

# Vérifie l'existence du volume Docker contenant les documents.
if [[ "${restore_mode}" == "storage" || "${restore_mode}" == "all" ]]; then
    if ! docker volume inspect "${storage_volume}" > /dev/null 2>&1; then
        echo "[ERREUR] Volume Docker introuvable : ${storage_volume}"
        exit 1
    fi
fi

echo
echo "ATTENTION : la restauration remplacera les données actuelles."

if [[ "${restore_mode}" == "database" ]]; then
    echo "Élément restauré : base de données PostgreSQL"
fi

if [[ "${restore_mode}" == "storage" ]]; then
    echo "Élément restauré : documents privés"
fi

if [[ "${restore_mode}" == "all" ]]; then
    echo "Éléments restaurés : base de données ET documents privés"
fi

echo
read -r -p "Tape exactement RESTAURER pour continuer : " confirmation

if [[ "${confirmation}" != "RESTAURER" ]]; then
    echo "[INFO] Restauration annulée."
    exit 0
fi

# On arrête le backend afin qu'aucune écriture ne survienne pendant la restauration.
docker compose --project-directory "${project_directory}" stop backend

# Restauration de PostgreSQL.
if [[ "${restore_mode}" == "database" || "${restore_mode}" == "all" ]]; then
    echo "[INFO] Restauration de la base PostgreSQL..."

    restore_database

    echo "[INFO] Base PostgreSQL restaurée."
fi

# Restauration des photos, documents, justificatifs et bulletins.
if [[ "${restore_mode}" == "storage" || "${restore_mode}" == "all" ]]; then
    echo "[INFO] Restauration des documents..."

    docker run --rm \
        -v "${storage_volume}:/target" \
        -v "$(dirname "${storage_backup_file}"):/backup:ro" \
        alpine:3.20 \
        sh -c "
            find /target -mindepth 1 -maxdepth 1 -exec rm -rf -- {} + &&
            tar -xzf /backup/$(basename "${storage_backup_file}") -C /target
        "

    echo "[INFO] Documents restaurés."
fi

# Redémarre l'API après la restauration.
docker compose --project-directory "${project_directory}" start backend

echo "[INFO] Restauration terminée avec succès."
