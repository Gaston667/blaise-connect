"""Tests unitaires du service de gestion des sessions."""

from datetime import UTC, datetime, timedelta
from unittest import TestCase
from unittest.mock import Mock
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.auth_session import AuthSession
from app.services.session_service import (
    hash_session_token,
    revoke_session,
    validate_session,
)


def build_test_session(
    last_activity_at: datetime,
    revoked_at: datetime | None = None,
) -> AuthSession:
    """Construit une session fictive pour les tests."""

    return AuthSession(
        id=uuid4(),
        account_id=uuid4(),
        session_token_hash="a" * 64,
        last_activity_at=last_activity_at,
        revoked_at=revoked_at,
        created_at=last_activity_at - timedelta(minutes=1),
    )


class TestSessionService(TestCase):
    """Vérifie le hachage, l'activité et la révocation des sessions."""

    def setUp(self) -> None:
        """Prépare une session SQLAlchemy simulée pour chaque test."""

        self.db = Mock(spec=Session)

    def test_hash_session_token_returns_sha256_hexadecimal(self) -> None:
        """Le hash d'un jeton contient 64 caractères hexadécimaux."""

        token_hash = hash_session_token("jeton-fictif")

        self.assertEqual(len(token_hash), 64)
        self.assertTrue(all(character in "0123456789abcdef" for character in token_hash))

    def test_active_session_updates_last_activity(self) -> None:
        """Une session active est conservée et son activité est actualisée."""

        previous_activity = datetime.now(UTC) - timedelta(minutes=1)
        auth_session = build_test_session(previous_activity)
        self.db.scalar.return_value = auth_session

        result = validate_session(
            db=self.db,
            session_token="jeton-fictif",
        )

        self.assertIs(result, auth_session)
        self.assertGreater(auth_session.last_activity_at, previous_activity)
        self.assertIsNone(auth_session.revoked_at)
        self.db.commit.assert_called_once()

    def test_inactive_session_is_revoked(self) -> None:
        """Une session inactive depuis plus de 15 minutes est révoquée."""

        auth_session = build_test_session(
            datetime.now(UTC) - timedelta(minutes=16)
        )
        self.db.scalar.return_value = auth_session

        result = validate_session(
            db=self.db,
            session_token="jeton-fictif",
        )

        self.assertIsNone(result)
        self.assertIsNotNone(auth_session.revoked_at)
        self.db.commit.assert_called_once()

    def test_revoke_session_marks_session_as_revoked(self) -> None:
        """La déconnexion renseigne la date de révocation."""

        auth_session = build_test_session(datetime.now(UTC))
        self.db.scalar.return_value = auth_session

        result = revoke_session(
            db=self.db,
            session_token="jeton-fictif",
        )

        self.assertTrue(result)
        self.assertIsNotNone(auth_session.revoked_at)
        self.db.commit.assert_called_once()
