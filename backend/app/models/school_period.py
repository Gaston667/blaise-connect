"""Modèle SQLAlchemy préparé pour les périodes de l'US-003."""

from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, ForeignKey, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class SchoolPeriod(Base):
    """Représente une période appartenant à une année scolaire."""

    __tablename__ = "reporting_periods"

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
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
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
