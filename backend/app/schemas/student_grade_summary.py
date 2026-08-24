"""Contrat de synthèse des notes pour le tableau de bord élève."""

from datetime import date
from uuid import UUID

from pydantic import BaseModel


class StudentSubjectAverage(BaseModel):
    subject_id: UUID
    subject_name: str
    coefficient: float
    average: float | None


class StudentPeriodAverage(BaseModel):
    period_id: UUID
    period_name: str
    average: float | None


class StudentUpcomingAssessment(BaseModel):
    id: UUID
    title: str
    subject_name: str
    assessment_date: date


class StudentGradeSummary(BaseModel):
    overall_average: float | None
    rank: int | None
    class_size: int | None
    subject_averages: list[StudentSubjectAverage]
    period_averages: list[StudentPeriodAverage]
    upcoming_assessments: list[StudentUpcomingAssessment]
