"""Tests des règles d'autorisation des corrections de notes."""

from unittest import TestCase
from uuid import uuid4

from app.models.account import Account
from app.services.grade_change_request_service import can_review_grade_change


def build_reviewer(role: str) -> Account:
    """Construit un compte relecteur fictif."""

    return Account(
        id=uuid4(),
        registration_number="e999997",
        password_hash="hash-fictif-d-au-moins-vingt-caracteres",
        role=role,
        is_active=True,
    )


class TestGradeChangeReviewAuthorization(TestCase):
    """Vérifie administrateur, professeur principal et auto-validation."""

    def test_admin_can_review_another_account_request(self) -> None:
        """Un administrateur peut traiter la demande d'un autre compte."""

        admin = build_reviewer("ADMIN")
        self.assertTrue(
            can_review_grade_change(admin, None, uuid4(), uuid4())
        )

    def test_main_teacher_can_review_class_request(self) -> None:
        """Le professeur principal peut traiter une demande de sa classe."""

        teacher = build_reviewer("TEACHER")
        teacher_id = uuid4()
        self.assertTrue(
            can_review_grade_change(teacher, teacher_id, teacher_id, uuid4())
        )

    def test_requester_cannot_review_own_request(self) -> None:
        """L'auto-validation reste interdite, même pour un administrateur."""

        admin = build_reviewer("ADMIN")
        self.assertFalse(
            can_review_grade_change(admin, None, uuid4(), admin.id)
        )

    def test_unrelated_teacher_cannot_review_request(self) -> None:
        """Un enseignant sans responsabilité sur la classe est refusé."""

        teacher = build_reviewer("TEACHER")
        self.assertFalse(
            can_review_grade_change(teacher, uuid4(), uuid4(), uuid4())
        )

