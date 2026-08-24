"""Configuration HTTP de securite, differente entre developpement et production."""

from __future__ import annotations

import os


DEVELOPMENT_ALLOWED_HOSTS = ("localhost", "127.0.0.1", "testserver", "backend")
DEVELOPMENT_ALLOWED_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
)


def _read_csv_variable(variable_name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    """Lit une variable CSV en supprimant les valeurs vides."""

    configured_value = os.getenv(variable_name, "").strip()
    if not configured_value:
        return default

    return tuple(
        value.strip()
        for value in configured_value.split(",")
        if value.strip()
    )


APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PRODUCTION = APP_ENV == "production"

ALLOWED_HOSTS = _read_csv_variable("ALLOWED_HOSTS", DEVELOPMENT_ALLOWED_HOSTS)
ALLOWED_ORIGINS = _read_csv_variable("ALLOWED_ORIGINS", DEVELOPMENT_ALLOWED_ORIGINS)

if IS_PRODUCTION and (
    ALLOWED_HOSTS == DEVELOPMENT_ALLOWED_HOSTS
    or ALLOWED_ORIGINS == DEVELOPMENT_ALLOWED_ORIGINS
):
    raise RuntimeError(
        "En production, ALLOWED_HOSTS et ALLOWED_ORIGINS doivent etre definis."
    )

