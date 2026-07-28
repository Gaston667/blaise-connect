"""Règles métier de gestion des années scolaires prévues par l'US-003."""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.school_year_already_closed_error import (
    SchoolYearAlreadyClosedError,
)
from app.core.school_year_not_found_error import SchoolYearNotFoundError
from app.core.school_year_periods_mismatch_error import (
    SchoolYearPeriodsMismatchError,
)
from app.core.school_year_confirmation_mismatch_error import (
    SchoolYearConfirmationMismatchError,
)
from app.models.school_year import SchoolYear
from app.models.school_period import SchoolPeriod
from app.schemas.school_year_create import SchoolYearCreate
from app.schemas.school_year_update import SchoolYearUpdate
from app.schemas.school_year_details_update import SchoolYearDetailsUpdate
from app.schemas.school_year_deletion_preview import SchoolYearDeletionPreview


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


def update_school_year(
    db: Session,
    school_year_id: UUID,
    school_year_data: SchoolYearUpdate,
) -> SchoolYear:
    """Modifie les informations d'une année scolaire non clôturée."""

    school_year = get_school_year_by_id(db, school_year_id)

    if school_year.closed_at is not None:
        raise SchoolYearAlreadyClosedError(school_year_id)

    school_year.name = school_year_data.name
    school_year.start_date = school_year_data.start_date
    school_year.end_date = school_year_data.end_date

    first_period_statement = (
        select(SchoolPeriod)
        .where(SchoolPeriod.school_year_id == school_year_id)
        .order_by(SchoolPeriod.start_date)
        .limit(1)
    )
    first_period = db.scalar(first_period_statement)
    if first_period is not None:
        first_period.start_date = school_year_data.start_date

    db.commit()
    db.refresh(school_year)
    return school_year


def update_school_year_details(
    db: Session,
    school_year_id: UUID,
    details_data: SchoolYearDetailsUpdate,
) -> tuple[SchoolYear, list[SchoolPeriod]]:
    """Modifie une année et toutes ses périodes dans une seule transaction.

    Les périodes sont verrouillées pendant l'opération. Leur date de début
    est recalculée dans l'ordre chronologique : début de l'année pour la
    première, puis lendemain de la fin précédente.
    """

    school_year_statement = (
        select(SchoolYear)
        .where(SchoolYear.id == school_year_id)
        .with_for_update()
    )
    school_year = db.scalar(school_year_statement)

    if school_year is None:
        raise SchoolYearNotFoundError(school_year_id)
    if school_year.closed_at is not None:
        raise SchoolYearAlreadyClosedError(school_year_id)

    periods_statement = (
        select(SchoolPeriod)
        .where(SchoolPeriod.school_year_id == school_year_id)
        .order_by(SchoolPeriod.start_date)
        .with_for_update()
    )
    periods = list(db.scalars(periods_statement).all())

    submitted_period_ids = [period.id for period in details_data.periods]
    existing_period_ids = [period.id for period in periods]
    if (
        len(submitted_period_ids) != len(set(submitted_period_ids))
        or set(submitted_period_ids) != set(existing_period_ids)
    ):
        raise SchoolYearPeriodsMismatchError(
            "Le formulaire doit contenir exactement les périodes actuelles de l'année."
        )

    period_updates_by_id = {
        period.id: period
        for period in details_data.periods
    }

    school_year.name = details_data.name
    school_year.start_date = details_data.start_date
    school_year.end_date = details_data.end_date

    next_start_date = details_data.start_date
    for period in periods:
        period_update = period_updates_by_id[period.id]
        if (
            period_update.end_date < next_start_date
            or period_update.end_date > details_data.end_date
        ):
            raise SchoolYearPeriodsMismatchError(
                f"La date de fin de la période « {period_update.name} » est incohérente."
            )

        period.name = period_update.name
        period.start_date = next_start_date
        period.end_date = period_update.end_date
        next_start_date = period_update.end_date + timedelta(days=1)

    db.commit()
    db.refresh(school_year)
    for period in periods:
        db.refresh(period)

    return school_year, periods


def get_school_year_deletion_preview(
    db: Session,
    school_year_id: UUID,
) -> SchoolYearDeletionPreview:
    """Compte les données qui disparaîtraient avec une année non clôturée."""

    school_year = get_school_year_by_id(db, school_year_id)
    if school_year.closed_at is not None:
        raise SchoolYearAlreadyClosedError(school_year_id)

    statement = text(
        """
        SELECT
            (SELECT count(*)
               FROM reporting_periods
              WHERE school_year_id = :school_year_id) AS reporting_periods,
            (SELECT count(*)
               FROM classes
              WHERE school_year_id = :school_year_id) AS classes,
            (SELECT count(*)
               FROM student_enrollments AS enrollment
               JOIN classes AS school_class
                 ON school_class.id = enrollment.class_id
              WHERE school_class.school_year_id = :school_year_id)
                AS student_enrollments,
            (SELECT count(*)
               FROM class_subjects AS class_subject
               JOIN classes AS school_class
                 ON school_class.id = class_subject.class_id
              WHERE school_class.school_year_id = :school_year_id)
                AS class_subjects
        """
    )
    counts = db.execute(
        statement,
        {"school_year_id": school_year_id},
    ).mappings().one()

    return SchoolYearDeletionPreview(
        school_year_id=school_year.id,
        school_year_name=school_year.name,
        reporting_periods=counts["reporting_periods"],
        classes=counts["classes"],
        student_enrollments=counts["student_enrollments"],
        class_subjects=counts["class_subjects"],
    )


def delete_open_school_year(
    db: Session,
    school_year_id: UUID,
    confirmation_name: str,
    administrator_account_id: UUID,
) -> dict[str, int]:
    """Supprime une année non clôturée via la fonction PostgreSQL protégée."""

    school_year = get_school_year_by_id(db, school_year_id)
    if school_year.closed_at is not None:
        raise SchoolYearAlreadyClosedError(school_year_id)
    if confirmation_name != school_year.name:
        raise SchoolYearConfirmationMismatchError

    statement = text(
        """
        SELECT delete_open_school_year(
            :school_year_id,
            :confirmation_name,
            :administrator_account_id
        )
        """
    )
    deleted_counts = db.scalar(
        statement,
        {
            "school_year_id": school_year_id,
            "confirmation_name": confirmation_name,
            "administrator_account_id": administrator_account_id,
        },
    )
    db.commit()
    return deleted_counts
