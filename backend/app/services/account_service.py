"""Règles métier de gestion des comptes prévues par l'US-002."""

from datetime import UTC, datetime

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.account_already_exists_error import (
    AccountAlreadyExistsError,
)
from app.core.invalid_admin_password_error import InvalidAdminPasswordError
from app.core.security import hash_password, verify_password
from app.models.account import Account
from app.models.administrator import Administrator
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.teacher import Teacher
from uuid import UUID

from app.schemas.account_create import AccountCreate
from app.schemas.account_complete_create import AccountCompleteCreate
from app.services.account_storage_service import create_account_storage_directories
from app.services.session_service import revoke_all_sessions_for_account


AccountProfile = Student | Teacher | Administrator | Guardian
AccountWithProfile = tuple[Account, AccountProfile | None]

REGISTRATION_PREFIXES = {
    "ADMIN": "a",
    "TEACHER": "e",
    "STUDENT": "u",
    "GUARDIAN": "p",
}


def calculate_date_code(current_time: datetime) -> int:
    """Combine année, mois et jour UTC dans un code de deux chiffres."""

    short_year = current_time.year % 100
    date_value = short_year * 372 + (current_time.month - 1) * 31 + current_time.day
    return date_value % 100


def calculate_time_code(current_time: datetime) -> int:
    """Combine heure, minute et seconde UTC dans un code de quatre chiffres."""

    seconds_since_midnight = (
        current_time.hour * 3600
        + current_time.minute * 60
        + current_time.second
    )
    return seconds_since_midnight % 10000


def registration_number_exists(db: Session, registration_number: str) -> bool:
    """Indique si le matricule proposé existe déjà."""

    account_id = db.execute(
        select(Account.id).where(
            Account.registration_number == registration_number
        )
    ).scalar_one_or_none()
    return account_id is not None


def generate_registration_number(db: Session, role: str) -> str:
    """Génère un matricule rôle + date sur 2 chiffres + heure sur 4 chiffres."""

    prefix = REGISTRATION_PREFIXES[role]
    db.execute(
        text(
            "SELECT pg_advisory_xact_lock("
            "hashtext('account_registration_' || :prefix)"
            ")"
        ),
        {"prefix": prefix},
    )
    current_time = datetime.now(UTC)
    date_code = calculate_date_code(current_time)
    initial_time_code = calculate_time_code(current_time)

    for offset in range(10000):
        time_code = (initial_time_code + offset) % 10000
        registration_number = f"{prefix}{date_code:02d}{time_code:04d}"
        if not registration_number_exists(db, registration_number):
            return registration_number

    raise ValueError("Aucun matricule disponible pour ce rôle et cette date.")


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

    return {"items": records, "total": len(records)}


def change_account_state(
    db: Session,
    account_id,
    action: str,
) -> AccountWithProfile | None:
    """Désactive, archive ou réactive un compte dans une transaction."""

    account = db.get(Account, account_id)
    if account is None:
        return None

    if action == "deactivate":
        account.is_active = False
    elif action == "archive":
        account.is_active = False
        account.archived_at = datetime.now(UTC)
    elif action == "activate":
        account.is_active = True
        account.archived_at = None
        account.locked_until = None
        account.failed_login_attempts = 0
    else:
        raise ValueError("Action de compte inconnue.")

    profile_models = {
        "STUDENT": Student,
        "TEACHER": Teacher,
        "ADMIN": Administrator,
        "GUARDIAN": Guardian,
    }
    profile_model = profile_models[account.role]
    profile = db.execute(
        select(profile_model).where(profile_model.account_id == account.id)
    ).scalar_one_or_none()

    db.commit()
    db.refresh(account)
    return account, profile


def reset_account_password(
    db: Session,
    account_id,
    new_password: str,
    admin_account: Account,
    admin_password: str,
) -> AccountWithProfile | None:
    """Remplace le mot de passe après confirmation du mot de passe administrateur."""

    if not verify_password(admin_password, admin_account.password_hash):
        raise InvalidAdminPasswordError()

    account = db.get(Account, account_id)
    if account is None:
        return None

    account.password_hash = hash_password(new_password)

    profile_models = {
        "STUDENT": Student,
        "TEACHER": Teacher,
        "ADMIN": Administrator,
        "GUARDIAN": Guardian,
    }
    profile_model = profile_models[account.role]
    profile = db.execute(
        select(profile_model).where(profile_model.account_id == account.id)
    ).scalar_one_or_none()

    # Révoque toutes les sessions actives du compte pour forcer une reconnexion.
    revoke_all_sessions_for_account(db=db, account_id=account.id)

    db.commit()
    db.refresh(account)
    return account, profile


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


def get_account_with_profile_by_id(
    db: Session,
    account_id: UUID,
) -> AccountWithProfile | None:
    """Retourne un compte et son profil à partir de l'identifiant."""

    account = db.get(Account, account_id)
    if account is None:
        return None

    profile_models = {
        "STUDENT": Student,
        "TEACHER": Teacher,
        "ADMIN": Administrator,
        "GUARDIAN": Guardian,
    }
    profile_model = profile_models.get(account.role)
    profile = (
        db.execute(
            select(profile_model).where(profile_model.account_id == account.id)
        ).scalar_one_or_none()
        if profile_model
        else None
    )
    return account, profile


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


def create_account_with_profile(
    db: Session,
    creation_data: AccountCompleteCreate,
) -> AccountWithProfile:
    """Crée le compte et son profil dans une transaction unique."""

    registration_number = (
        creation_data.registration_number
        or generate_registration_number(db=db, role=creation_data.role)
    )

    existing_account = find_account_by_registration_number(
        db=db,
        registration_number=registration_number,
    )
    if existing_account is not None:
        raise AccountAlreadyExistsError(registration_number)

    account = Account(
        registration_number=registration_number,
        password_hash=hash_password(creation_data.password.get_secret_value()),
        role=creation_data.role,
    )
    db.add(account)
    db.flush()

    profile_data = creation_data.profile
    common_fields = {
        "account_id": account.id,
        "first_name": profile_data.first_name.strip(),
        "last_name": profile_data.last_name.strip(),
        "gender": profile_data.gender,
        "nationality": profile_data.nationality,
        "email": profile_data.email,
        "phone": profile_data.phone,
        "address": profile_data.address,
    }

    if creation_data.role == "STUDENT":
        profile = Student(
            **common_fields,
            birth_date=profile_data.birth_date,
            birth_place=profile_data.birth_place,
            admission_date=profile_data.admission_date,
            previous_establishment=profile_data.previous_establishment,
            medical_condition=profile_data.medical_condition,
            is_enrolled_in_cned=profile_data.is_enrolled_in_cned,
        )
    elif creation_data.role == "TEACHER":
        profile = Teacher(
            **common_fields,
            birth_date=profile_data.birth_date,
            hire_date=profile_data.hire_date,
            qualification=profile_data.qualification,
        )
    elif creation_data.role == "ADMIN":
        profile = Administrator(
            **common_fields,
            hire_date=profile_data.hire_date,
            job_title=profile_data.job_title.strip(),
        )
    else:
        profile = Guardian(
            **common_fields,
            occupation=profile_data.occupation,
            employer=profile_data.employer,
        )

    db.add(profile)
    create_account_storage_directories(account.registration_number)
    db.commit()
    db.refresh(account)
    db.refresh(profile)
    return account, profile
