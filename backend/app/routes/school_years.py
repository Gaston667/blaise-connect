"""Contrôleur FastAPI préparé pour l'US-003, non activé."""

from fastapi import APIRouter


router = APIRouter(
    prefix="/school-years",
    tags=["school-years"],
)

# Routes prévues : GET/POST /school-years et POST /school-years/{id}/periods.
