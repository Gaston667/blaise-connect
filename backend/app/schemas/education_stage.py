"""Cycles scolaires fixes reconnus par BlaiseConnect."""

from enum import StrEnum


class EducationStage(StrEnum):
    """Regroupe chaque niveau dans un cycle scolaire stable."""

    PRESCHOOL = "PRESCHOOL"
    PRIMARY = "PRIMARY"
    MIDDLE_SCHOOL = "MIDDLE_SCHOOL"
    HIGH_SCHOOL = "HIGH_SCHOOL"
