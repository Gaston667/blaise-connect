"""Routes HTTP pour consulter les niveaux scolaires."""
from fastapi import APIRouter
from sqlalchemy import select

from app.core.authentication import CurrentStaffDependency, DatabaseSession
from app.models.class_level import ClassLevel
from app.schemas.class_level_response import ClassLevelResponse

router = APIRouter(prefix="/class-levels", tags=["class-levels"])


@router.get("", response_model=list[ClassLevelResponse])
def get_class_levels(db: DatabaseSession, current_staff: CurrentStaffDependency):
    """Liste les niveaux scolaires, triés par ordre d'affichage."""
    statement = select(ClassLevel).order_by(ClassLevel.display_order)
    return list(db.scalars(statement).all())