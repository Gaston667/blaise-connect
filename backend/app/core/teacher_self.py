"""Résout le profil enseignant associé au compte TEACHER connecté."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select

from app.core.authentication import CurrentAccountDependency, DatabaseSession
from app.models.teacher import Teacher


def get_current_teacher(
    current_account: CurrentAccountDependency,
    db: DatabaseSession,
) -> Teacher:
    """Autorise uniquement un compte enseignant et retourne son dossier."""

    if current_account.role != "TEACHER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé aux enseignants.",
        )

    teacher = db.execute(
        select(Teacher).where(Teacher.account_id == current_account.id)
    ).scalar_one_or_none()

    if teacher is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil enseignant introuvable pour ce compte.",
        )

    return teacher


CurrentTeacherDependency = Annotated[Teacher, Depends(get_current_teacher)]
