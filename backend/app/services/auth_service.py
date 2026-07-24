"""Règles métier de l'authentification prévues par l'US-001."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.account_locked_error import AccountLockedError
from app.core.security import DUMMY_PASSWORD_HASH, verify_password
from app.models.account import Account


ALLOWED_AUTHENTICATION_ROLES = ("ADMIN", "TEACHER")
MAX_FAILED_LOGIN_ATTEMPTS = 5
ACCOUNT_LOCK_DURATION = timedelta(minutes=5)


def get_account_by_registration_number(
    db: Session,
    registration_number: str,
) -> Account | None:
    """Recherche un compte avec son matricule."""

    statement = (
        select(Account)
        .where(Account.registration_number == registration_number)
        .with_for_update()
    )

    return db.scalar(statement)


def register_failed_login(
    db: Session,
    account: Account,
    current_time: datetime,
) -> None:
    """Enregistre un échec et verrouille le compte au cinquième essai."""

    account.failed_login_attempts += 1

    if account.failed_login_attempts >= MAX_FAILED_LOGIN_ATTEMPTS:
        account.locked_until = current_time + ACCOUNT_LOCK_DURATION

    db.commit()

    if account.locked_until is not None:
        raise AccountLockedError(account.locked_until)


def reset_failed_login_state(
    db: Session,
    account: Account,
) -> None:
    """Réinitialise les échecs après une authentification réussie."""

    if account.failed_login_attempts == 0 and account.locked_until is None:
        return

    account.failed_login_attempts = 0
    account.locked_until = None
    db.commit()


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

    current_time = datetime.now(UTC)

    if account.locked_until is not None:
        if account.locked_until > current_time:
            raise AccountLockedError(account.locked_until)

        # Un verrouillage arrivé à expiration ouvre un nouveau cycle d'essais.
        account.failed_login_attempts = 0
        account.locked_until = None
        db.commit()

    password_is_valid = verify_password(
        password,
        account.password_hash,
    )

    if not password_is_valid:
        register_failed_login(
            db=db,
            account=account,
            current_time=current_time,
        )
        return None

    if not account.is_active:
        return None

    if account.archived_at is not None:
        return None

    if account.role not in ALLOWED_AUTHENTICATION_ROLES:
        return None

    reset_failed_login_state(
        db=db,
        account=account,
    )

    return account
