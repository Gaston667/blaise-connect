"""Modèle SQLAlchemy des classes annuelles de l'US-004."""

from datetime import datetime
from uuid import UUID
from sqlalchemy import DateTime, ForeignKey, SmallInteger, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class SchoolClass(Base):
    """Représente un niveau et un groupe pour une année scolaire donnée.

    Une classe ne possède pas de statut ni d'archivage propre : son cycle de
    vie dépend de l'année scolaire à laquelle elle appartient.
    """

    __tablename__ = "classes"

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    school_year_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("school_years.id", ondelete="RESTRICT"),
        nullable=False,
    )
    class_level_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("class_levels.id", ondelete="RESTRICT"),
        nullable=False,
    )
    main_teacher_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("teachers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    group_label: Mapped[str] = mapped_column(String(30), nullable=False)
    capacity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
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
