"""Point d'entrée de l'API FastAPI de BlaiseConnect."""

from fastapi import FastAPI
from app.routes.accounts import router as accounts_router
from app.routes.school_years import router as school_years_router
from app.routes.reporting_periods import router as reporting_periods_router
from app.routes.students import router as students_router
from app.routes.school_classes import router as school_classes_router


# Importation des routeurs
from app.routes.auth import router as auth_router
from app.routes.health import router as health_router


# Crée l'application FastAPI et configure les informations de sa documentation.
app = FastAPI(
    title="BlaiseConnect API",
    version="0.1.0",
)


# Enregistre les routes dans l'application principale.
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(accounts_router)
app.include_router(school_years_router)
app.include_router(reporting_periods_router)
app.include_router(students_router)
app.include_router(school_classes_router)