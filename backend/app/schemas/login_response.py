"""Schéma Pydantic de la réponse de connexion."""

from pydantic import BaseModel

from app.schemas.current_account_response import CurrentAccountResponse


class LoginResponse(BaseModel):
    """Réponse retournée après une connexion réussie."""

    message: str
    account: CurrentAccountResponse
