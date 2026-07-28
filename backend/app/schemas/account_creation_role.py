"""Type des rôles pouvant être créés depuis l'API."""

from typing import Literal


AccountCreationRole = Literal["ADMIN", "TEACHER", "STUDENT", "GUARDIAN"]
