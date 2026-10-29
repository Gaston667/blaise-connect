"""Extraction sûre du message métier porté par une erreur PostgreSQL."""

import re

from sqlalchemy.exc import IntegrityError

# Contraintes nommées dont on connaît la signification pour l'utilisateur.
CONSTRAINT_MESSAGES = {
    "ck_students_birth_date": "La date de naissance doit être antérieure ou égale à la date d'admission.",
    "ck_teachers_birth_date": "La date de naissance doit être antérieure ou égale à la date d'embauche.",
}

GENERIC_CHECK_MESSAGE = (
    "Ces informations ne respectent pas une règle de l'école. "
    "Vérifiez les dates et les champs obligatoires."
)


def extract_postgres_error_message(error: IntegrityError) -> str:
    """Retourne un message métier lisible pour l'utilisateur.

    Ne remonte jamais la requête SQL ni les noms de tables ou de colonnes bruts :
    soit le texte MESSAGE d'un RAISE EXCEPTION PostgreSQL (déjà rédigé pour
    l'admin), soit une phrase associée à la contrainte violée.
    """

    original_error = getattr(error, "orig", None)

    if original_error is not None and original_error.args:
        message = str(original_error.args[0]).strip()
        # psycopg concatène parfois le CONTEXTE PL/pgSQL après le message
        # métier ; on ne garde que la première ligne, destinée à l'admin.
        first_line = message.splitlines()[0].strip()

        constraint = re.search(r'constraint "([^"]+)"', first_line)
        if "violates check constraint" in first_line:
            return CONSTRAINT_MESSAGES.get(constraint.group(1) if constraint else "", GENERIC_CHECK_MESSAGE)
        if "violates unique constraint" in first_line:
            return "Cette valeur est déjà utilisée : elle doit être unique."
        if "violates foreign key constraint" in first_line:
            return "Un élément lié est introuvable, ou il est encore utilisé ailleurs."
        if "violates not-null constraint" in first_line:
            return "Un champ obligatoire est manquant."
        return first_line

    return "Cette opération viole une règle métier de l'année scolaire ou de la période."
