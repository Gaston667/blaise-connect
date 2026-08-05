"""Contrôle de la session et récupération du compte connecté."""

from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.session_cookie_config import SESSION_COOKIE_NAME
from app.models.account import Account
from app.services.auth_service import ALLOWED_AUTHENTICATION_ROLES
from app.services.session_service import revoke_session, validate_session


DatabaseSession = Annotated[
    Session,
    Depends(get_db),
]

SessionTokenCookie = Annotated[
    str | None,
    Cookie(alias=SESSION_COOKIE_NAME),
]


def get_current_account(
    db: DatabaseSession,
    session_token: SessionTokenCookie = None,
) -> Account:
    """Vérifie la session et retourne le compte connecté."""

    if session_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Vous devez vous connecter.",
        )

    auth_session = validate_session(
        db=db,
        session_token=session_token,
    )

    if auth_session is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Votre session est invalide ou expirée.",
        )

    account = db.get(Account, auth_session.account_id)

    account_is_forbidden = (
        account is None
        or not account.is_active
        or account.archived_at is not None
        or account.role not in ALLOWED_AUTHENTICATION_ROLES
    )

    if account_is_forbidden:
        revoke_session(
            db=db,
            session_token=session_token,
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Votre compte ne peut plus accéder à l'application.",
        )

    return account


CurrentAccountDependency = Annotated[
    Account,
    Depends(get_current_account),
]


def require_admin_account(
    current_account: CurrentAccountDependency,
) -> Account:
    """Autorise uniquement un compte administrateur à accéder à la ressource."""

    if current_account.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour accéder à cette ressource.",
        )

    return current_account

CurrentAdminDependency = Annotated[
    Account,
    Depends(require_admin_account),
]


def require_staff_account(
    current_account: CurrentAccountDependency,
) -> Account:
    """Autorise le personnel de l'établissement (administrateur ou enseignant)
    à accéder à une ressource en lecture."""

    if current_account.role not in ("ADMIN", "TEACHER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour accéder à cette ressource.",
        )

    return current_account

CurrentStaffDependency = Annotated[
    Account,
    Depends(require_staff_account),
]


