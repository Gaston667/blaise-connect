"""Résout le profil responsable associé au compte GUARDIAN connecté.

Un responsable ne peut consulter que les élèves auxquels il est rattaché par
`student_guardians`. Le contrôle est fait ici, côté serveur, pour chaque route
du portail parents : aucune décision d'accès n'est laissée au frontend.
"""

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.authentication import CurrentAccountDependency, DatabaseSession
from app.models.guardian import Guardian
from app.models.student import Student


def get_current_guardian(
    current_account: CurrentAccountDependency,
    db: DatabaseSession,
) -> Guardian:
    """Autorise uniquement un compte responsable et retourne son dossier."""

    if current_account.role != "GUARDIAN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Réservé aux responsables légaux.",
        )

    guardian = db.execute(
        select(Guardian).where(
            Guardian.account_id == current_account.id,
            Guardian.archived_at.is_(None),
        )
    ).scalar_one_or_none()

    if guardian is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil responsable introuvable pour ce compte.",
        )

    return guardian


CurrentGuardianDependency = Annotated[Guardian, Depends(get_current_guardian)]


def get_guardian_child(db: Session, guardian: Guardian, student_id: UUID) -> Student:
    """Retourne l'élève seulement s'il est rattaché à ce responsable.

    Un élève inexistant, archivé ou rattaché à un autre responsable produit la
    même réponse 404 : on ne révèle jamais l'existence d'un élève non autorisé.
    """

    is_linked = db.execute(
        text(
            """
            SELECT 1
            FROM student_guardians AS link
            JOIN students AS student ON student.id = link.student_id
            WHERE link.guardian_id = :guardian_id
              AND link.student_id = :student_id
              AND student.archived_at IS NULL
            """
        ),
        {"guardian_id": guardian.id, "student_id": student_id},
    ).first()

    student = (
        db.get(Student, student_id) if is_linked is not None else None
    )
    if student is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Élève introuvable.",
        )
    return student
