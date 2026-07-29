"""Contrôleur HTTP de gestion des comptes de l'US-002."""

from fastapi import APIRouter, HTTPException, status

from app.core.account_already_exists_error import (
    AccountAlreadyExistsError,
)
from app.core.authentication import (
    CurrentAdminDependency,
    DatabaseSession,
)
from app.schemas.account_complete_create import AccountCompleteCreate
from app.schemas.account_response import AccountResponse
from app.schemas.account_profile_response import AccountProfileResponse
from app.services.account_service import create_account_with_profile, list_accounts


router = APIRouter(
    prefix="/accounts",
    tags=["accounts"],
)


def build_account_response(account, profile) -> AccountResponse:
    """Construit la réponse sans exposer le hash ni les données sensibles."""

    account_data = {
        "id": account.id,
        "registration_number": account.registration_number,
        "role": account.role,
        "is_active": account.is_active,
        "failed_login_attempts": account.failed_login_attempts,
        "locked_until": account.locked_until,
        "last_login_at": account.last_login_at,
        "archived_at": account.archived_at,
        "created_at": account.created_at,
        "updated_at": account.updated_at,
        "profile": (
            AccountProfileResponse.model_validate(profile)
            if profile is not None
            else None
        ),
    }
    return AccountResponse.model_validate(account_data)


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

    account_records = list_accounts(db)

    return [
        build_account_response(account=account, profile=profile)
        for account, profile in account_records
    ]


@router.post(
    "",
    response_model=AccountResponse,
    status_code=status.HTTP_201_CREATED,
)
def post_account(
    account_data: AccountCompleteCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> AccountResponse:
    """Crée un compte pour l'un des quatre rôles de BlaiseConnect."""

    try:
        account, profile = create_account_with_profile(
            db=db,
            creation_data=account_data,
        )
    except AccountAlreadyExistsError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Un compte utilise déjà ce matricule.",
        ) from error

    return build_account_response(account=account, profile=profile)
