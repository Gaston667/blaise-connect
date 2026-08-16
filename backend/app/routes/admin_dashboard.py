"""Route HTTP du tableau de bord administrateur."""

from fastapi import APIRouter

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.admin_dashboard_response import AdminDashboardResponse
from app.services.admin_dashboard_service import get_admin_dashboard

router = APIRouter(prefix="/admin-dashboard", tags=["admin-dashboard"])


@router.get("", response_model=AdminDashboardResponse)
def get_admin_dashboard_route(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> AdminDashboardResponse:
    """Retourne les indicateurs agrégés du tableau de bord administrateur."""
    return get_admin_dashboard(db=db)
