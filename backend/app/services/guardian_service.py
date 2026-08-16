"""Règles métier de gestion des responsables et de leurs liens aux élèves."""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.guardian import Guardian
from app.schemas.guardian_create import GuardianCreate
from app.schemas.guardian_detail import GuardianDetail
from app.schemas.guardian_link_create import GuardianLinkCreate
from app.schemas.guardian_link_update import GuardianLinkUpdate
from app.schemas.guardian_update import GuardianUpdate


RELATIONSHIP_LABELS = {
    "FATHER": "Père",
    "MOTHER": "Mère",
    "OTHER": "Autre",
}


def _guardian_to_dict(guardian: Guardian) -> dict:
    """Transforme un modèle Guardian en réponse non sensible."""

    return {
        "id": guardian.id,
        "account_id": guardian.account_id,
        "first_name": guardian.first_name,
        "last_name": guardian.last_name,
        "gender": guardian.gender,
        "nationality": guardian.nationality,
        "email": guardian.email,
        "phone": guardian.phone,
        "address": guardian.address,
        "occupation": guardian.occupation,
        "employer": guardian.employer,
        "photo_path": guardian.photo_path,
        "archived_at": guardian.archived_at,
        "created_at": guardian.created_at,
        "updated_at": guardian.updated_at,
    }


def _normalize_relationship(
    relationship_type: str,
    relationship_details: str | None,
) -> tuple[str, str | None]:
    """Normalise et valide la description d'une relation familiale."""

    if relationship_type not in RELATIONSHIP_LABELS:
        raise ValueError("Le type de relation doit être FATHER, MOTHER ou OTHER.")

    details = relationship_details.strip() if relationship_details else None
    if relationship_type == "OTHER" and not details:
        raise ValueError("Précisez le lien lorsque le type est OTHER.")
    if relationship_type != "OTHER" and details:
        raise ValueError("La précision du lien est réservée au type OTHER.")
    return relationship_type, details


def _insert_guardian_link(
    db: Session,
    student_id: str,
    guardian_id: str,
    data: GuardianLinkCreate,
) -> dict:
    """Insère l'association dans la transaction courante sans la valider."""

    relationship_type, relationship_details = _normalize_relationship(
        data.relationship_type,
        data.relationship_details,
    )

    row = db.execute(
        text(
            """
            INSERT INTO student_guardians (
                student_id,
                guardian_id,
                relationship_type,
                relationship_details,
                is_legal_guardian,
                is_emergency_contact
            )
            VALUES (
                :student_id,
                :guardian_id,
                :relationship_type,
                :relationship_details,
                :is_legal_guardian,
                :is_emergency_contact
            )
            RETURNING
                student_id,
                guardian_id,
                relationship_type,
                relationship_details,
                is_legal_guardian,
                is_emergency_contact
            """
        ),
        {
            "student_id": student_id,
            "guardian_id": guardian_id,
            "relationship_type": relationship_type,
            "relationship_details": relationship_details,
            "is_legal_guardian": data.is_legal_guardian,
            "is_emergency_contact": data.is_emergency_contact,
        },
    ).mappings().one()
    return dict(row)


def list_guardians(db: Session, q: str | None = None) -> list[dict]:
    """Liste au maximum cinquante responsables avec une recherche facultative."""

    normalized_query = q.strip() if q and q.strip() else None
    sql = """
        SELECT
            id,
            account_id,
            first_name,
            last_name,
            gender,
            nationality,
            email,
            phone,
            address,
            occupation,
            employer,
            photo_path,
            archived_at,
            created_at,
            updated_at
        FROM guardians
        WHERE 1 = 1
    """
    params: dict = {}
    if normalized_query:
        sql += """
            AND (
                first_name ILIKE :search
                OR last_name ILIKE :search
                OR phone ILIKE :search
                OR email ILIKE :search
            )
        """
        params["search"] = f"%{normalized_query}%"
    sql += " ORDER BY last_name, first_name LIMIT 50"
    rows = db.execute(text(sql), params).mappings()
    return [dict(row) for row in rows]


def create_guardian(db: Session, data: GuardianCreate) -> dict:
    """Crée un responsable et, si demandé, son lien dans une transaction."""

    guardian = Guardian(
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        gender=data.gender,
        nationality=data.nationality,
        email=data.email,
        address=data.address,
        occupation=data.occupation,
        employer=data.employer,
    )
    db.add(guardian)
    db.flush()

    if data.student_id is not None:
        link_data = GuardianLinkCreate(
            relationship_type=data.relationship_type,
            relationship_details=data.relationship_details,
            is_legal_guardian=data.is_legal_guardian,
            is_emergency_contact=data.is_emergency_contact,
        )
        _insert_guardian_link(
            db=db,
            student_id=data.student_id,
            guardian_id=str(guardian.id),
            data=link_data,
        )

    db.commit()
    db.refresh(guardian)
    return _guardian_to_dict(guardian)


def update_guardian(
    db: Session,
    guardian_id: str,
    data: GuardianUpdate,
) -> dict | None:
    """Met à jour les informations personnelles d'un responsable."""

    guardian = db.get(Guardian, guardian_id)
    if guardian is None:
        return None

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(guardian, field, value)

    db.commit()
    db.refresh(guardian)
    return _guardian_to_dict(guardian)


def link_guardian_to_student(
    db: Session,
    student_id: str,
    guardian_id: str,
    data: GuardianLinkCreate,
) -> dict:
    """Associe un responsable existant à un élève."""

    link = _insert_guardian_link(
        db=db,
        student_id=student_id,
        guardian_id=guardian_id,
        data=data,
    )
    db.commit()
    return link


def list_guardians_for_student(db: Session, student_id: str) -> list[dict]:
    """Liste les responsables d'un élève avec les propriétés de chaque lien."""

    rows = db.execute(
        text(
            """
            SELECT
                g.id,
                g.account_id,
                g.first_name,
                g.last_name,
                g.gender,
                g.nationality,
                g.email,
                g.phone,
                g.address,
                g.occupation,
                g.employer,
                g.photo_path,
                g.archived_at,
                g.created_at,
                g.updated_at,
                sg.relationship_type,
                sg.relationship_details,
                sg.is_legal_guardian,
                sg.is_emergency_contact
            FROM student_guardians AS sg
            JOIN guardians AS g ON g.id = sg.guardian_id
            WHERE sg.student_id = :student_id
            ORDER BY g.last_name, g.first_name
            """
        ),
        {"student_id": student_id},
    ).mappings()

    results: list[dict] = []
    for row in rows:
        record = dict(row)
        record["relationship_label"] = RELATIONSHIP_LABELS[record["relationship_type"]]
        results.append(record)
    return results


def update_guardian_link(
    db: Session,
    student_id: str,
    guardian_id: str,
    data: GuardianLinkUpdate,
) -> dict | None:
    """Met à jour une association en conservant une requête SQL statique."""

    current = db.execute(
        text(
            """
            SELECT
                relationship_type,
                relationship_details,
                is_legal_guardian,
                is_emergency_contact
            FROM student_guardians
            WHERE student_id = :student_id
              AND guardian_id = :guardian_id
            """
        ),
        {"student_id": student_id, "guardian_id": guardian_id},
    ).mappings().first()
    if current is None:
        return None

    updates = data.model_dump(exclude_unset=True)
    relationship_type = updates.get("relationship_type", current["relationship_type"])
    relationship_details = updates.get(
        "relationship_details",
        current["relationship_details"],
    )
    relationship_type, relationship_details = _normalize_relationship(
        relationship_type,
        relationship_details,
    )
    is_legal_guardian = updates.get(
        "is_legal_guardian",
        current["is_legal_guardian"],
    )
    is_emergency_contact = updates.get(
        "is_emergency_contact",
        current["is_emergency_contact"],
    )

    row = db.execute(
        text(
            """
            UPDATE student_guardians
            SET
                relationship_type = :relationship_type,
                relationship_details = :relationship_details,
                is_legal_guardian = :is_legal_guardian,
                is_emergency_contact = :is_emergency_contact
            WHERE student_id = :student_id
              AND guardian_id = :guardian_id
            RETURNING
                student_id,
                guardian_id,
                relationship_type,
                relationship_details,
                is_legal_guardian,
                is_emergency_contact
            """
        ),
        {
            "student_id": student_id,
            "guardian_id": guardian_id,
            "relationship_type": relationship_type,
            "relationship_details": relationship_details,
            "is_legal_guardian": is_legal_guardian,
            "is_emergency_contact": is_emergency_contact,
        },
    ).mappings().one()
    db.commit()
    return dict(row)


def unlink_guardian_from_student(
    db: Session,
    student_id: str,
    guardian_id: str,
) -> bool:
    """Supprime seulement l'association, jamais le dossier du responsable."""

    deleted_link = db.execute(
        text(
            """
            DELETE FROM student_guardians
            WHERE student_id = :student_id
              AND guardian_id = :guardian_id
            RETURNING student_id
            """
        ),
        {"student_id": student_id, "guardian_id": guardian_id},
    ).first()
    db.commit()
    return deleted_link is not None


def get_guardian_detail(db: Session, guardian_id: str) -> dict | None:
    """Retourne la fiche détaillée d'un responsable avec tous ses élèves."""

    guardian = db.execute(
        text(
            """
            SELECT
                id,
                account_id,
                first_name,
                last_name,
                gender,
                nationality,
                email,
                phone,
                address,
                occupation,
                employer,
                photo_path,
                archived_at,
                created_at,
                updated_at
            FROM guardians
            WHERE id = :guardian_id
            """
        ),
        {"guardian_id": guardian_id},
    ).mappings().first()
    if guardian is None:
        return None

    student_rows = db.execute(
        text(
            """
            SELECT
                s.id,
                s.first_name,
                s.last_name,
                a.registration_number,
                s.birth_date,
                s.photo_path,
                s.status,
                sg.relationship_type AS relationship,
                sg.relationship_type,
                sg.relationship_details,
                sg.is_legal_guardian,
                sg.is_emergency_contact,
                CASE
                    WHEN sg.relationship_type = 'FATHER' THEN 'Père'
                    WHEN sg.relationship_type = 'MOTHER' THEN 'Mère'
                    ELSE COALESCE(sg.relationship_details, 'Autre')
                END AS relationship_label,
                CONCAT_WS(' ', cl.name, NULLIF(c.group_label, '')) AS class_name,
                sy.name AS school_year_name
            FROM student_guardians sg
            JOIN students s ON s.id = sg.student_id
            LEFT JOIN accounts a ON a.id = s.account_id
            LEFT JOIN LATERAL (
                SELECT se.class_id
                FROM student_enrollments se
                WHERE se.student_id = s.id
                  AND se.end_date IS NULL
                LIMIT 1
            ) current_enrollment ON true
            LEFT JOIN classes c ON c.id = current_enrollment.class_id
            LEFT JOIN class_levels cl ON cl.id = c.class_level_id
            LEFT JOIN school_years sy ON sy.id = c.school_year_id
            WHERE sg.guardian_id = :guardian_id
            ORDER BY s.last_name, s.first_name
            """
        ),
        {"guardian_id": guardian_id},
    ).mappings().all()

    detail = dict(guardian)
    students: list[dict] = []
    for row in student_rows:
        student = dict(row)
        student["id"] = str(student["id"])
        students.append(student)
    detail["students"] = students
    return detail
