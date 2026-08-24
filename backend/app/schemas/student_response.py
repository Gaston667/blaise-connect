"""Contrat de lecture d'un profil étudiant."""
from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class StudentResponse(BaseModel):
    """Expose les informations utiles d'un élève."""
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    account_id: UUID
    registration_number: str | None
    first_name: str
    last_name: str
    birth_date: date | None
    gender: str | None
    email: str | None
    phone: str | None
    address: str | None
    admission_date: date
    status: str
    photo_path: str | None
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime
    class_id: UUID | None
    class_main_teacher_id: UUID | None = None
    viewer_is_main_teacher: bool = False
    school_year_id: UUID | None
    class_name: str | None
    school_year_name: str | None
    birth_place: str | None
    nationality: str | None
    previous_level: str | None
    previous_establishment: str | None
    medical_condition: str | None
    is_enrolled_in_cned: bool
    guardians: list[dict] = Field(default_factory=list)


class StudentListResponse(BaseModel):
    """Page d'élèves accompagnée du total correspondant aux filtres."""

    items: list[StudentResponse]
    total: int = Field(ge=0)
