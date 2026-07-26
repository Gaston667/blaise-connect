"""Contrôleur FastAPI préparé pour l'US-004, non activé."""

from fastapi import APIRouter


router = APIRouter(
    prefix="/school-classes",
    tags=["school-classes"],
)

# Routes prévues : liste, création, modification, composition et archivage.
