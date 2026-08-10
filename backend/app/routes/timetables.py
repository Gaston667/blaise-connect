"""Routes HTTP pour la gestion de l'emploi du temps (admin)."""

from fastapi import APIRouter, HTTPException, status

from app.core.authentication import CurrentAdminDependency, DatabaseSession
from app.schemas.room_create import RoomCreate
from app.schemas.special_course_create import SpecialCourseCreate
from app.schemas.break_schedule_create import BreakScheduleCreate
from app.schemas.school_day_schedule_upsert import SchoolDayScheduleUpsert
from app.schemas.timetable_generation_request import TimetableGenerationRequest
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


@router.get("/teacher-busy-slots")
def get_teacher_busy_slots(db: DatabaseSession, current_admin: CurrentAdminDependency, exclude_class_id: str | None = None):
    """Retourne les créneaux déjà occupés par chaque enseignant, hors de la classe donnée."""
    return timetable_service.get_teacher_busy_slots(db=db, exclude_class_id=exclude_class_id)


@router.get("/school-years/{school_year_id}/day-schedules")
def get_school_day_schedules(school_year_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Liste les horaires et pauses configurés pour une année scolaire."""
    return timetable_service.list_school_day_schedules(db=db, school_year_id=school_year_id)


@router.put("/school-years/{school_year_id}/day-schedules")
def put_school_day_schedule(
    school_year_id: str,
    payload: SchoolDayScheduleUpsert,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Crée ou modifie l'horaire d'un cycle pour une journée."""
    return timetable_service.upsert_school_day_schedule(db=db, school_year_id=school_year_id, payload=payload)


@router.post("/break-schedules", status_code=201)
def post_break_schedule(payload: BreakScheduleCreate, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Ajoute une pause à une journée scolaire configurée."""
    return timetable_service.create_break(db=db, payload=payload)


@router.delete("/break-schedules/{break_id}", status_code=204)
def delete_break_schedule(break_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Supprime une pause encore modifiable."""
    timetable_service.delete_break(db=db, break_id=break_id)


@router.get("/school-classes/{class_id}/timetable/configuration")
def get_timetable_configuration(class_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Retourne les horaires et volumes horaires applicables à une classe."""
    return timetable_service.get_class_timetable_configuration(db=db, class_id=class_id)


@router.post("/school-classes/{class_id}/timetable/generate", status_code=201)
def post_timetable_generation(
    class_id: str,
    payload: TimetableGenerationRequest,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Génère un brouillon à partir des horaires, pauses et volumes configurés."""
    return timetable_service.generate_timetable(
        db=db,
        class_id=class_id,
        requirements=payload.requirements,
        generated_by_account_id=current_admin.id,
    )


@router.post("/school-classes/{class_id}/timetable/validate")
def post_timetable_validation(class_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Valide le brouillon courant de la classe."""
    return timetable_service.validate_timetable(
        db=db,
        class_id=class_id,
        validated_by_account_id=current_admin.id,
    )


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
    try:
        return timetable_service.create_timetable_slot(
            db=db,
            class_id=class_id,
            class_subject_id=payload.class_subject_id,
            day_of_week=payload.day_of_week,
            start_time=payload.start_time,
            end_time=payload.end_time,
            room_id=payload.room_id,
            created_by_account_id=current_admin.id,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        ) from error


@router.delete("/school-classes/{class_id}/timetable", status_code=204)
def delete_class_timetable(class_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Supprime tous les créneaux de la classe, avant régénération."""
    timetable_service.clear_class_timetable(db=db, class_id=class_id)


@router.delete("/timetable-slots/{slot_id}", status_code=204)
def delete_timetable_slot(slot_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Supprime un créneau précis."""
    timetable_service.delete_timetable_slot(db=db, slot_id=slot_id)


@router.get("/school-classes/{class_id}/special-courses")
def get_class_special_courses(class_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Liste les cours particuliers des élèves de la classe."""
    return timetable_service.list_class_special_courses(db=db, class_id=class_id)


@router.post("/school-classes/{class_id}/special-courses", status_code=201)
def post_special_course(
    class_id: str,
    payload: SpecialCourseCreate,
    db: DatabaseSession,
    current_admin: CurrentAdminDependency,
):
    """Ajoute un cours particulier sans plage horaire imposée."""
    return timetable_service.create_special_course(
        db=db,
        class_id=class_id,
        student_id=payload.student_id,
        subject_id=payload.subject_id,
        title=payload.title,
        day_of_week=payload.day_of_week,
        start_time=payload.start_time,
        end_time=payload.end_time,
        note=payload.note,
    )


@router.delete("/special-courses/{special_course_id}", status_code=204)
def delete_special_course(special_course_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Supprime un cours particulier."""
    timetable_service.delete_special_course(db=db, special_course_id=special_course_id)


@router.get("/teachers/{teacher_id}/timetable")
def get_teacher_timetable(teacher_id: str, db: DatabaseSession, current_admin: CurrentAdminDependency):
    """Retourne l'emploi du temps d'un enseignant, toutes classes confondues."""
    return timetable_service.get_teacher_timetable(db=db, teacher_id=teacher_id)
