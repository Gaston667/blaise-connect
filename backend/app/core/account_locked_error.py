"""Exception levée lorsqu'un compte est temporairement verrouillé."""

from datetime import datetime


class AccountLockedError(Exception):
    """Signale qu'un compte est temporairement verrouillé."""

    def __init__(self, locked_until: datetime) -> None:
        """Conserve la date de fin du verrouillage pour la couche HTTP."""

        self.locked_until = locked_until
        super().__init__("Le compte est temporairement verrouillé.")
