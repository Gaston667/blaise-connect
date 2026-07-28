"""Modèle SQLAlchemy du profil étudiant."""

from datetime import date, datetime
from uuid import UUID
from sqlalchemy import Date, DateTime, ForeignKey, String, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import ENUM as PgEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class Student(Base):
    """Représente le dossier métier d'un élève."""

    __tablename__ = "students"

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    account_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("accounts.id"),
        nullable=False,
        unique=True,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    admission_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        PgEnum("ACTIVE", "INACTIVE", "ARCHIVED", name="student_status_enum", create_type=False),
        nullable=False,
        server_default=text("'ACTIVE'"),
    )
    photo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    birth_place: Mapped[str | None] = mapped_column(String(150), nullable=True)
    nationality: Mapped[str | None] = mapped_column(String(100), nullable=True)
    previous_level: Mapped[str | None] = mapped_column(String(100), nullable=True)
    observations: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by_account_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("accounts.id"), nullable=True
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
