"""Type et normalisation des matricules de BlaiseConnect."""

from typing import Annotated

from pydantic import BeforeValidator, Field


def normalize_registration_number(value: object) -> object:
    """Retire les espaces et convertit un matricule en minuscules."""

    if isinstance(value, str):
        return value.strip().lower()

    return value


RegistrationNumber = Annotated[
    str,
    Field(min_length=7, max_length=7, pattern=r"^[aeup][0-9]{6}$"),
    BeforeValidator(normalize_registration_number),
]
