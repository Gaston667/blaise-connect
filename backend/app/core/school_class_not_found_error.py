"""Erreur métier signalant qu'une classe est introuvable."""

from uuid import UUID


class SchoolClassNotFoundError(Exception):
    """Indique qu'aucune classe ne correspond à l'identifiant demandé."""

    def __init__(self, school_class_id: UUID) -> None:
        """Mémorise l'identifiant recherché."""

        self.school_class_id = school_class_id
        super().__init__(f"Classe introuvable : {school_class_id}")
