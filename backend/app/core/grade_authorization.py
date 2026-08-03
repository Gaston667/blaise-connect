"""Autorisation des comptes qui consultent ou saisissent des notes."""

from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.core.authentication import CurrentAccountDependency
from app.models.account import Account


def require_grade_manager(
    current_account: CurrentAccountDependency,
) -> Account:
    """Autorise les administrateurs et les enseignants actifs."""

    if current_account.role not in {"ADMIN", "TEACHER"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous n'avez pas les droits pour gérer les notes.",
        )

    return current_account


GradeManagerDependency = Annotated[
    Account,
    Depends(require_grade_manager),
]
