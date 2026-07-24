"""Configuration du cookie utilisé par les sessions d'authentification."""

import os


SESSION_COOKIE_NAME = "blaise_session"


def read_session_cookie_secure() -> bool:
    """Lit et valide le mode HTTPS obligatoire du cookie de session."""

    configured_value = os.environ["SESSION_COOKIE_SECURE"].strip().lower()

    if configured_value == "true":
        return True

    if configured_value == "false":
        return False

    raise RuntimeError(
        "SESSION_COOKIE_SECURE doit contenir uniquement 'true' ou 'false'."
    )


SESSION_COOKIE_SECURE = read_session_cookie_secure()
