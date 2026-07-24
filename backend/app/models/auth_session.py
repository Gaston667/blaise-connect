"""Modèle SQLAlchemy représentant une session d'authentification."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class AuthSession(Base):
    """Session ouverte après la connexion d'un utilisateur."""

    __tablename__ = "auth_sessions"

    __table_args__ = (
        UniqueConstraint(
            "session_token_hash",
            name="uq_auth_sessions_token_hash",
        ),
        CheckConstraint(
            "session_token_hash ~ '^[0-9a-f]{64}$'",
            name="ck_auth_sessions_token_hash",
        ),
        CheckConstraint(
            "last_activity_at >= created_at",
            name="ck_auth_sessions_last_activity",
        ),
        CheckConstraint(
            "revoked_at IS NULL OR revoked_at >= created_at",
            name="ck_auth_sessions_revoked_at",
        ),
        Index(
            "idx_auth_sessions_account_id",
            "account_id",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )

    account_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey(
            "accounts.id",
            name="fk_auth_sessions_account",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    session_token_hash: Mapped[str] = mapped_column(
        CHAR(64),
        nullable=False,
    )

    last_activity_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
