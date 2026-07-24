"""Configuration de SQLAlchemy et des sessions PostgreSQL."""

import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import Session, sessionmaker


def build_database_url() -> URL:
    """Construit l'adresse PostgreSQL à partir des variables d'environnement."""

    return URL.create(
        drivername="postgresql+psycopg",
        username=os.environ["POSTGRES_USER"],
        password=os.environ["POSTGRES_PASSWORD"],
        host=os.environ["POSTGRES_HOST"],
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.environ["POSTGRES_DB"],
    )


# L'engine gère les connexions entre SQLAlchemy et PostgreSQL.
# pool_pre_ping vérifie une connexion avant de la réutiliser.
engine = create_engine(build_database_url(), pool_pre_ping=True)

# La fabrique crée une nouvelle session pour chaque requête HTTP.
session_factory = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
)


def get_db() -> Generator[Session, None, None]:
    """Fournit une session à FastAPI puis la ferme après la requête."""

    database_session = session_factory()

    try:
        yield database_session
    finally:
        database_session.close()
