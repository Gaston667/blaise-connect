"""Tests unitaires du service de gestion des périodes de bulletin."""

from datetime import date, timedelta
from unittest import TestCase
from unittest.mock import Mock, patch
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.school_period import SchoolPeriod
from app.models.school_year import SchoolYear
from app.schemas.reporting_period_create import ReportingPeriodCreate
from app.services.reporting_period_service import (
    compute_next_period_start_date,
    create_reporting_period,
)


class TestComputeNextPeriodStartDate(TestCase):
    """Vérifie le calcul automatique de la date de début d'une période."""

    def setUp(self) -> None:
        """Prépare une session SQLAlchemy simulée."""

        self.db = Mock(spec=Session)
        self.school_year_id = uuid4()

    def test_first_period_starts_at_year_start(self) -> None:
        """Sans période existante, le début est celui de l'année."""

        self.db.scalar.return_value = None
        school_year = SchoolYear(
            id=self.school_year_id,
            name="2026-2027",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 7, 15),
        )
        self.db.get.return_value = school_year

        start_date = compute_next_period_start_date(self.db, self.school_year_id)

        self.assertEqual(start_date, date(2026, 9, 1))

    def test_next_period_starts_day_after_previous_end(self) -> None:
        """Avec une période existante, le début suit sa date de fin."""

        last_period = SchoolPeriod(
            id=uuid4(),
            school_year_id=self.school_year_id,
            name="Trimestre 1",
            start_date=date(2026, 9, 1),
            end_date=date(2026, 12, 20),
        )
        self.db.scalar.return_value = last_period

        start_date = compute_next_period_start_date(self.db, self.school_year_id)

        self.assertEqual(start_date, date(2026, 12, 21))


class TestCreateReportingPeriod(TestCase):
    """Vérifie la création d'une période de bulletin."""

    def setUp(self) -> None:
        """Prépare une session SQLAlchemy simulée."""

        self.db = Mock(spec=Session)
        self.school_year_id = uuid4()
        self.period_data = ReportingPeriodCreate(
            school_year_id=self.school_year_id,
            name="Trimestre 1",
            end_date=date(2026, 12, 20),
        )

    @patch(
        "app.services.reporting_period_service.compute_next_period_start_date",
        return_value=date(2026, 9, 1),
    )
    def test_created_period_uses_computed_start_date(
        self,
        compute_start_date_mock: Mock,
    ) -> None:
        """La période créée reçoit la date de début calculée, pas saisie."""

        period = create_reporting_period(self.db, self.period_data)

        self.assertEqual(period.start_date, date(2026, 9, 1))
        self.assertEqual(period.end_date, date(2026, 12, 20))
        compute_start_date_mock.assert_called_once_with(
            self.db, self.school_year_id
        )
        self.db.add.assert_called_once_with(period)
        self.db.commit.assert_called_once()
        self.db.refresh.assert_called_once_with(period)