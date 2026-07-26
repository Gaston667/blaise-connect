"""Tests unitaires du service de gestion des comptes."""

from unittest import TestCase
from unittest.mock import Mock, patch

from sqlalchemy.orm import Session

from app.core.account_already_exists_error import (
    AccountAlreadyExistsError,
)
from app.models.account import Account
from app.schemas.account_create import AccountCreate
from app.services.account_service import create_account


class TestAccountService(TestCase):
    """Vérifie les règles de création d'un compte."""

    def setUp(self) -> None:
        """Prépare une session SQLAlchemy simulée."""

        self.db = Mock(spec=Session)
        self.account_data = AccountCreate(
            registration_number="a000002",
            password="test@1234",
            role="ADMIN",
        )

    @patch(
        "app.services.account_service.hash_password",
        return_value="hash-fictif-d-au-moins-vingt-caracteres",
    )
    def test_create_account_hashes_password(
        self,
        hash_password_mock: Mock,
    ) -> None:
        """Le mot de passe est haché avant l'enregistrement."""

        self.db.scalar.return_value = None

        account = create_account(
            db=self.db,
            account_data=self.account_data,
        )

        self.assertEqual(account.registration_number, "a000002")
        self.assertEqual(account.role, "ADMIN")
        self.assertNotEqual(account.password_hash, "test@1234")
        hash_password_mock.assert_called_once_with("test@1234")
        self.db.add.assert_called_once_with(account)
        self.db.commit.assert_called_once()
        self.db.refresh.assert_called_once_with(account)

    @patch("app.services.account_service.hash_password")
    def test_existing_registration_number_is_refused(
        self,
        hash_password_mock: Mock,
    ) -> None:
        """Un matricule déjà utilisé est refusé."""

        self.db.scalar.return_value = Account(
            registration_number="a000002",
            password_hash="hash-fictif-d-au-moins-vingt-caracteres",
            role="ADMIN",
        )

        with self.assertRaises(AccountAlreadyExistsError):
            create_account(
                db=self.db,
                account_data=self.account_data,
            )

        hash_password_mock.assert_not_called()
        self.db.add.assert_not_called()
        self.db.commit.assert_not_called()
