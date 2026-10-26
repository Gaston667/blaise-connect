"""Organisation des fichiers privés associés aux comptes."""

from pathlib import Path


ACCOUNT_STORAGE_ROOT = Path(__file__).resolve().parents[2] / "storage" / "accounts"
ACCOUNT_STORAGE_CATEGORIES = (
    "photos",
    "documents",
    "justificatifs",
)
STUDENT_STORAGE_CATEGORIES = ("bulletins",)


def create_account_storage_directories(
    registration_number: str,
    is_student: bool = False,
) -> Path:
    """Crée l'arborescence documentaire stable d'un compte."""

    account_directory = ACCOUNT_STORAGE_ROOT / registration_number
    categories = ACCOUNT_STORAGE_CATEGORIES
    if is_student:
        categories += STUDENT_STORAGE_CATEGORIES
    for category in categories:
        (account_directory / category).mkdir(parents=True, exist_ok=True)
    return account_directory


def get_account_photo_directory(registration_number: str) -> Path:
    """Retourne le dossier photo après avoir créé l'arborescence du compte."""

    return create_account_storage_directories(registration_number) / "photos"


def get_account_document_directory(registration_number: str) -> Path:
    """Retourne le dossier des documents généraux du compte."""

    return create_account_storage_directories(registration_number) / "documents"


def get_account_justification_directory(registration_number: str) -> Path:
    """Retourne le dossier prive des justificatifs du compte."""

    return create_account_storage_directories(registration_number) / "justificatifs"
