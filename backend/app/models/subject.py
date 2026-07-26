"""Modèle SQLAlchemy préparé pour les matières de l'US-005."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class Subject(Base):
    """Représente une matière enseignée dans l'établissement."""

    __tablename__ = "subjects"

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
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
