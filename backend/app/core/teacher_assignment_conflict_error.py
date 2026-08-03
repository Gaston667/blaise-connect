"""Erreur métier liée à une matière de classe déjà affectée."""


class TeacherAssignmentConflictError(Exception):
    """Signale qu'une matière de classe possède déjà un enseignant actif."""
