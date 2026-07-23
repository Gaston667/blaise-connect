"""Fonctions de hachage, session et contrôle des rôles de l'US-025."""

from pwdlib import PasswordHash


password_hasher = PasswordHash.recommended()

# Ce hash permet de vérifier un mot de passe même si le compte n'existe pas.
DUMMY_PASSWORD_HASH = password_hasher.hash(
    "mot-de-passe-fictif-utilise-uniquement-pour-la-securite"
)


def hash_password(password: str) -> str:
    """Transforme un mot de passe en hash sécurisé."""

    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Vérifie si un mot de passe correspond au hash enregistré."""

    return password_hasher.verify(password, password_hash)
