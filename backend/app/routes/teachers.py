"""Contrôleur FastAPI préparé pour l'US-006, non activé."""

from fastapi import APIRouter


router = APIRouter(
    prefix="/teachers",
    tags=["teachers"],
)

# Routes prévues : liste, création, modification et désactivation.
