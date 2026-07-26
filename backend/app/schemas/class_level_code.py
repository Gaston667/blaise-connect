"""Codes fixes des niveaux scolaires reconnus par BlaiseConnect."""

from enum import StrEnum


class ClassLevelCode(StrEnum):
    """Évite l'utilisation de codes différents pour un même niveau."""

    PETITE_SECTION = "PETITE_SECTION"
    MOYENNE_SECTION = "MOYENNE_SECTION"
    GRANDE_SECTION = "GRANDE_SECTION"
    CP = "CP"
    CE1 = "CE1"
    CE2 = "CE2"
    CM1 = "CM1"
    CM2 = "CM2"
    SIXIEME = "SIXIEME"
    CINQUIEME = "CINQUIEME"
    QUATRIEME = "QUATRIEME"
    TROISIEME = "TROISIEME"
    SECONDE = "SECONDE"
    PREMIERE = "PREMIERE"
    TERMINALE = "TERMINALE"
