"""Point d'entrée de l'API FastAPI de BlaiseConnect."""

from fastapi import FastAPI


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
