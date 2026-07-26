"""Modèle SQLAlchemy préparé pour les classes de l'US-004."""

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class SchoolClass(Base):
    """Représente une classe rattachée à une année scolaire."""

    __tablename__ = "school_classes"

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    school_year_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("school_years.id"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    level: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default=text("true"),
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
