"""Modèle SQLAlchemy de la table PostgreSQL accounts."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, SmallInteger, String, Text, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class Account(Base):
    """Représente un compte permettant de s'authentifier à BlaiseConnect."""

    __tablename__ = "accounts"

    # Identifiant technique généré automatiquement par PostgreSQL.
    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    # Identifiant saisi par l'utilisateur au moment de la connexion.
    registration_number: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
    )

    # Contient uniquement le mot de passe haché, jamais le mot de passe en clair.
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)

    # La V1 autorisera ADMIN et TEACHER dans la logique métier.
    role: Mapped[str] = mapped_column(String(20), nullable=False)

    # Un compte inactif ne doit pas pouvoir se connecter.
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
    )

    # Ces deux attributs servent au verrouillage après plusieurs échecs.
    failed_login_attempts: Mapped[int] = mapped_column(
        SmallInteger,
        nullable=False,
        server_default=text("0"),
    )
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Horodatages de connexion, d'archivage et d'audit déjà présents en base.
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
