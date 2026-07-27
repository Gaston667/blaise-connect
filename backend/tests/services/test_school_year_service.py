"""Tests unitaires du service de gestion des années scolaires."""

from datetime import date, datetime, timezone
from unittest import TestCase
from unittest.mock import Mock
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.school_year_already_closed_error import (
    SchoolYearAlreadyClosedError,
)
from app.core.school_year_not_found_error import SchoolYearNotFoundError
from app.models.school_year import SchoolYear
from app.schemas.school_year_create import SchoolYearCreate
from app.services.school_year_service import (
    close_school_year,
    create_school_year,
    get_school_year_by_id,
    set_current_school_year,
)


class TestCreateSchoolYear(TestCase):
    """Vérifie la création d'une année scolaire."""

    def setUp(self) -> None:
        """Prépare une session SQLAlchemy simulée."""

        self.db = Mock(spec=Session)
        self.school_year_data = SchoolYearCreate(
            name="2026-2027",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 7, 15),
        )

    def test_create_school_year_starts_not_current(self) -> None:
        """Une nouvelle année n'est jamais courante par défaut."""

        school_year = create_school_year(
            db=self.db,
            school_year_data=self.school_year_data,
        )

        self.assertEqual(school_year.name, "2026-2027")
        self.assertFalse(school_year.is_current)
        self.assertIsNone(school_year.closed_at)
        self.db.add.assert_called_once_with(school_year)
        self.db.commit.assert_called_once()
        self.db.refresh.assert_called_once_with(school_year)


class TestGetSchoolYearById(TestCase):
    """Vérifie la récupération d'une année scolaire par identifiant."""

    def setUp(self) -> None:
        """Prépare une session SQLAlchemy simulée."""

        self.db = Mock(spec=Session)

    def test_missing_school_year_raises_not_found(self) -> None:
        """Un identifiant inconnu lève SchoolYearNotFoundError."""

        self.db.get.return_value = None

        with self.assertRaises(SchoolYearNotFoundError):
            get_school_year_by_id(self.db, uuid4())


class TestSetCurrentSchoolYear(TestCase):
    """Vérifie le changement d'année courante."""

    def setUp(self) -> None:
        """Prépare une session SQLAlchemy simulée."""

        self.db = Mock(spec=Session)

    def test_previous_current_year_is_unset(self) -> None:
        """L'ancienne année courante perd son statut avant la nouvelle."""

        target_year = SchoolYear(
            id=uuid4(),
            name="2026-2027",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 7, 15),
            is_current=False,
        )
        previous_year = SchoolYear(
            id=uuid4(),
            name="2025-2026",
            start_date=date(2025, 9, 1),
            end_date=date(2026, 7, 15),
            is_current=True,
        )

        self.db.get.return_value = target_year
        self.db.scalar.return_value = previous_year

        result = set_current_school_year(self.db, target_year.id)

        self.assertFalse(previous_year.is_current)
        self.assertTrue(result.is_current)
        self.db.flush.assert_called_once()
        self.db.commit.assert_called_once()

    def test_closed_year_cannot_become_current(self) -> None:
        """Une année clôturée refuse de redevenir courante."""

        closed_year = SchoolYear(
            id=uuid4(),
            name="2024-2025",
            start_date=date(2024, 9, 1),
            end_date=date(2025, 7, 15),
            closed_at=datetime.now(timezone.utc),
            closed_by_account_id=uuid4(),
        )

        self.db.get.return_value = closed_year

        with self.assertRaises(SchoolYearAlreadyClosedError):
            set_current_school_year(self.db, closed_year.id)

        self.db.commit.assert_not_called()


class TestCloseSchoolYear(TestCase):
    """Vérifie la clôture d'une année scolaire."""

    def setUp(self) -> None:
        """Prépare une session SQLAlchemy simulée."""

        self.db = Mock(spec=Session)

    def test_close_sets_closure_fields(self) -> None:
        """La clôture renseigne closed_at, closed_by et retire is_current."""

        school_year = SchoolYear(
            id=uuid4(),
            name="2026-2027",
            start_date=date(2026, 9, 1),
            end_date=date(2027, 7, 15),
            is_current=True,
        )
        admin_account_id = uuid4()

        self.db.get.return_value = school_year

        result = close_school_year(
            db=self.db,
            school_year_id=school_year.id,
            closed_by_account_id=admin_account_id,
        )

        self.assertIsNotNone(result.closed_at)
        self.assertEqual(result.closed_by_account_id, admin_account_id)
        self.assertFalse(result.is_current)
        self.db.commit.assert_called_once()

    def test_already_closed_year_is_refused(self) -> None:
        """Une année déjà clôturée ne peut pas être reclôturée."""

        school_year = SchoolYear(
            id=uuid4(),
            name="2024-2025",
            start_date=date(2024, 9, 1),
            end_date=date(2025, 7, 15),
            closed_at=datetime.now(timezone.utc),
            closed_by_account_id=uuid4(),
        )

        self.db.get.return_value = school_year

        with self.assertRaises(SchoolYearAlreadyClosedError):
            close_school_year(
                db=self.db,
                school_year_id=school_year.id,
                closed_by_account_id=uuid4(),
            )

        self.db.commit.assert_not_called()