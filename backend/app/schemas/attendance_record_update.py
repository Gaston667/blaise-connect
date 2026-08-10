"""Contrat de correction directe par un administrateur."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class AttendanceRecordUpdate(BaseModel):
    """Nouvelles valeurs d'un incident et motif d'audit obligatoire."""

    incident_type: Literal["ABSENT", "LATE"]
    late_minutes: int | None = Field(default=None, ge=1)
    reason: str | None = Field(default=None, max_length=500)
    change_reason: str = Field(min_length=3, max_length=500)

    @model_validator(mode="after")
    def validate_incident(self):
        """Controle la coherence du retard."""

        if self.incident_type == "ABSENT" and self.late_minutes is not None:
            raise ValueError("Une absence ne contient pas de duree de retard.")
        if self.incident_type == "LATE" and self.late_minutes is None:
            raise ValueError("La duree du retard est obligatoire.")
        return self
