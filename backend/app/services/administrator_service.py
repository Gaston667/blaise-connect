"""Vue enrichie des administrateurs pour l'écran de gestion."""
from sqlalchemy import text
from sqlalchemy.orm import Session


def list_administrators_overview(db: Session, q: str | None = None) -> list[dict]:
    """Liste les administrateurs avec matricule, fonction et statut."""
    sql = """
        SELECT
            ad.id,
            a.registration_number,
            ad.first_name,
            ad.last_name,
            ad.gender,
            ad.email,
            ad.phone,
            ad.hire_date,
            ad.job_title,
            ad.photo_path,
            ad.archived_at,
            a.is_active
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
    return [
        {
            "id": str(row.id),
            "registration_number": row.registration_number,
            "first_name": row.first_name,
            "last_name": row.last_name,
            "gender": row.gender,
            "email": row.email,
            "phone": row.phone,
            "hire_date": row.hire_date,
            "job_title": row.job_title,
            "photo_path": row.photo_path,
            "status": "ACTIVE" if row.archived_at is None and row.is_active else "INACTIVE",
        }
        for row in rows
    ]
