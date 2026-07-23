"""Contrôleur HTTP de connexion, déconnexion et consultation de session."""
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import LoginRequest, LoginResponse

DatabaseSession = Annotated[Session, Depends(get_db)]


router = APIRouter(
    prefix="/auth",
    tags=["authentication"],
)
