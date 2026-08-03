"""Résout le profil élève associé au compte STUDENT connecté."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy import select

from app.core.authentication import CurrentAccountDependency, DatabaseSession
from app.models.student import Student


def get_current_student(
    current_account: CurrentAccountDependency,
    db: DatabaseSession,
) -> Student:
    """Autorise uniquement un compte élève et retourne son dossier."""

    if current_account.role != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé aux élèves.",
        )

    student = db.execute(
        select(Student).where(Student.account_id == current_account.id)
    ).scalar_one_or_none()

    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil élève introuvable pour ce compte.",
        )

    return student


CurrentStudentDependency = Annotated[Student, Depends(get_current_student)]
