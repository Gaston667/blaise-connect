"""Middlewares HTTP appliques a toutes les reponses de l'API."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import Request, Response

from app.core.http_security_config import IS_PRODUCTION


async def add_security_headers(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    """Ajoute des en-tetes qui reduisent les risques cote navigateur."""

    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Cache-Control"] = "no-store"

    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response
