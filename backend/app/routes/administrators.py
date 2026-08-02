"""Routes HTTP pour consulter les administrateurs."""
from fastapi import APIRouter, Query

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.administrator_overview import AdministratorOverview
from app.services.administrator_service import list_administrators_overview

router = APIRouter(prefix="/administrators", tags=["administrators"])


@router.get("/overview", response_model=list[AdministratorOverview])
def get_administrators_overview(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    q: str | None = Query(None),
):
    """Vue enrichie des administrateurs : matricule, fonction, statut."""
    return list_administrators_overview(db=db, q=q)
