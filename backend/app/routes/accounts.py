"""Contrôleur HTTP de gestion des comptes de l'US-002."""

from fastapi import APIRouter, HTTPException, status

from app.core.account_already_exists_error import (
    AccountAlreadyExistsError,
)
from app.core.authentication import (
    CurrentAdminDependency,
    DatabaseSession,
)
from app.schemas.account_create import AccountCreate
from app.schemas.account_response import AccountResponse
from app.services.account_service import create_account, list_accounts


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


@router.post(
    "",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_account(
    account_data: AccountCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> AccountResponse:
    """Crée un compte administrateur ou enseignant."""

    try:
        account = create_account(
            db=db,
            account_data=account_data,
        )
    except AccountAlreadyExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte utilise déjà ce matricule.",
        ) from error

    return AccountResponse.model_validate(account)
