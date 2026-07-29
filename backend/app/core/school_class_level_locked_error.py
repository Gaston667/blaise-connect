"""Erreur métier levée lorsque le niveau d'une classe inscrite est modifié."""


class SchoolClassLevelLockedError(Exception):
    """Signale que le niveau est verrouillé par l'existence d'une inscription."""

