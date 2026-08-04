"""Routes HTTP pour la gestion de l'emploi du temps (admin)."""

from fastapi import APIRouter

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.room_create import RoomCreate
from app.schemas.timetable_slot_create import TimetableSlotCreate
from app.services import timetable_service

router = APIRouter(tags=["timetables"])


@router.get("/rooms")
def get_rooms(db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Liste les salles actives."""
    return timetable_service.list_rooms(db=db)


@router.post("/rooms", status_code=201)
def post_room(payload: RoomCreate, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Crée une salle."""
    return timetable_service.create_room(db=db, name=payload.name, capacity=payload.capacity)


@router.get("/school-classes/{class_id}/timetable")
def get_class_timetable(class_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Retourne les créneaux de la classe."""
    return timetable_service.get_class_timetable(db=db, class_id=class_id)


@router.post("/school-classes/{class_id}/timetable", status_code=201)
def post_class_timetable_slot(
    class_id: str,
    payload: TimetableSlotCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Ajoute un créneau régulier à l'emploi du temps de la classe."""
    return timetable_service.create_timetable_slot(
        db=db,
        class_subject_id=payload.class_subject_id,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        room_id=payload.room_id,
    )


@router.delete("/school-classes/{class_id}/timetable", status_code=204)
def delete_class_timetable(class_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Supprime tous les créneaux de la classe, avant régénération."""
    timetable_service.clear_class_timetable(db=db, class_id=class_id)


@router.delete("/timetable-slots/{slot_id}", status_code=204)
def delete_timetable_slot(slot_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Supprime un créneau précis."""
    timetable_service.delete_timetable_slot(db=db, slot_id=slot_id)
