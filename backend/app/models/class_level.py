"""Modèle SQLAlchemy des niveaux scolaires."""
from datetime import datetime
from uuid import UUID
from sqlalchemy import Boolean, DateTime, SmallInteger, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.base import Base


class ClassLevel(Base):
    """Représente un niveau scolaire (ex: SIXIEME, TERMINALE)."""
    __tablename__ = "class_levels"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, server_default=text("gen_random_uuid()"))
    code: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    education_stage: Mapped[str] = mapped_column(String(30), nullable=False)
    display_order: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())