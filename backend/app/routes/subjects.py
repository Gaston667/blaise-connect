"""Contrôleur FastAPI préparé pour l'US-005, non activé."""

from fastapi import APIRouter


router = APIRouter(
    prefix="/subjects",
    tags=["subjects"],
)

# Routes prévues : liste, création, modification et association à une classe.
