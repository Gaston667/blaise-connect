"""Stockage contrôlé des photos de profil."""

from pathlib import Path
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.administrator import Administrator
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.teacher import Teacher
from app.services.account_storage_service import get_account_photo_directory


PHOTO_PUBLIC_PREFIX = "/api/media/accounts"
MAX_PHOTO_SIZE = 5 * 1024 * 1024
PHOTO_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def photo_signature_is_valid(content: bytes, content_type: str) -> bool:
    """Vérifie que les premiers octets correspondent au format annoncé."""

    if content_type == "image/jpeg":
        return content.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/webp":
        return (
            len(content) >= 12
            and content.startswith(b"RIFF")
            and content[8:12] == b"WEBP"
        )
    return False


def save_profile_photo(
    db: Session,
    account: Account,
    content: bytes,
    content_type: str | None,
) -> tuple[Account, Student | Teacher | Administrator | Guardian]:
    """Valide, enregistre et rattache une photo au profil du compte."""

    extension = PHOTO_EXTENSIONS.get(content_type or "")
    if extension is None:
        raise ValueError("La photo doit être au format JPEG, PNG ou WebP.")
    if not content or len(content) > MAX_PHOTO_SIZE:
        raise ValueError("La photo doit avoir une taille maximale de 5 Mo.")
    if not photo_signature_is_valid(content, content_type or ""):
        raise ValueError("Le contenu du fichier ne correspond pas à une image valide.")

    profile_models = {
        "STUDENT": Student,
        "TEACHER": Teacher,
        "ADMIN": Administrator,
        "GUARDIAN": Guardian,
    }
    profile_model = profile_models[account.role]
    profile = db.execute(
        select(profile_model).where(profile_model.account_id == account.id)
    ).scalar_one_or_none()
    if profile is None:
        raise ValueError("Aucun profil n'est associé à ce compte.")

    photo_directory = get_account_photo_directory(account.registration_number)
    filename = f"{uuid4().hex}{extension}"
    destination = photo_directory / filename
    destination.write_bytes(content)

    previous_photo_path = profile.photo_path
    profile.photo_path = (
        f"{PHOTO_PUBLIC_PREFIX}/{account.registration_number}/photos/{filename}"
    )
    db.commit()
    db.refresh(account)
    db.refresh(profile)

    delete_previous_profile_photo(
        registration_number=account.registration_number,
        photo_path=previous_photo_path,
    )
    return account, profile


def delete_previous_profile_photo(
    registration_number: str,
    photo_path: str | None,
) -> None:
    """Supprime uniquement une ancienne photo gérée par l'application."""

    expected_prefix = f"{PHOTO_PUBLIC_PREFIX}/{registration_number}/photos/"
    if not photo_path or not photo_path.startswith(expected_prefix):
        return
    filename = Path(photo_path).name
    previous_file = get_account_photo_directory(registration_number) / filename
    if previous_file.is_file():
        previous_file.unlink()
