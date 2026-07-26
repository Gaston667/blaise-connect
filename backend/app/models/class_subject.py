"""Modèle SQLAlchemy préparé pour l'association classe-matière."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Numeric, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.base import Base


class ClassSubject(Base):
    """Associe une matière, une classe et son coefficient."""

    __tablename__ = "class_subjects"

    id: Mapped[UUID] = mapped_column(
        Uuid,
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    school_class_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("school_classes.id"),
        nullable=False,
    )
    subject_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("subjects.id"),
        nullable=False,
    )
    coefficient: Mapped[Decimal] = mapped_column(
        Numeric(6, 2),
        nullable=False,
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
