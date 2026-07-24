"""Classe de base commune aux modèles SQLAlchemy."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Permet à SQLAlchemy d'enregistrer les modèles de BlaiseConnect."""
