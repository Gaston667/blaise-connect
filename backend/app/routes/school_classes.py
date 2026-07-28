"""Contrôleur FastAPI préparé pour l'US-004, non activé."""

from fastapi import APIRouter
from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.school_class_response import SchoolClassResponse
from app.services.school_class_service import list_school_classes
from fastapi import status


router = APIRouter(
    prefix="/school-classes",
    tags=["school-classes"],
)


@router.get("", response_model=list[SchoolClassResponse], status_code=status.HTTP_200_OK)
def get_school_classes(db: DatabaseSession, current_admin: CurrentAdminDependency):
    classes = list_school_classes(db)
    return [SchoolClassResponse.model_validate(c) for c in classes]


# Routes prévues : création, modification, composition et archivage.
