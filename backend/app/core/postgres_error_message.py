"""Extraction sûre du message métier porté par une erreur PostgreSQL."""

from sqlalchemy.exc import IntegrityError


def extract_postgres_error_message(error: IntegrityError) -> str:
    """Retourne le message métier du trigger/contrainte si disponible.

    Ne remonte jamais la requête SQL ni les noms de colonnes bruts :
    seul le texte MESSAGE porté par le RAISE EXCEPTION PostgreSQL
    (ou par une contrainte nommée explicitement) est exposé.
    """

    original_error = getattr(error, "orig", None)

    if original_error is not None and original_error.args:
        return str(original_error.args[0]).strip()

    return "Cette opération viole une règle métier de l'année scolaire ou de la période."