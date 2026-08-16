"""Erreurs applicatives et codes d'erreur partagés par l'API."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


class ErrorCodes:
    """Catalogue central des codes d'erreur utilisables par l'API."""

    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    BAD_REQUEST = "BAD_REQUEST"
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR"

    ACCOUNT_ALREADY_EXISTS = "ACCOUNT_ALREADY_EXISTS"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    INVALID_ADMIN_PASSWORD = "INVALID_ADMIN_PASSWORD"

    SCHOOL_YEAR_NOT_FOUND = "SCHOOL_YEAR_NOT_FOUND"
    SCHOOL_YEAR_ALREADY_CLOSED = "SCHOOL_YEAR_ALREADY_CLOSED"
    SCHOOL_YEAR_CONFIRMATION_MISMATCH = "SCHOOL_YEAR_CONFIRMATION_MISMATCH"
    SCHOOL_YEAR_PERIODS_MISMATCH = "SCHOOL_YEAR_PERIODS_MISMATCH"

    SCHOOL_CLASS_NOT_FOUND = "SCHOOL_CLASS_NOT_FOUND"
    SCHOOL_CLASS_ALREADY_EXISTS = "SCHOOL_CLASS_ALREADY_EXISTS"
    SCHOOL_CLASS_LEVEL_LOCKED = "SCHOOL_CLASS_LEVEL_LOCKED"

    REPORTING_PERIOD_NOT_FOUND = "REPORTING_PERIOD_NOT_FOUND"

    SUBJECT_ALREADY_EXISTS = "SUBJECT_ALREADY_EXISTS"
    SUBJECT_NOT_FOUND = "SUBJECT_NOT_FOUND"

    TEACHER_ALREADY_EXISTS = "TEACHER_ALREADY_EXISTS"
    TEACHER_NOT_FOUND = "TEACHER_NOT_FOUND"

    STUDENT_ALREADY_EXISTS = "STUDENT_ALREADY_EXISTS"
    STUDENT_NOT_FOUND = "STUDENT_NOT_FOUND"

    GUARDIAN_ALREADY_EXISTS = "GUARDIAN_ALREADY_EXISTS"
    GUARDIAN_NOT_FOUND = "GUARDIAN_NOT_FOUND"

    SESSION_INVALID = "SESSION_INVALID"
    SESSION_EXPIRED = "SESSION_EXPIRED"

    LATEX_REMOTE_UNAVAILABLE = "LATEX_REMOTE_UNAVAILABLE"
    LATEX_COMPILATION_FAILED = "LATEX_COMPILATION_FAILED"


@dataclass(slots=True)
class AppError(Exception):
    """Erreur applicative normalisée pour les règles métier connues."""

    code: str
    message: str
    status_code: int = 400
    field_errors: dict[str, str] = field(default_factory=dict)
    error_id: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        super().__init__(self.message)


@dataclass(slots=True)
class NotFoundError(AppError):
    """Raccourci pour les erreurs 404."""

    def __init__(self, code: str, message: str, **extra: Any) -> None:
        super().__init__(code=code, message=message, status_code=404, extra=extra)
