"""Règles métier de gestion des comptes prévues par l'US-002."""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.account import Account



def list_accounts(db: Session) -> list[Account]:
    """Retourne la liste des comptes du plus recent au plus ancien."""

    statement = (
        select(Account)
        .order_by(Account.created_at.desc())
    )
    
    return list(db.scalars(statement).all())