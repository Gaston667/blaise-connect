"""Contrôleur HTTP de connexion, déconnexion et consultation de session."""

from datetime import UTC, datetime

from fastapi import (
    APIRouter,
    HTTPException,
    Response,
    status,
)

from app.core.account_locked_error import AccountLockedError
from app.core.authentication import (
    CurrentAccountDependency,
    DatabaseSession,
    SessionTokenCookie,
)
from app.core.session_cookie_config import (
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_SECURE,
)
from app.schemas.current_account_response import CurrentAccountResponse
from app.schemas.login_request import LoginRequest
from app.schemas.login_response import LoginResponse
from app.services.auth_service import authenticate_account, get_account_full_name
from app.services.session_service import create_session, revoke_session


router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)


@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
)
def login(
    login_data: LoginRequest,
    response: Response,
    db: DatabaseSession,
) -> LoginResponse:
    """Authentifie un utilisateur et ouvre une session sécurisée."""

    try:
        account = authenticate_account(
            db=db,
            registration_number=login_data.registration_number,
            password=login_data.password.get_secret_value(),
        )
    except AccountLockedError as error:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Votre compte est temporairement bloqué.",
        ) from error

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Matricule ou mot de passe incorrect.",
        )

    account.last_login_at = datetime.now(UTC)

    session_token = create_session(
        db=db,
        account_id=account.id,
    )

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )

    first_name, last_name = get_account_full_name(db=db, account=account)
    account_response = CurrentAccountResponse(
        **{
            **CurrentAccountResponse.model_validate(account).model_dump(),
            "first_name": first_name,
            "last_name": last_name,
        }
    )

    return LoginResponse(
        message="Connexion réussie.",
        account=account_response,
    )


@router.get(
    "/me",
    response_model=CurrentAccountResponse,
    status_code=status.HTTP_200_OK,
)
def get_current_account_information(
    db: DatabaseSession,
    current_account: CurrentAccountDependency,
) -> CurrentAccountResponse:
    """Retourne les informations du compte actuellement connecté."""

    first_name, last_name = get_account_full_name(db=db, account=current_account)
    return CurrentAccountResponse(
        **{
            **CurrentAccountResponse.model_validate(current_account).model_dump(),
            "first_name": first_name,
            "last_name": last_name,
        }
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
def logout(
    response: Response,
    db: DatabaseSession,
    session_token: SessionTokenCookie = None,
) -> None:
    """Révoque la session et supprime le cookie du navigateur."""

    if session_token is not None:
        revoke_session(
            db=db,
            session_token=session_token,
        )

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=SESSION_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )
