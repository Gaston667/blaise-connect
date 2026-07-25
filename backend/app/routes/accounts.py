"""Contrôleur HTTP de gestion des comptes de l'US-002."""

from fastapi import APIRouter, status

from app.core.authentication import (
    CurrentAdminDependency,
    DatabaseSession,
)
from app.schemas.account_response import AccountResponse
from app.services.account_service import list_accounts


router = APIRouter(
    prefix="/accounts",
    tags=["accounts"],
)


@router.get(
    "",
    response_model=list[AccountResponse],
    status_code=status.HTTP_200_OK,
)

def get_accounts(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> list[AccountResponse]:
    """Retourne les comptes à un administrateur connecté."""

    accounts = list_accounts(db)

    return [
        AccountResponse.model_validate(account)
        for account in accounts
    ]