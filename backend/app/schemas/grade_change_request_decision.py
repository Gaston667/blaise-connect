"""Contrat de décision administrative sur une correction."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class GradeChangeRequestDecision(BaseModel):
    """Approbation ou rejet motivé d'une demande."""

    status: Literal["APPROVED", "REJECTED"]
    decision_comment: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def require_rejection_reason(self) -> "GradeChangeRequestDecision":
        """Exige un motif lorsque la demande est refusée."""

        if self.decision_comment is not None:
            self.decision_comment = self.decision_comment.strip() or None
        if self.status == "REJECTED" and not self.decision_comment:
            raise ValueError("Le motif du rejet est obligatoire.")
        return self
