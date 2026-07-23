"""Route technique utilisée pour vérifier que l'API répond."""

# APIRouter permet de regrouper des routes en dehors de main.py.
from fastapi import APIRouter

# Toutes les routes déclarées ici seront regroupées sous le tag health.
router = APIRouter(tags=["health"])


# Associe une requête HTTP GET sur /health à la fonction health_check.
@router.get("/health")
def health_check() -> dict[str, str]:
    """Retourne un statut simple indiquant que FastAPI fonctionne."""

    return {"status": "ok"}
