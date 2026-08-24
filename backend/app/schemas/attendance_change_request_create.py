"""Contrat de signalement d'une correction d'assiduite."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AttendanceChangeRequestCreate(BaseModel):
    """Correction demandee par un enseignant, sans mutation directe."""

    requested_action: Literal["UPDATE", "DELETE"]
    proposed_incident_type: Literal["ABSENT", "LATE"] | None = None
    proposed_late_minutes: int | None = Field(default=None, ge=1)
    proposed_reason: str | None = Field(default=None, max_length=500)
    request_reason: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def validate_proposal(self):
        """Valide la proposition selon l'action demandee."""

        if self.requested_action == "DELETE":
            if self.proposed_incident_type is not None or self.proposed_late_minutes is not None:
                raise ValueError("Une suppression ne contient pas de nouvel incident.")
            return self
        if self.proposed_incident_type is None:
            raise ValueError("Le nouveau type d'incident est obligatoire.")
        if self.proposed_incident_type == "ABSENT" and self.proposed_late_minutes is not None:
            raise ValueError("Une absence ne contient pas de duree de retard.")
        if self.proposed_incident_type == "LATE" and self.proposed_late_minutes is None:
            raise ValueError("La duree du retard est obligatoire.")
        return self
