"""Routes HTTP pour consulter et modifier les administrateurs."""
from fastapi import APIRouter, HTTPException, Query

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.administrator_overview import AdministratorOverview
from app.schemas.administrator_update import AdministratorUpdate
from app.services.administrator_service import (
    get_administrator_overview,
    list_administrators_overview,
    update_administrator,
)

router = APIRouter(prefix="/administrators", tags=["administrators"])


@router.get("/overview", response_model=list[AdministratorOverview])
def get_administrators_overview(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    q: str | None = Query(None),
):
    """Vue enrichie des administrateurs : matricule, fonction, statut."""
    return list_administrators_overview(db=db, q=q)


@router.patch("/{administrator_id}", response_model=AdministratorOverview)
def patch_administrator(
    administrator_id: str,
    data: AdministratorUpdate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Modifie les coordonnées et le rôle d'un administrateur."""
    administrator = update_administrator(db=db, administrator_id=administrator_id, data=data)
    if administrator is None:
        raise HTTPException(status_code=404, detail="Administrateur introuvable.")
    return get_administrator_overview(db=db, administrator_id=administrator_id)
