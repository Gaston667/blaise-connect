"""Contrat de réponse du tableau de bord administrateur."""

from datetime import date, datetime

from pydantic import BaseModel


class AdminDashboardStats(BaseModel):
    absences_pending: int
    evaluations_incomplete: int
    correction_requests_pending: int
    report_cards_pending: int


class AdminDashboardCyclePeriod(BaseModel):
    period_name: str
    average: float


class AdminDashboardCyclePerformance(BaseModel):
    label: str
    average: float
    periods: list[AdminDashboardCyclePeriod]


class AdminDashboardAttendanceEntry(BaseModel):
    student_name: str
    class_name: str
    absence_count: int


class AdminDashboardGradeEntryProgress(BaseModel):
    entered: int
    total: int
    percent: int


class AdminDashboardActivityEntry(BaseModel):
    kind: str
    happened_at: datetime
    actor_name: str | None
    context_class: str | None
    context_date: date | None
    context_subject: str | None


class AdminDashboardResponse(BaseModel):
    stats: AdminDashboardStats
    cycle_performance: list[AdminDashboardCyclePerformance]
    attendance_watchlist: list[AdminDashboardAttendanceEntry]
    grade_entry_progress: AdminDashboardGradeEntryProgress
    recent_activity: list[AdminDashboardActivityEntry]
