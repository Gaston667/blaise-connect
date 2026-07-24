"""Tests unitaires du service d'authentification."""

from datetime import UTC, datetime, timedelta
from unittest import TestCase
from unittest.mock import Mock, patch
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.account_locked_error import AccountLockedError
from app.models.account import Account
from app.services.auth_service import (
    ACCOUNT_LOCK_DURATION,
    MAX_FAILED_LOGIN_ATTEMPTS,
    authenticate_account,
)


def build_test_account(
    failed_login_attempts: int = 0,
    locked_until: datetime | None = None,
) -> Account:
    """Construit un compte administrateur fictif pour les tests."""

    return Account(
        id=uuid4(),
        registration_number="a999999",
        password_hash="hash-fictif-d-au-moins-vingt-caracteres",
        role="ADMIN",
        is_active=True,
        failed_login_attempts=failed_login_attempts,
        locked_until=locked_until,
        archived_at=None,
    )


class TestAuthService(TestCase):
    """Vérifie les règles de verrouillage du service d'authentification."""

    def setUp(self) -> None:
        """Prépare une session SQLAlchemy simulée pour chaque test."""

        self.db = Mock(spec=Session)

    @patch("app.services.auth_service.verify_password", return_value=False)
    def test_wrong_password_increments_counter(
        self,
        verify_password_mock: Mock,
    ) -> None:
        """Un mauvais mot de passe ajoute un échec."""

        account = build_test_account()
        self.db.scalar.return_value = account

        result = authenticate_account(
            db=self.db,
            registration_number=account.registration_number,
            password="mot-de-passe-incorrect",
        )

        self.assertIsNone(result)
        self.assertEqual(account.failed_login_attempts, 1)
        self.assertIsNone(account.locked_until)
        self.db.commit.assert_called_once()
        verify_password_mock.assert_called_once()

    @patch("app.services.auth_service.verify_password", return_value=False)
    def test_fifth_failure_locks_account(
        self,
        verify_password_mock: Mock,
    ) -> None:
        """Le cinquième échec verrouille le compte pendant cinq minutes."""

        account = build_test_account(
            failed_login_attempts=MAX_FAILED_LOGIN_ATTEMPTS - 1
        )
        self.db.scalar.return_value = account
        test_started_at = datetime.now(UTC)

        with self.assertRaises(AccountLockedError):
            authenticate_account(
                db=self.db,
                registration_number=account.registration_number,
                password="mot-de-passe-incorrect",
            )

        self.assertEqual(
            account.failed_login_attempts,
            MAX_FAILED_LOGIN_ATTEMPTS,
        )
        self.assertIsNotNone(account.locked_until)
        self.assertGreaterEqual(
            account.locked_until,
            test_started_at + ACCOUNT_LOCK_DURATION - timedelta(seconds=1),
        )
        self.db.commit.assert_called_once()
        verify_password_mock.assert_called_once()

    @patch("app.services.auth_service.verify_password")
    def test_locked_account_is_refused(
        self,
        verify_password_mock: Mock,
    ) -> None:
        """Un compte encore verrouillé est refusé sans vérifier le mot de passe."""

        account = build_test_account(
            failed_login_attempts=MAX_FAILED_LOGIN_ATTEMPTS,
            locked_until=datetime.now(UTC) + timedelta(minutes=1),
        )
        self.db.scalar.return_value = account

        with self.assertRaises(AccountLockedError):
            authenticate_account(
                db=self.db,
                registration_number=account.registration_number,
                password="mot-de-passe",
            )

        verify_password_mock.assert_not_called()
        self.db.commit.assert_not_called()

    @patch("app.services.auth_service.verify_password", return_value=True)
    def test_success_resets_failed_login_state(
        self,
        verify_password_mock: Mock,
    ) -> None:
        """Une authentification réussie remet le compteur à zéro."""

        account = build_test_account(failed_login_attempts=2)
        self.db.scalar.return_value = account

        result = authenticate_account(
            db=self.db,
            registration_number=account.registration_number,
            password="mot-de-passe-correct",
        )

        self.assertIs(result, account)
        self.assertEqual(account.failed_login_attempts, 0)
        self.assertIsNone(account.locked_until)
        self.db.commit.assert_called_once()
        verify_password_mock.assert_called_once()

    @patch("app.services.auth_service.verify_password", return_value=True)
    def test_expired_lock_allows_new_authentication(
        self,
        verify_password_mock: Mock,
    ) -> None:
        """Un verrouillage expiré permet un nouveau cycle de connexion."""

        account = build_test_account(
            failed_login_attempts=MAX_FAILED_LOGIN_ATTEMPTS,
            locked_until=datetime.now(UTC) - timedelta(seconds=1),
        )
        self.db.scalar.return_value = account

        result = authenticate_account(
            db=self.db,
            registration_number=account.registration_number,
            password="mot-de-passe-correct",
        )

        self.assertIs(result, account)
        self.assertEqual(account.failed_login_attempts, 0)
        self.assertIsNone(account.locked_until)
        self.db.commit.assert_called_once()
        verify_password_mock.assert_called_once()
