"""Validation partagée des numéros internationaux affichés avec espaces."""

import re


INTERNATIONAL_PHONE_PATTERN = re.compile(r"^\+\d{1,3}(?: \d{1,3}){3,6}$")
PHONE_FORMAT_MESSAGE = "Le téléphone doit respecter le format international, par exemple +224 610 70 08 00."


def normalize_international_phone(phone: str | None) -> str | None:
    """Normalise les espaces et valide un téléphone lorsqu'il est renseigné."""

    if phone is None:
        return None

    normalized_phone = " ".join(phone.split())
    if not normalized_phone:
        return None
    if not INTERNATIONAL_PHONE_PATTERN.fullmatch(normalized_phone):
        raise ValueError(PHONE_FORMAT_MESSAGE)
    return normalized_phone
