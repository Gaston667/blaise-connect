"""Organisation des fichiers privés associés aux comptes."""

from pathlib import Path


ACCOUNT_STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage" / "accounts"
ACCOUNT_STORAGE_CATEGORIES = ("photos", "justificatifs", "bulletins")


def create_account_storage_directories(registration_number: str) -> Path:
    """Crée l'arborescence documentaire stable d'un compte."""

    account_directory = ACCOUNT_STORAGE_ROOT / registration_number
    for category in ACCOUNT_STORAGE_CATEGORIES:
        (account_directory / category).mkdir(parents=True, exist_ok=True)
    return account_directory


def get_account_photo_directory(registration_number: str) -> Path:
    """Retourne le dossier photo après avoir créé l'arborescence du compte."""

    return create_account_storage_directories(registration_number) / "photos"
