"""Règles métier de gestion des années scolaires prévues par l'US-003."""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.school_year_already_closed_error import (
    SchoolYearAlreadyClosedError,
)
from app.core.school_year_not_found_error import SchoolYearNotFoundError
from app.models.school_year import SchoolYear
from app.schemas.school_year_create import SchoolYearCreate


def list_school_years(db: Session) -> list[SchoolYear]:
    """Retourne les années scolaires de la plus récente à la plus ancienne."""

    statement = select(SchoolYear).order_by(SchoolYear.start_date.desc())

    return list(db.scalars(statement).all())


def get_school_year_by_id(db: Session, school_year_id: UUID) -> SchoolYear:
    """Récupère une année scolaire ou lève SchoolYearNotFoundError."""

    school_year = db.get(SchoolYear, school_year_id)

    if school_year is None:
        raise SchoolYearNotFoundError(school_year_id)

    return school_year


def create_school_year(
    db: Session,
    school_year_data: SchoolYearCreate,
) -> SchoolYear:
    """Crée une année scolaire, non courante et ouverte par défaut.

    L'unicité du nom, l'absence de chevauchement (EXCLUDE gist) et la
    cohérence des dates sont garanties par PostgreSQL ; les erreurs
    d'intégrité remontent telles quelles à l'appelant (route HTTP),
    qui les traduit en réponse adaptée.
    """

    school_year = SchoolYear(
        name=school_year_data.name,
        start_date=school_year_data.start_date,
        end_date=school_year_data.end_date,
    )

    db.add(school_year)
    db.commit()
    db.refresh(school_year)

    return school_year


def set_current_school_year(db: Session, school_year_id: UUID) -> SchoolYear:
    """Définit l'année donnée comme courante.

    L'unicité de l'année courante est garantie par l'index unique
    partiel `uq_school_years_one_current` : il faut donc d'abord
    retirer le statut courant de l'année précédente avant d'en
    affecter une nouvelle, dans la même transaction.
    """

    target_year = get_school_year_by_id(db, school_year_id)

    if target_year.closed_at is not None:
        raise SchoolYearAlreadyClosedError(school_year_id)

    previous_current_statement = select(SchoolYear).where(
        SchoolYear.is_current.is_(True)
    )
    previous_current_year = db.scalar(previous_current_statement)

    if previous_current_year is not None and previous_current_year.id != target_year.id:
        previous_current_year.is_current = False
        db.flush()

    target_year.is_current = True

    db.commit()
    db.refresh(target_year)

    return target_year


def close_school_year(
    db: Session,
    school_year_id: UUID,
    closed_by_account_id: UUID,
) -> SchoolYear:
    """Clôture une année scolaire.

    La clôture renseigne `closed_at` et `closed_by_account_id`, retire
    le statut courant, et déclenche côté PostgreSQL la fermeture
    automatique des inscriptions encore ouvertes ainsi que
    l'immutabilité de l'année et de ses données rattachées.
    """

    school_year = get_school_year_by_id(db, school_year_id)

    if school_year.closed_at is not None:
        raise SchoolYearAlreadyClosedError(school_year_id)

    school_year.closed_at = datetime.now(timezone.utc)
    school_year.closed_by_account_id = closed_by_account_id
    school_year.is_current = False

    db.commit()
    db.refresh(school_year)

    return school_year