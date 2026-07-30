"""Règles métier de gestion des responsables légaux et de leurs liens aux élèves."""
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.guardian import Guardian
from app.schemas.guardian_create import GuardianCreate
from app.schemas.guardian_update import GuardianUpdate, GuardianLinkUpdate
RELATIONSHIP_LABELS = {
    "PERE": "Père",
    "MERE": "Mère",
    "TUTEUR": "Tuteur",
    "AUTRE": "Autre",
}

def list_guardians(db: Session, q: str | None = None) -> list[Guardian]:
    """Liste les responsables, avec recherche optionnelle (pour rattacher un responsable existant à un autre enfant)."""
    sql = "SELECT * FROM guardians WHERE 1=1"
    params: dict = {}
    if q:
        sql += " AND (first_name ILIKE :q OR last_name ILIKE :q OR phone ILIKE :q)"
        params["q"] = f"%{q}%"
    sql += " ORDER BY last_name, first_name LIMIT 50"
    rows = db.execute(text(sql), params).all()
    return [dict(row._mapping) for row in rows]


def create_guardian(db: Session, data: GuardianCreate) -> dict:
    """Crée un responsable, et le lie immédiatement à un élève si demandé."""
    guardian = Guardian(
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        email=data.email,
        address=data.address,
        occupation=data.occupation,
        employer=data.employer,
    )
    db.add(guardian)
    db.flush()

    if data.student_id:
        if not data.relationship:
            raise ValueError("Le lien de parenté (relationship) est requis pour rattacher ce responsable à un élève.")
        link_guardian_to_student(
            db=db,
            student_id=data.student_id,
            guardian_id=str(guardian.id),
            relationship=data.relationship,
            is_primary_contact=data.is_primary_contact,
            _skip_commit=True,
        )

    db.commit()
    db.refresh(guardian)
    return {
        "id": guardian.id,
        "account_id": guardian.account_id,
        "first_name": guardian.first_name,
        "last_name": guardian.last_name,
        "email": guardian.email,
        "phone": guardian.phone,
        "address": guardian.address,
        "occupation": guardian.occupation,
        "employer": guardian.employer,
        "created_at": guardian.created_at,
        "updated_at": guardian.updated_at,
    }


def update_guardian(db: Session, guardian_id: str, data: GuardianUpdate) -> dict | None:
    guardian = db.get(Guardian, guardian_id)
    if not guardian:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(guardian, field, value)
    db.commit()
    db.refresh(guardian)
    return {
        "id": guardian.id,
        "account_id": guardian.account_id,
        "first_name": guardian.first_name,
        "last_name": guardian.last_name,
        "email": guardian.email,
        "phone": guardian.phone,
        "address": guardian.address,
        "occupation": guardian.occupation,
        "employer": guardian.employer,
        "created_at": guardian.created_at,
        "updated_at": guardian.updated_at,
    }


def link_guardian_to_student(
    db: Session,
    student_id: str,
    guardian_id: str,
    relationship: str,
    is_primary_contact: bool = False,
    _skip_commit: bool = False,
) -> dict:
    """Rattache un responsable existant à un élève."""
    if is_primary_contact:
        db.execute(
            text(
                "UPDATE student_guardian_links SET is_primary_contact = false "
                "WHERE student_id = :student_id"
            ),
            {"student_id": student_id},
        )

    row = db.execute(
        text(
            """
            INSERT INTO student_guardian_links (student_id, guardian_id, relationship, is_primary_contact)
            VALUES (:student_id, :guardian_id, :relationship, :is_primary_contact)
            RETURNING id
            """
        ),
        {
            "student_id": student_id,
            "guardian_id": guardian_id,
            "relationship": relationship,
            "is_primary_contact": is_primary_contact,
        },
    ).first()

    if not _skip_commit:
        db.commit()

    return {"link_id": row.id}


def list_guardians_for_student(db: Session, student_id: str) -> list[dict]:
    """Liste les responsables rattachés à un élève, avec les détails du lien."""
    sql = text(
        """
        SELECT
            g.id, g.account_id, g.first_name, g.last_name, g.email, g.phone,
            g.address, g.occupation, g.employer, g.created_at, g.updated_at,
            l.id as link_id, l.relationship, l.is_primary_contact
        FROM student_guardian_links l
        JOIN guardians g ON g.id = l.guardian_id
        WHERE l.student_id = :student_id
        ORDER BY l.is_primary_contact DESC, g.last_name
        """
    )
    rows = db.execute(sql, {"student_id": student_id}).all()
    results = []
    for row in rows:
        record = dict(row._mapping)
        record["relationship_label"] = RELATIONSHIP_LABELS.get(record["relationship"], record["relationship"])
        results.append(record)
    return results


def update_guardian_link(db: Session, student_id: str, guardian_id: str, data: GuardianLinkUpdate) -> dict | None:
    """Met à jour la relation (type de lien / contact principal) pour un couple élève-responsable."""
    updates = data.model_dump(exclude_unset=True)
    if not updates:
        return {"updated": False}

    if updates.get("is_primary_contact"):
        db.execute(
            text("UPDATE student_guardian_links SET is_primary_contact = false WHERE student_id = :student_id"),
            {"student_id": student_id},
        )

    set_clauses = ", ".join(f"{field} = :{field}" for field in updates)
    params = {**updates, "student_id": student_id, "guardian_id": guardian_id}

    result = db.execute(
        text(
            f"UPDATE student_guardian_links SET {set_clauses} "
            "WHERE student_id = :student_id AND guardian_id = :guardian_id RETURNING id"
        ),
        params,
    ).first()
    db.commit()
    return {"link_id": result.id} if result else None


def unlink_guardian_from_student(db: Session, student_id: str, guardian_id: str) -> bool:
    """Retire le lien entre un élève et un responsable (ne supprime pas le responsable)."""
    result = db.execute(
        text(
            "DELETE FROM student_guardian_links "
            "WHERE student_id = :student_id AND guardian_id = :guardian_id RETURNING id"
        ),
        {"student_id": student_id, "guardian_id": guardian_id},
    ).first()
    db.commit()
    return result is not None
def get_guardian_detail(db: Session, guardian_id: str) -> dict | None:
    """Vue détaillée d'un responsable : profil + élèves rattachés."""
    guardian_row = db.execute(
        text(
            """
            SELECT id, account_id, first_name, last_name, email, phone,
                   address, occupation, employer, created_at, updated_at
            FROM guardians WHERE id = :id
            """
        ),
        {"id": guardian_id},
    ).first()

    if not guardian_row:
        return None

    students_rows = db.execute(
        text(
            """
            SELECT
                s.id, s.first_name, s.last_name, s.status,
                a.registration_number,
                l.relationship, l.is_primary_contact,
                cl.name AS level_name, c.group_label
            FROM student_guardian_links l
            JOIN students s ON s.id = l.student_id
            JOIN accounts a ON a.id = s.account_id
            LEFT JOIN LATERAL (
                SELECT class_id FROM student_enrollments se
                WHERE se.student_id = s.id AND se.end_date IS NULL LIMIT 1
            ) se ON true
            LEFT JOIN classes c ON c.id = se.class_id
            LEFT JOIN class_levels cl ON cl.id = c.class_level_id
            WHERE l.guardian_id = :guardian_id
            ORDER BY s.last_name
            """
        ),
        {"guardian_id": guardian_id},
    ).all()

    return {
        "id": guardian_row.id,
        "account_id": guardian_row.account_id,
        "first_name": guardian_row.first_name,
        "last_name": guardian_row.last_name,
        "email": guardian_row.email,
        "phone": guardian_row.phone,
        "address": guardian_row.address,
        "occupation": guardian_row.occupation,
        "employer": guardian_row.employer,
        "created_at": guardian_row.created_at,
        "updated_at": guardian_row.updated_at,
        "students": [
            {
                "id": str(row.id),
                "first_name": row.first_name,
                "last_name": row.last_name,
                "registration_number": row.registration_number,
                "status": row.status,
                "relationship": row.relationship,
                "relationship_label": RELATIONSHIP_LABELS.get(row.relationship, row.relationship),
                "is_primary_contact": row.is_primary_contact,
                "class_name": f"{row.level_name} {row.group_label}" if row.level_name else None,
            }
            for row in students_rows
        ],
    }