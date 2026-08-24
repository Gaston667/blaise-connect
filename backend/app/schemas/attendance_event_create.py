"""Contrat de creation d'un appel de classe."""

from datetime import date, time
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.attendance_record_input import AttendanceRecordInput


class AttendanceEventCreate(BaseModel):
    """Contexte du cours et incidents constates pendant l'appel."""

    teacher_assignment_id: UUID
    attendance_date: date
    course_start_time: time
    course_end_time: time
    incidents: list[AttendanceRecordInput] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_event(self):
        """Controle les horaires et les doublons avant PostgreSQL."""

        if self.course_end_time <= self.course_start_time:
            raise ValueError("L'heure de fin doit suivre l'heure de debut.")
        enrollment_ids = [item.student_enrollment_id for item in self.incidents]
        if len(enrollment_ids) != len(set(enrollment_ids)):
            raise ValueError("Un eleve ne peut apparaitre qu'une fois dans l'appel.")
        return self
