"""Erreur métier liée à la confirmation sensible d'un administrateur."""


class InvalidAdminPasswordError(Exception):
    """Signale que le mot de passe de confirmation est incorrect."""

