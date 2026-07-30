"""Lecture authentifiée des fichiers associés aux comptes."""

from pathlib import Path

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.core.authentication import CurrentAdminDependency
from app.services.account_storage_service import ACCOUNT_STORAGE_ROOT


DEFAULT_PHOTO = Path(__file__).resolve().parent.parent / "assets" / "default_photo.png"

router = APIRouter(
    prefix="/media/accounts",
    tags=["account-files"],
)


@router.get("/{registration_number}/photos/{filename}")
def get_account_photo(
    registration_number: str,
    filename: str,
    current_admin: CurrentAdminDependency,
) -> FileResponse:
    """Retourne une photo sans exposer les autres documents du compte.
    
    Si le fichier est absent du stockage, retourne la photo par défaut.
    """

    if Path(registration_number).name != registration_number:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if Path(filename).name != filename:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    photo_file = ACCOUNT_STORAGE_ROOT / registration_number / "photos" / filename
    if photo_file.is_file():
        return FileResponse(photo_file)
    return FileResponse(DEFAULT_PHOTO, media_type="image/png")


@router.get("/default-photo")
def get_default_photo() -> FileResponse:
    """Retourne la photo de profil par défaut (aucune authentification requise)."""
    return FileResponse(DEFAULT_PHOTO, media_type="image/png")
