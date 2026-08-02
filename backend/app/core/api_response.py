"""Enveloppes JSON standardisées pour les réponses HTTP de l'API."""

from __future__ import annotations

import json
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


DEFAULT_SUCCESS_MESSAGE = "Opération réussie."
DEFAULT_CREATED_MESSAGE = "Création réussie."
DEFAULT_UPDATED_MESSAGE = "Mise à jour réussie."
DEFAULT_DELETED_MESSAGE = "Suppression réussie."


def success_response(
    *,
    data: Any = None,
    code: str = "SUCCESS",
    message: str = DEFAULT_SUCCESS_MESSAGE,
    status_code: int = 200,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Construit une réponse de succès homogène pour le frontend."""

    payload = {
        "success": True,
        "code": code,
        "message": message,
        "data": data,
    }
    return JSONResponse(content=payload, status_code=status_code, headers=headers)


def error_response(
    *,
    code: str,
    message: str,
    status_code: int,
    field_errors: dict[str, str] | None = None,
    error_id: str | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Construit une réponse d'erreur homogène pour le frontend."""

    payload: dict[str, Any] = {
        "success": False,
        "code": code,
        "message": message,
    }
    if field_errors:
        payload["field_errors"] = field_errors
    if error_id:
        payload["error_id"] = error_id
    return JSONResponse(content=payload, status_code=status_code, headers=headers)


def _success_code_for(request: Request, status_code: int) -> str:
    method = request.method.upper()
    if status_code == 204 or method == "DELETE":
        return "DELETED"
    if status_code == 201 or method == "POST":
        return "CREATED"
    if method in {"PUT", "PATCH"}:
        return "UPDATED"
    return "SUCCESS"


def _success_message_for(request: Request, status_code: int) -> str:
    method = request.method.upper()
    if status_code == 204 or method == "DELETE":
        return DEFAULT_DELETED_MESSAGE
    if status_code == 201 or method == "POST":
        return DEFAULT_CREATED_MESSAGE
    if method in {"PUT", "PATCH"}:
        return DEFAULT_UPDATED_MESSAGE
    return DEFAULT_SUCCESS_MESSAGE


async def wrap_success_responses(request: Request, call_next):
    """Enveloppe les réponses JSON de succès sans toucher aux erreurs."""

    response = await call_next(request)
    if response.status_code >= 400:
        return response

    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type.lower():
        return response

    body = b""
    async for chunk in response.body_iterator:
        body += chunk

    if not body:
        return response

    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return response

    if isinstance(payload, dict) and {"success", "code", "message", "data"}.issubset(payload.keys()):
        headers = dict(response.headers)
        headers.pop("content-length", None)
        headers.pop("content-type", None)
        return JSONResponse(content=payload, status_code=response.status_code, headers=headers)

    headers = dict(response.headers)
    headers.pop("content-length", None)
    headers.pop("content-type", None)

    code = headers.pop("x-api-code", None) or _success_code_for(request, response.status_code)
    message = headers.pop("x-api-message", None) or _success_message_for(request, response.status_code)

    return JSONResponse(
        content={
            "success": True,
            "code": code,
            "message": message,
            "data": payload,
        },
        status_code=response.status_code,
        headers=headers,
    )
