"""Règles métier de gestion des comptes prévues par l'US-002."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.account_already_exists_error import (
    AccountAlreadyExistsError,
)
from app.core.security import hash_password
from app.models.account import Account
from app.schemas.account_create import AccountCreate


def list_accounts(db: Session) -> list[Account]:
    """Retourne la liste des comptes du plus récent au plus ancien."""

    statement = (
        select(Account)
        .order_by(Account.created_at.desc())
    )

    return list(db.scalars(statement).all())


def find_account_by_registration_number(
    db: Session,
    registration_number: str,
) -> Account | None:
    """Recherche un compte à partir de son matricule."""

    statement = (
        select(Account)
        .where(Account.registration_number == registration_number)
    )

    return db.scalar(statement)


def create_account(
    db: Session,
    account_data: AccountCreate,
) -> Account:
    """Crée un compte après validation et hachage du mot de passe."""

    existing_account = find_account_by_registration_number(
        db=db,
        registration_number=account_data.registration_number,
    )

    if existing_account is not None:
        raise AccountAlreadyExistsError(
            account_data.registration_number
        )

    clear_password = account_data.password.get_secret_value()
    password_hash = hash_password(clear_password)

    account = Account(
        registration_number=account_data.registration_number,
        password_hash=password_hash,
        role=account_data.role,
    )

    db.add(account)
    db.commit()
    db.refresh(account)

    return account
