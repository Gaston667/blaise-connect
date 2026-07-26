"""Modèle SQLAlchemy préparé pour les années scolaires de l'US-003."""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class SchoolYear(Base):
    """Représente une année scolaire délimitée par deux dates."""

    __tablename__ = "school_years"

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
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
