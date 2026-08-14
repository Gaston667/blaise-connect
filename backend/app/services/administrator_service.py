"""Vue enrichie des administrateurs pour l'écran de gestion."""
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.administrator import Administrator
from app.schemas.administrator_update import AdministratorUpdate


def list_administrators_overview(db: Session, q: str | None = None) -> list[dict]:
    """Liste les administrateurs avec matricule, fonction et statut."""
    sql = """
        SELECT
            ad.id,
            ad.account_id,
            a.registration_number,
            ad.first_name,
            ad.last_name,
            ad.gender,
            ad.email,
            ad.phone,
            ad.address,
            ad.hire_date,
            ad.job_title,
            ad.photo_path,
            ad.archived_at,
            a.is_active,
            a.created_at AS account_created_at,
            a.last_login_at
        FROM administrators ad
        JOIN accounts a ON a.id = ad.account_id
        WHERE 1 = 1
    """
    params: dict = {}
    if q:
        sql += " AND (ad.first_name ILIKE :q OR ad.last_name ILIKE :q OR a.registration_number ILIKE :q)"
        params["q"] = f"%{q}%"
    sql += " ORDER BY ad.last_name, ad.first_name"

    rows = db.execute(text(sql), params).all()
    return [_row_to_overview(row) for row in rows]


def get_administrator_overview(db: Session, administrator_id: str) -> dict | None:
    """Retourne la vue enrichie d'un seul administrateur, ou None s'il n'existe pas."""
    row = db.execute(
        text(
            """
            SELECT
                ad.id, ad.account_id, a.registration_number, ad.first_name, ad.last_name, ad.gender,
                ad.email, ad.phone, ad.address, ad.hire_date, ad.job_title, ad.photo_path,
                ad.archived_at, a.is_active, a.created_at AS account_created_at, a.last_login_at
            FROM administrators ad
            JOIN accounts a ON a.id = ad.account_id
            WHERE ad.id = :administrator_id
            """
        ),
        {"administrator_id": administrator_id},
    ).first()

    if row is None:
        return None

    return _row_to_overview(row)


def _row_to_overview(row) -> dict:
    return {
        "id": str(row.id),
        "account_id": str(row.account_id),
        "registration_number": row.registration_number,
        "first_name": row.first_name,
        "last_name": row.last_name,
        "gender": row.gender,
        "email": row.email,
        "phone": row.phone,
        "address": row.address,
        "hire_date": row.hire_date,
        "job_title": row.job_title,
        "photo_path": row.photo_path,
        "status": "ACTIVE" if row.archived_at is None and row.is_active else "INACTIVE",
        "account_created_at": row.account_created_at,
        "last_login_at": row.last_login_at,
    }


def update_administrator(
    db: Session,
    administrator_id: str,
    data: AdministratorUpdate,
) -> Administrator | None:
    """Met à jour le profil d'un administrateur existant."""
    administrator = db.get(Administrator, administrator_id)
    if administrator is None:
        return None
    for field_name, field_value in data.model_dump(exclude_unset=True).items():
        setattr(administrator, field_name, field_value)
    db.commit()
    db.refresh(administrator)
    return administrator
