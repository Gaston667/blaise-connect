"""Exception levée lorsqu'un compte est temporairement verrouillé."""

from datetime import datetime


class AccountLockedError(Exception):
    """Signale qu'un compte est temporairement verrouillé."""

    def __init__(self, locked_until: datetime) -> None:
        self.locked_until = locked_until
        super().__init__("Le compte est temporairement verrouillé.")
