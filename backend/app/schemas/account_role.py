"""Énumération de tous les rôles stockés dans la table accounts."""

from enum import StrEnum


class AccountRole(StrEnum):
    """Rôles pouvant être lus et retournés par l'API."""

    ADMIN = "ADMIN"
    TEACHER = "TEACHER"
    STUDENT = "STUDENT"
    GUARDIAN = "GUARDIAN"
