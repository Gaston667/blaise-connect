"""Règles métier de gestion des périodes de bulletin prévues par l'US-003.

L'administrateur choisit uniquement la date de fin d'une période :
ce module calcule sa date de début, conformément à la section 3.4
d'AGENTS.md. PostgreSQL valide ensuite la contiguïté, l'absence de
chevauchement et l'inclusion dans l'année via des triggers différés ;
ce service ne fait que proposer la date cohérente, il ne remplace pas
ces garanties.
"""

from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.reporting_period_not_found_error import (
    ReportingPeriodNotFoundError,
)
from app.services.school_year_service import get_school_year_by_id
from app.models.school_period import SchoolPeriod
from app.schemas.reporting_period_create import ReportingPeriodCreate


def list_reporting_periods(
    db: Session,
    school_year_id: UUID,
) -> list[SchoolPeriod]:
    """Retourne les périodes d'une année, ordonnées par date de début."""

    statement = (
        select(SchoolPeriod)
        .where(SchoolPeriod.school_year_id == school_year_id)
        .order_by(SchoolPeriod.start_date)
    )

    return list(db.scalars(statement).all())


def get_reporting_period_by_id(
    db: Session,
    reporting_period_id: UUID,
) -> SchoolPeriod  :
    """Récupère une période ou lève ReportingPeriodNotFoundError."""

    reporting_period = db.get(SchoolPeriod, reporting_period_id)

    if reporting_period is None:
        raise ReportingPeriodNotFoundError(reporting_period_id)

    return reporting_period


def compute_next_period_start_date(db: Session, school_year_id: UUID):
    """Calcule la date de début de la prochaine période.

    Retourne le début de l'année scolaire s'il n'existe encore aucune
    période, sinon le lendemain de la date de fin de la dernière
    période existante (classée par date de début).
    """

    last_period_statement = (
        select(SchoolPeriod)
        .where(SchoolPeriod.school_year_id == school_year_id)
        .order_by(SchoolPeriod.start_date.desc())
        .limit(1)
    )
    last_period = db.scalar(last_period_statement)

    if last_period is not None:
        return last_period.end_date + timedelta(days=1)

    school_year = get_school_year_by_id(db, school_year_id)
    return school_year.start_date


def create_reporting_period(
    db: Session,
    period_data: ReportingPeriodCreate,
) -> SchoolPeriod:
    """Crée une période après calcul automatique de sa date de début.

    La contiguïté, l'absence de chevauchement et l'inclusion dans les
    bornes de l'année sont vérifiées par des triggers différés côté
    PostgreSQL ; toute violation remonte comme erreur d'intégrité à
    l'appelant.
    """

    start_date = compute_next_period_start_date(db, period_data.school_year_id)

    reporting_period = SchoolPeriod(
        school_year_id=period_data.school_year_id,
        name=period_data.name,
        start_date=start_date,
        end_date=period_data.end_date,
    )

    db.add(reporting_period)
    db.commit()
    db.refresh(reporting_period)

    return reporting_period