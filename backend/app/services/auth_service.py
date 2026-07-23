"""Règles métier de l'authentification prévues par l'US-001."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.account_locked_error import AccountLockedError
from app.core.security import DUMMY_PASSWORD_HASH, verify_password
from app.models.account import Account


ALLOWED_AUTHENTICATION_ROLES = ("ADMIN", "TEACHER")


def get_account_by_registration_number(
    db: Session,
    registration_number: str,
) -> Account | None:
    """Recherche un compte avec son matricule."""

    statement = select(Account).where(
        Account.registration_number == registration_number
    )

    return db.scalar(statement)


def authenticate_account(
    db: Session,
    registration_number: str,
    password: str,
) -> Account | None:
    """Authentifie un compte autorisé dans la Version 1."""

    account = get_account_by_registration_number(
        db,
        registration_number,
    )

    if account is None:
        verify_password(password, DUMMY_PASSWORD_HASH)
        return None

    password_is_valid = verify_password(
        password,
        account.password_hash,
    )

    if not password_is_valid:
        return None

    if not account.is_active:
        return None
    
    if account.archived_at is not None:
        return None

    if account.role not in ALLOWED_AUTHENTICATION_ROLES:
        return None

    current_time = datetime.now(UTC)

    if account.locked_until is not None and account.locked_until > current_time:
        raise AccountLockedError(account.locked_until)

    return account
