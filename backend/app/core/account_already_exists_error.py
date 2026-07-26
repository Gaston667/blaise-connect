"""Exception levée lorsqu'un matricule existe déjà."""


class AccountAlreadyExistsError(Exception):
    """Signale qu'un compte utilise déjà le matricule demandé."""

    def __init__(self, registration_number: str) -> None:
        """Conserve le matricule concerné par le doublon."""

        self.registration_number = registration_number
        super().__init__(
            f"Le compte {registration_number} existe déjà."
        )
