"""Contrôleur HTTP de gestion des comptes de l'US-002."""

from uuid import UUID

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.account_already_exists_error import (
    AccountAlreadyExistsError,
)
from app.core.invalid_admin_password_error import InvalidAdminPasswordError
from app.core.authentication import (
    CurrentAdminDependency,
    DatabaseSession,
)
from app.schemas.account_complete_create import AccountCompleteCreate
from app.schemas.account_response import AccountResponse
from app.schemas.account_profile_response import AccountProfileResponse
from app.schemas.account_password_reset import AccountPasswordReset
from app.services.account_service import (
    change_account_state,
    create_account_with_profile,
    get_account_with_profile_by_id,
    list_accounts,
    reset_account_password,
)
from app.models.account import Account
from app.services.profile_photo_service import MAX_PHOTO_SIZE, save_profile_photo


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
    status_code=status.HTTP_200_OK,
)
def get_accounts(
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> dict:
    """Retourne les comptes avec le total à un administrateur connecté."""

    result = list_accounts(db)
    items = [
        build_account_response(account=account, profile=profile)
        for account, profile in result["items"]
    ]
    return {"items": [item.model_dump() for item in items], "total": result["total"]}


@router.get(
    "/{account_id}",
    response_model=AccountResponse,
    status_code=status.HTTP_200_OK,
)
def get_account(
    account_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> AccountResponse:
    """Retourne un compte à partir de son identifiant."""

    result = get_account_with_profile_by_id(db=db, account_id=account_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compte introuvable.",
        )
    account, profile = result
    return build_account_response(account=account, profile=profile)


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


@router.post("/{account_id}/photo", response_model=AccountResponse)
async def post_account_photo(
    account_id: UUID,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
    photo: UploadFile = File(...),
) -> AccountResponse:
    """Téléverse une photo validée pour le profil associé au compte."""

    account = db.get(Account, account_id)
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compte introuvable.",
        )

    content = await photo.read(MAX_PHOTO_SIZE + 1)
    try:
        account, profile = save_profile_photo(
            db=db,
            account=account,
            content=content,
            content_type=photo.content_type,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(error),
        ) from error
    return build_account_response(account=account, profile=profile)


@router.post("/{account_id}/password", response_model=AccountResponse)
def post_account_password_reset(
    account_id: UUID,
    password_data: AccountPasswordReset,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> AccountResponse:
    """Réinitialise un mot de passe après confirmation de l'administrateur."""

    try:
        result = reset_account_password(
            db=db,
            account_id=account_id,
            new_password=password_data.new_password.get_secret_value(),
            admin_account=current_admin,
            admin_password=password_data.admin_password.get_secret_value(),
        )
    except InvalidAdminPasswordError as error:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Le mot de passe administrateur est incorrect.",
        ) from error

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compte introuvable.",
        )

    account, profile = result
    return build_account_response(account=account, profile=profile)


@router.post("/{account_id}/{action}", response_model=AccountResponse)
def post_account_state_action(
    account_id: UUID,
    action: str,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
) -> AccountResponse:
    """Applique une transition d'état autorisée à un compte."""

    if action not in {"deactivate", "archive", "activate"}:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Action de compte inconnue.",
        )

    result = change_account_state(db=db, account_id=account_id, action=action)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Compte introuvable.",
        )

    account, profile = result
    return build_account_response(account=account, profile=profile)
