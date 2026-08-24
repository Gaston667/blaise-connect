"""Donnees d'un incident releve pendant un appel."""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class AttendanceRecordInput(BaseModel):
    """Decrit une absence ou un retard; la presence reste implicite."""

    student_enrollment_id: UUID
    incident_type: Literal["ABSENT", "LATE"]
    late_minutes: int | None = Field(default=None, ge=1)
    reason: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_incident(self):
        """Impose des minutes uniquement pour un retard."""

        if self.incident_type == "ABSENT" and self.late_minutes is not None:
            raise ValueError("Une absence ne contient pas de duree de retard.")
        if self.incident_type == "LATE" and self.late_minutes is None:
            raise ValueError("La duree du retard est obligatoire.")
        return self
