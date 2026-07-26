"""Tests du schéma de création d'un compte."""

from unittest import TestCase

from pydantic import ValidationError

from app.schemas.account_create import AccountCreate


class TestAccountCreate(TestCase):
    """Vérifie les données acceptées avant la création."""

    def test_admin_and_teacher_roles_are_allowed(self) -> None:
        """Les deux rôles de la V1 sont acceptés."""

        admin = AccountCreate(
            registration_number="a000002",
            password="test@1234",
            role="ADMIN",
        )
        teacher = AccountCreate(
            registration_number="e000002",
            password="test@1234",
            role="TEACHER",
        )

        self.assertEqual(admin.role, "ADMIN")
        self.assertEqual(teacher.role, "TEACHER")

    def test_student_role_is_refused(self) -> None:
        """Un rôle absent de la V1 est refusé."""

        with self.assertRaises(ValidationError):
            AccountCreate(
                registration_number="u000002",
                password="test@1234",
                role="STUDENT",
            )

    def test_short_password_is_refused(self) -> None:
        """Un mot de passe de moins de huit caractères est refusé."""

        with self.assertRaises(ValidationError):
            AccountCreate(
                registration_number="a000002",
                password="court",
                role="ADMIN",
            )
