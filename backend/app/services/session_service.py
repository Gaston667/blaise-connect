"""Création, vérification et révocation des sessions utilisateur."""

from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.auth_session import AuthSession


SESSION_INACTIVITY_DURATION = timedelta(minutes=15)


def hash_session_token(session_token: str) -> str:
    """Transforme un jeton de session en hash SHA-256."""

    return sha256(session_token.encode("utf-8")).hexdigest()


def create_session(db: Session, account_id: UUID) -> str:
    """Crée une session et retourne son jeton brut au navigateur."""

    session_token = token_urlsafe(32)
    session_token_hash = hash_session_token(session_token)

    auth_session = AuthSession(
        account_id=account_id,
        session_token_hash=session_token_hash,
    )

    db.add(auth_session)
    db.commit()

    return session_token


def validate_session(
    db: Session,
    session_token: str,
) -> AuthSession | None:
    """Vérifie une session et actualise sa dernière activité."""

    session_token_hash = hash_session_token(session_token)

    statement = select(AuthSession).where(
        AuthSession.session_token_hash == session_token_hash
    )

    auth_session = db.scalar(statement)

    if auth_session is None:
        return None

    if auth_session.revoked_at is not None:
        return None

    current_time = datetime.now(UTC)
    inactive_duration = current_time - auth_session.last_activity_at

    if inactive_duration >= SESSION_INACTIVITY_DURATION:
        auth_session.revoked_at = current_time
        db.commit()
        return None

    auth_session.last_activity_at = current_time
    db.commit()

    return auth_session


def revoke_session(
    db: Session,
    session_token: str,
) -> bool:
    """Révoque une session lors de la déconnexion."""

    session_token_hash = hash_session_token(session_token)

    statement = select(AuthSession).where(
        AuthSession.session_token_hash == session_token_hash
    )

    auth_session = db.scalar(statement)

    if auth_session is None:
        return False

    if auth_session.revoked_at is not None:
        return False

    auth_session.revoked_at = datetime.now(UTC)
    db.commit()

    return True
