"""Schéma Pydantic de clôture d'une année scolaire.

La clôture ne prend aucune donnée du client : l'administrateur qui
clôture et l'horodatage sont déterminés par le backend, jamais saisis.
Ce schéma existe surtout pour documenter l'intention de la route.
"""

from pydantic import BaseModel


class SchoolYearClose(BaseModel):
    """Corps de requête vide, réservé à d'éventuelles évolutions futures."""