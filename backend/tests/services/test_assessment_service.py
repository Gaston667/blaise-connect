"""Tests unitaires des règles métier des évaluations et des notes."""

from decimal import Decimal
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import Mock, patch
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.account import Account
from app.schemas.grade_sheet_entry import GradeSheetEntry
from app.schemas.grade_sheet_submit import GradeSheetSubmit
from app.services.assessment_service import (
    calculate_assessment_statistics,
    get_effective_score_on_20,
    normalize_score_on_20,
    submit_grade_sheet,
    validate_score_against_scale,
)


def build_teacher_account() -> Account:
    """Construit un compte enseignant fictif actif."""

    return Account(
        id=uuid4(),
        registration_number="e999999",
        password_hash="hash-fictif-d-au-moins-vingt-caracteres",
        role="TEACHER",
        is_active=True,
    )


class TestAssessmentCalculations(TestCase):
    """Vérifie les calculs officiels indépendamment de PostgreSQL."""

    def test_score_is_normalized_on_twenty(self) -> None:
        """Un résultat sur un autre barème est converti sur vingt."""

        result = normalize_score_on_20(Decimal("15"), Decimal("30"))
        self.assertEqual(result, Decimal("10.00"))

    def test_score_above_scale_is_refused(self) -> None:
        """Une note supérieure au barème est rejetée."""

        with self.assertRaises(ValueError):
            validate_score_against_scale(
                result_type="SCORED",
                score=Decimal("21"),
                maximum_score=Decimal("20"),
            )

    def test_justified_absence_is_excluded(self) -> None:
        """Une absence justifiée ne devient pas une note zéro."""

        result = get_effective_score_on_20(
            result_type="ABSENT",
            score=None,
            maximum_score=Decimal("20"),
            justification_status="JUSTIFIED",
        )
        self.assertIsNone(result)

    def test_unjustified_absence_counts_as_zero(self) -> None:
        """Une absence non justifiée vaut zéro dans la moyenne uniquement."""

        result = get_effective_score_on_20(
            result_type="ABSENT",
            score=None,
            maximum_score=Decimal("20"),
            justification_status="UNJUSTIFIED",
        )
        self.assertEqual(result, Decimal("0.00"))

    def test_statistics_ignore_pending_absence(self) -> None:
        """Une justification en attente est exclue du calcul officiel."""

        rows = [
            {
                "grade_id": uuid4(),
                "result_type": "SCORED",
                "justification_status": None,
                "normalized_score_on_20": Decimal("14.00"),
            },
            {
                "grade_id": uuid4(),
                "result_type": "ABSENT",
                "justification_status": "PENDING",
                "normalized_score_on_20": None,
            },
        ]

        statistics = calculate_assessment_statistics(rows)

        self.assertEqual(statistics["official_average_on_20"], Decimal("14.00"))
        self.assertEqual(statistics["pending_absence_count"], 1)


class TestAssessmentConcurrency(TestCase):
    """Vérifie les protections utilisées pendant une saisie concurrente."""

    @patch("app.services.assessment_service.get_grade_sheet")
    def test_collective_submit_locks_assessment_before_insert(
        self,
        get_grade_sheet_mock: Mock,
    ) -> None:
        """La feuille verrouille l'évaluation avant de rechercher les doublons."""

        database = Mock(spec=Session)
        enrollment_id = uuid4()
        assessment_result = Mock()
        assessment_result.first.return_value = SimpleNamespace(
            id=uuid4(),
            maximum_score=Decimal("20"),
        )
        eligible_result = Mock()
        eligible_result.all.return_value = [SimpleNamespace(id=enrollment_id)]
        existing_result = Mock()
        existing_result.all.return_value = []
        insert_result = Mock()
        database.execute.side_effect = [
            assessment_result,
            eligible_result,
            existing_result,
            insert_result,
        ]
        get_grade_sheet_mock.return_value = {"rows": []}
        payload = GradeSheetSubmit(
            entries=[
                GradeSheetEntry(
                    student_enrollment_id=enrollment_id,
                    result_type="SCORED",
                    score=Decimal("12"),
                )
            ]
        )

        submit_grade_sheet(
            db=database,
            actor=build_teacher_account(),
            assessment_id=uuid4(),
            sheet_data=payload,
        )

        first_statement = str(database.execute.call_args_list[0].args[0])
        self.assertIn("FOR UPDATE", first_statement)
        database.commit.assert_called_once()

