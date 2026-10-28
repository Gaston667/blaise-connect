"""Tests du contrôle d'accès et des règles du portail parents."""

from unittest import TestCase
from unittest.mock import Mock
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.guardian_self import get_current_guardian, get_guardian_child
from app.services.guardian_portal_service import get_child_report_card


def _account(role: str) -> Mock:
    account = Mock()
    account.role = role
    account.id = uuid4()
    return account


class TestCurrentGuardian(TestCase):
    """Seul un compte GUARDIAN rattaché à un dossier actif est accepté."""

    def setUp(self) -> None:
        self.db = Mock(spec=Session)

    def test_refuses_non_guardian_roles(self) -> None:
        for role in ("STUDENT", "TEACHER", "ADMIN"):
            with self.subTest(role=role):
                with self.assertRaises(HTTPException) as context:
                    get_current_guardian(_account(role), self.db)
                self.assertEqual(context.exception.status_code, 403)

    def test_refuses_guardian_account_without_profile(self) -> None:
        self.db.execute.return_value.scalar_one_or_none.return_value = None
        with self.assertRaises(HTTPException) as context:
            get_current_guardian(_account("GUARDIAN"), self.db)
        self.assertEqual(context.exception.status_code, 404)

    def test_returns_active_guardian_profile(self) -> None:
        guardian = Mock()
        self.db.execute.return_value.scalar_one_or_none.return_value = guardian
        self.assertIs(get_current_guardian(_account("GUARDIAN"), self.db), guardian)


class TestGuardianChildAccess(TestCase):
    """Un parent n'accède qu'aux élèves auxquels il est rattaché."""

    def setUp(self) -> None:
        self.db = Mock(spec=Session)
        self.guardian = Mock()
        self.guardian.id = uuid4()

    def test_unlinked_student_is_reported_as_not_found(self) -> None:
        self.db.execute.return_value.first.return_value = None
        with self.assertRaises(HTTPException) as context:
            get_guardian_child(self.db, self.guardian, uuid4())
        self.assertEqual(context.exception.status_code, 404)
        self.db.get.assert_not_called()

    def test_linked_student_is_returned(self) -> None:
        student = Mock()
        self.db.execute.return_value.first.return_value = (1,)
        self.db.get.return_value = student
        self.assertIs(get_guardian_child(self.db, self.guardian, uuid4()), student)


class TestChildReportCard(TestCase):
    """Un bulletin non validé ou d'un autre élève n'est jamais retourné."""

    def test_unowned_or_draft_report_card_is_not_found(self) -> None:
        db = Mock(spec=Session)
        db.execute.return_value.first.return_value = None
        with self.assertRaises(LookupError):
            get_child_report_card(db, uuid4(), uuid4())
