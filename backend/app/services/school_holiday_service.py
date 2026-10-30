"""Vacances scolaires : saisie par l'administrateur, consultation par tous les rôles.

Les dates ne sont jamais codées en dur : en Guinée, le calendrier du système
français est décalé d'environ une semaine et change chaque année.
"""

from datetime import date
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.postgres_error_message import extract_postgres_error_message
from app.schemas.school_holiday import SchoolHolidayCreate, SchoolHolidayUpdate

_COLUMNS = "id, school_year_id, name, start_date, end_date"


def _translate_integrity_error(error: IntegrityError) -> ValueError:
    """Transforme une violation de contrainte en message lisible pour l'administrateur."""

    technical_message = str(getattr(error, "orig", error))
    if "ex_school_holidays_no_overlap" in technical_message:
        return ValueError("Ces dates chevauchent d'autres vacances de la même année.")
    if "ck_school_holidays_dates" in technical_message:
        return ValueError("La date de fin doit être égale ou postérieure à la date de début.")
    return ValueError(extract_postgres_error_message(error))


def list_school_holidays(
    db: Session,
    school_year_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[dict]:
    """Liste les vacances, éventuellement d'une année ou chevauchant une plage de dates."""

    rows = db.execute(
        text(
            f"""
            SELECT {_COLUMNS}
            FROM school_holidays
            WHERE (CAST(:school_year_id AS uuid) IS NULL OR school_year_id = :school_year_id)
              AND (CAST(:date_from AS date) IS NULL OR end_date >= :date_from)
              AND (CAST(:date_to AS date) IS NULL OR start_date <= :date_to)
            ORDER BY start_date
            """
        ),
        {"school_year_id": school_year_id, "date_from": date_from, "date_to": date_to},
    ).mappings().all()
    return [dict(row) for row in rows]


def create_school_holiday(db: Session, school_year_id: UUID, data: SchoolHolidayCreate) -> dict:
    """Crée des vacances dans une année existante."""

    year_exists = db.execute(
        text("SELECT 1 FROM school_years WHERE id = :id"), {"id": school_year_id}
    ).first()
    if year_exists is None:
        raise LookupError("Année scolaire introuvable.")
    try:
        row = db.execute(
            text(
                f"""
                INSERT INTO school_holidays (school_year_id, name, start_date, end_date)
                VALUES (:school_year_id, :name, :start_date, :end_date)
                RETURNING {_COLUMNS}
                """
            ),
            {"school_year_id": school_year_id, **data.model_dump()},
        ).mappings().one()
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise _translate_integrity_error(error) from error
    return dict(row)


def update_school_holiday(
    db: Session, school_year_id: UUID, holiday_id: UUID, data: SchoolHolidayUpdate
) -> dict:
    """Modifie le nom ou les dates de vacances existantes."""

    changes = data.model_dump(exclude_unset=True, exclude_none=True)
    if not changes:
        raise ValueError("Aucune modification à enregistrer.")
    assignments = ", ".join(f"{column} = :{column}" for column in changes)
    try:
        row = db.execute(
            text(
                f"""
                UPDATE school_holidays SET {assignments}
                WHERE id = :holiday_id AND school_year_id = :school_year_id
                RETURNING {_COLUMNS}
                """
            ),
            {**changes, "holiday_id": holiday_id, "school_year_id": school_year_id},
        ).mappings().one_or_none()
        if row is not None:
            db.commit()
    except IntegrityError as error:
        db.rollback()
        raise _translate_integrity_error(error) from error
    if row is None:
        raise LookupError("Vacances introuvables.")
    return dict(row)


def delete_school_holiday(db: Session, school_year_id: UUID, holiday_id: UUID) -> None:
    """Supprime des vacances saisies par erreur."""

    try:
        deleted = db.execute(
            text(
                """
                DELETE FROM school_holidays
                WHERE id = :holiday_id AND school_year_id = :school_year_id
                RETURNING id
                """
            ),
            {"holiday_id": holiday_id, "school_year_id": school_year_id},
        ).first()
        if deleted is not None:
            db.commit()
    except IntegrityError as error:
        db.rollback()
        raise _translate_integrity_error(error) from error
    if deleted is None:
        raise LookupError("Vacances introuvables.")


def find_holiday_on(db: Session, day: date) -> str | None:
    """Retourne le nom des vacances couvrant ce jour, ou None."""

    return db.execute(
        text(
            """
            SELECT name FROM school_holidays
            WHERE :day BETWEEN start_date AND end_date
            LIMIT 1
            """
        ),
        {"day": day},
    ).scalar_one_or_none()


def ensure_not_on_holiday(db: Session, day: date, action: str) -> None:
    """Refuse une action datée (évaluation, appel) pendant les vacances."""

    holiday_name = find_holiday_on(db, day)
    if holiday_name is not None:
        raise ValueError(
            f"{action} impossible le {day.strftime('%d/%m/%Y')} : "
            f"ce jour tombe pendant les vacances scolaires ({holiday_name})."
        )
