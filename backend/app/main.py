"""Point d'entrée de l'API FastAPI de BlaiseConnect."""

from fastapi import FastAPI, Request

from app.core.exception_handlers import register_exception_handlers
from app.core.api_response import wrap_success_responses
from app.routes.accounts import router as accounts_router
from app.routes.school_years import router as school_years_router
from app.routes.reporting_periods import router as reporting_periods_router
from app.routes.students import router as students_router
from app.routes.school_classes import router as school_classes_router
from app.routes.guardians import router as guardians_router
from app.routes.teachers import router as teachers_router
from app.routes.class_levels import router as class_levels_router
from app.routes.account_files import router as account_files_router
from app.routes.subjects import router as subjects_router
from app.routes.administrators import router as administrators_router
from app.routes.grades import router as grades_router

from app.routes.assessments import router as assessments_router
from app.routes.grade_change_requests import router as grade_change_requests_router
from app.routes.student_grades import router as student_grades_router
from app.routes.student_timetable import router as student_timetable_router
from app.routes.teacher_timetable import router as teacher_timetable_router
from app.routes.timetables import router as timetables_router

# Importation des routeurs
from app.routes.auth import router as auth_router
from app.routes.health import router as health_router
# Crée l'application FastAPI et configure les informations de sa documentation.
app = FastAPI(
    title="BlaiseConnect API",
    version="0.1.0",
)

register_exception_handlers(app)


@app.middleware("http")
async def standardize_success_response(request: Request, call_next):
    return await wrap_success_responses(request, call_next)

# Enregistre les routes dans l'application principale.
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(school_years_router)
app.include_router(reporting_periods_router)
app.include_router(student_grades_router)
app.include_router(student_timetable_router)
app.include_router(teacher_timetable_router)
app.include_router(students_router)
app.include_router(school_classes_router)
app.include_router(guardians_router)
app.include_router(teachers_router)
app.include_router(class_levels_router)
app.include_router(account_files_router)
app.include_router(subjects_router)
app.include_router(administrators_router)
app.include_router(grades_router)
app.include_router(assessments_router)
app.include_router(grade_change_requests_router)
app.include_router(timetables_router)
