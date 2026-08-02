"""Gestionnaires globaux d'exceptions pour l'API BlaiseConnect."""

from __future__ import annotations

import logging
from collections.abc import Iterable
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.api_response import error_response
from app.core.exceptions import AppError, ErrorCodes

logger = logging.getLogger(__name__)


_HTTP_STATUS_TO_CODE = {
    400: ErrorCodes.BAD_REQUEST,
    401: ErrorCodes.UNAUTHORIZED,
    403: ErrorCodes.FORBIDDEN,
    404: ErrorCodes.NOT_FOUND,
    409: ErrorCodes.CONFLICT,
    422: ErrorCodes.VALIDATION_ERROR,
}


def _normalize_text(value: str) -> str:
    return " ".join(value.lower().split())


def _code_from_message(message: str, status_code: int) -> str:
    normalized = _normalize_text(message)

    if status_code == 401:
        if "session" in normalized or "expir" in normalized:
            return ErrorCodes.SESSION_INVALID
        return ErrorCodes.UNAUTHORIZED
    if status_code == 403:
        return ErrorCodes.FORBIDDEN
    if status_code == 404:
        if "mati" in normalized:
            return ErrorCodes.SUBJECT_NOT_FOUND
        if "classe" in normalized:
            return ErrorCodes.SCHOOL_CLASS_NOT_FOUND
        if "année" in normalized or "annee" in normalized:
            return ErrorCodes.SCHOOL_YEAR_NOT_FOUND
        if "période" in normalized or "periode" in normalized:
            return ErrorCodes.REPORTING_PERIOD_NOT_FOUND
        if "enseignant" in normalized:
            return ErrorCodes.TEACHER_NOT_FOUND
        if "élève" in normalized or "eleve" in normalized:
            return ErrorCodes.STUDENT_NOT_FOUND
        if "responsable" in normalized:
            return ErrorCodes.GUARDIAN_NOT_FOUND
        return ErrorCodes.NOT_FOUND
    if status_code == 409:
        if "matricule" in normalized or "compte" in normalized:
            return ErrorCodes.ACCOUNT_ALREADY_EXISTS
        if "mati" in normalized:
            return ErrorCodes.SUBJECT_ALREADY_EXISTS
        if "classe" in normalized:
            return ErrorCodes.SCHOOL_CLASS_ALREADY_EXISTS
        if "année" in normalized or "annee" in normalized:
            return ErrorCodes.SCHOOL_YEAR_ALREADY_CLOSED
        return ErrorCodes.CONFLICT
    if status_code == 422:
        return ErrorCodes.VALIDATION_ERROR
    return _HTTP_STATUS_TO_CODE.get(status_code, ErrorCodes.BAD_REQUEST)


def _field_errors_from_validation(errors: Iterable[dict]) -> dict[str, str]:
    field_errors: dict[str, str] = {}
    for error in errors:
        location = error.get("loc", [])
        if location and location[0] == "body":
            location = location[1:]
        field_name = ".".join(str(part) for part in location) or "detail"
        field_errors[field_name] = error.get("msg", "Valeur invalide.")
    return field_errors


def _error_id_for(status_code: int) -> str | None:
    return str(uuid4()) if status_code >= 500 else None


async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    """Transforme une erreur applicative en enveloppe JSON uniforme."""

    return error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        field_errors=exc.field_errors or None,
        error_id=exc.error_id or _error_id_for(exc.status_code),
    )


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    """Normalise les HTTPException en réponse métier stable."""

    detail = exc.detail
    field_errors = None
    code = _HTTP_STATUS_TO_CODE.get(exc.status_code, ErrorCodes.BAD_REQUEST)
    message = "Une erreur est survenue."

    if isinstance(detail, dict):
        code = str(detail.get("code") or code)
        message = str(detail.get("message") or detail.get("detail") or message)
        field_errors = detail.get("field_errors")
        error_id = detail.get("error_id")
    else:
        message = str(detail) if detail else message
        code = _code_from_message(message, exc.status_code)
        error_id = _error_id_for(exc.status_code)

    return error_response(
        code=code,
        message=message,
        status_code=exc.status_code,
        field_errors=field_errors,
        error_id=error_id,
    )


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    """Expose les erreurs de validation sous forme de champs lisibles."""

    field_errors = _field_errors_from_validation(exc.errors())
    return error_response(
        code=ErrorCodes.VALIDATION_ERROR,
        message="La validation a échoué.",
        status_code=422,
        field_errors=field_errors,
    )


async def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    """Convertit les ValueError métiers en erreur lisible côté frontend."""

    message = str(exc) or "Valeur invalide."
    code = _code_from_message(message, 400)
    return error_response(
        code=code,
        message=message,
        status_code=400,
    )


async def unexpected_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    """Capture les erreurs non prévues sans exposer de détail technique."""

    error_id = str(uuid4())
    logger.exception("Unhandled application error [%s]", error_id, exc_info=exc)
    return error_response(
        code=ErrorCodes.INTERNAL_SERVER_ERROR,
        message="Une erreur interne est survenue.",
        status_code=500,
        error_id=error_id,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Enregistre tous les handlers globaux sur l'application FastAPI."""

    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValueError, value_error_handler)
    app.add_exception_handler(Exception, unexpected_exception_handler)
