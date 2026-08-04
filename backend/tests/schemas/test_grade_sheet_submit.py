"""Tests du contrat de saisie collective."""

from decimal import Decimal
from unittest import TestCase
from uuid import uuid4

from pydantic import ValidationError

from app.schemas.grade_sheet_entry import GradeSheetEntry
from app.schemas.grade_sheet_submit import GradeSheetSubmit


class TestGradeSheetSubmit(TestCase):
    """Vérifie la cohérence d'une feuille avant le service métier."""

    def test_duplicate_enrollment_is_refused(self) -> None:
        """La même inscription ne peut apparaître deux fois."""

        enrollment_id = uuid4()
        entry = GradeSheetEntry(
            student_enrollment_id=enrollment_id,
            result_type="SCORED",
            score=Decimal("10"),
        )

        with self.assertRaises(ValidationError):
            GradeSheetSubmit(entries=[entry, entry])

    def test_absence_cannot_have_score(self) -> None:
        """Une absence n'accepte aucune valeur numérique."""

        with self.assertRaises(ValidationError):
            GradeSheetEntry(
                student_enrollment_id=uuid4(),
                result_type="ABSENT",
                score=Decimal("0"),
            )

