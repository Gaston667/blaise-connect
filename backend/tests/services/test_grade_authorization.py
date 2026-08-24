"""Tests des permissions de l'espace Notes."""

from unittest import TestCase
from uuid import uuid4

from fastapi import HTTPException

from app.core.grade_authorization import require_grade_manager
from app.models.account import Account


def build_account(role: str) -> Account:
    """Construit un compte fictif portant le rôle demandé."""

    return Account(
        id=uuid4(),
        registration_number="a999998",
        password_hash="hash-fictif-d-au-moins-vingt-caracteres",
        role=role,
        is_active=True,
    )


class TestGradeAuthorization(TestCase):
    """Vérifie les rôles autorisés à gérer les évaluations."""

    def test_teacher_is_allowed(self) -> None:
        """Un enseignant authentifié accède à l'espace Notes."""

        teacher = build_account("TEACHER")
        self.assertIs(require_grade_manager(teacher), teacher)

    def test_admin_is_allowed(self) -> None:
        """Un administrateur authentifié accède à l'espace Notes."""

        admin = build_account("ADMIN")
        self.assertIs(require_grade_manager(admin), admin)

    def test_student_is_forbidden(self) -> None:
        """Un élève ne peut ni consulter ni saisir ces notes administratives."""

        with self.assertRaises(HTTPException) as context:
            require_grade_manager(build_account("STUDENT"))

        self.assertEqual(context.exception.status_code, 403)

