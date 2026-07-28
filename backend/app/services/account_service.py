"""Règles métier de gestion des comptes prévues par l'US-002."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.account_already_exists_error import (
    AccountAlreadyExistsError,
)
from app.core.security import hash_password
from app.models.account import Account
from app.models.administrator import Administrator
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.teacher import Teacher
from app.schemas.account_create import AccountCreate


AccountProfile = Student | Teacher | Administrator | Guardian
AccountWithProfile = tuple[Account, AccountProfile | None]


def select_account_profile(
    account: Account,
    student: Student | None,
    teacher: Teacher | None,
    administrator: Administrator | None,
    guardian: Guardian | None,
) -> AccountProfile | None:
    """Sélectionne uniquement le profil correspondant au rôle du compte."""

    profiles_by_role = {
        "STUDENT": student,
        "TEACHER": teacher,
        "ADMIN": administrator,
        "GUARDIAN": guardian,
    }
    return profiles_by_role.get(account.role)


def list_accounts(db: Session) -> list[AccountWithProfile]:
    """Retourne les comptes avec leur profil non sensible éventuel."""

    statement = (
        select(Account, Student, Teacher, Administrator, Guardian)
        .outerjoin(Student, Student.account_id == Account.id)
        .outerjoin(Teacher, Teacher.account_id == Account.id)
        .outerjoin(Administrator, Administrator.account_id == Account.id)
        .outerjoin(Guardian, Guardian.account_id == Account.id)
        .order_by(Account.created_at.desc())
    )

    records: list[AccountWithProfile] = []
    for account, student, teacher, administrator, guardian in db.execute(statement):
        profile = select_account_profile(
            account=account,
            student=student,
            teacher=teacher,
            administrator=administrator,
            guardian=guardian,
        )
        records.append((account, profile))

    return records


def find_account_by_registration_number(
    db: Session,
    registration_number: str,
) -> Account | None:
    """Recherche un compte à partir de son matricule."""

    statement = (
        select(Account)
        .where(Account.registration_number == registration_number)
    )

    return db.scalar(statement)


def create_account(
    db: Session,
    account_data: AccountCreate,
) -> Account:
    """Crée un compte après validation et hachage du mot de passe."""

    existing_account = find_account_by_registration_number(
        db=db,
        registration_number=account_data.registration_number,
    )

    if existing_account is not None:
        raise AccountAlreadyExistsError(
            account_data.registration_number
        )

    clear_password = account_data.password.get_secret_value()
    password_hash = hash_password(clear_password)

    account = Account(
        registration_number=account_data.registration_number,
        password_hash=password_hash,
        role=account_data.role,
    )

    db.add(account)
    db.commit()
    db.refresh(account)

    return account
