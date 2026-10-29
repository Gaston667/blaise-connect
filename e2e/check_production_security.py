"""Contrôle de sécurité d'un serveur BlaiseConnect en ligne (à lancer contre le VPS, sans dépendance).

Vérifie : redirection HTTP vers HTTPS, HSTS, en-têtes de sécurité, documentation de l'API non
exposée, hôte inconnu refusé, CORS fermé, routes protégées sans connexion, fichiers privés
fermés, et (si on fournit un compte de test) les attributs du cookie de session.

    python e2e/check_production_security.py https://ecole.example.com
    python e2e/check_production_security.py https://ecole.example.com --api-prefix /api \
        --login a000001:MotDePasseDeTest
    python e2e/check_production_security.py http://localhost:8000 --allow-http     # essai en local

Code de sortie : 0 si tout est conforme, 1 sinon. N'écrit rien sur le serveur (une connexion de test
est créée seulement si --login est donné ; utilisez un compte de test, jamais un vrai compte).
"""

import argparse
import json
import ssl
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def call(url, method="GET", headers=None, data=None, follow=False):
    opener = urllib.request.build_opener(*([] if follow else [NoRedirect()]))
    request = urllib.request.Request(url, method=method, headers=headers or {}, data=data)
    try:
        with opener.open(request, timeout=15) as response:
            return response.status, response.headers, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers, error.read()
    except (urllib.error.URLError, ssl.SSLError, TimeoutError) as error:
        return None, {}, str(error).encode()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("base_url")
    parser.add_argument("--api-prefix", default="", help="préfixe de l'API (ex. /api)")
    parser.add_argument("--login", help="matricule:mot_de_passe d'un compte de test")
    parser.add_argument("--allow-http", action="store_true", help="accepte HTTP (essai en local)")
    args = parser.parse_args()

    base = args.base_url.rstrip("/")
    api = base + args.api_prefix.rstrip("/")
    parts = urlsplit(base)
    results: list[tuple[str, bool, str]] = []

    def check(name, ok, detail=""):
        results.append((name, bool(ok), detail))

    # ---- HTTPS
    if not args.allow_http:
        check("Le site est servi en HTTPS", parts.scheme == "https", base)
        status, headers, _ = call(f"http://{parts.netloc}/")
        location = headers.get("Location", "") if headers else ""
        check("HTTP redirige vers HTTPS", status in (301, 302, 307, 308) and location.startswith("https://"),
              f"statut {status}, Location={location or 'aucune'}")
        status, headers, _ = call(base + "/")
        check("HSTS (Strict-Transport-Security) activé", bool(headers.get("Strict-Transport-Security")))

    # ---- en-têtes de sécurité sur l'API
    status, headers, _ = call(api + "/health")
    check("L'API répond", status == 200, f"statut {status}")
    check("En-tête X-Content-Type-Options: nosniff", (headers.get("X-Content-Type-Options") or "").lower() == "nosniff")
    check("Protection contre l'inclusion en cadre (X-Frame-Options ou CSP)",
          bool(headers.get("X-Frame-Options") or "frame-ancestors" in (headers.get("Content-Security-Policy") or "")))
    check("En-tête Referrer-Policy", bool(headers.get("Referrer-Policy")))
    check("Le serveur ne révèle pas sa version", not any(ch.isdigit() for ch in (headers.get("Server") or "")),
          headers.get("Server") or "")

    # ---- documentation de l'API
    for path in ("/docs", "/redoc", "/openapi.json"):
        status, _, _ = call(api + path)
        check(f"Documentation non exposée : {path}", status in (401, 403, 404), f"statut {status}")

    # ---- hôte inconnu et CORS
    status, _, _ = call(api + "/health", headers={"Host": "evil.example.com"})
    check("Un hôte inconnu est refusé", status in (400, 403, 404, 421) or status is None, f"statut {status}")
    status, headers, _ = call(api + "/auth/login", method="OPTIONS", headers={
        "Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"})
    check("CORS fermé pour une origine inconnue", "Access-Control-Allow-Origin" not in headers)

    # ---- routes protégées
    for path in ("/auth/me", "/students/", "/accounts", "/report-cards", "/guardian/children"):
        status, _, _ = call(api + path)
        check(f"Refusé sans connexion : {path}", status == 401, f"statut {status}")
    status, _, _ = call(api + "/media/accounts/a000001/photos/profile-photo.jpg")
    check("Photos privées fermées sans connexion", status == 401, f"statut {status}")
    status, _, _ = call(api + "/media/accounts/..%2F..%2Fetc/photos/passwd")
    check("Traversée de dossier refusée", status in (400, 401, 404, 422), f"statut {status}")

    # ---- cookie de session
    if args.login:
        matricule, _, password = args.login.partition(":")
        status, headers, _ = call(api + "/auth/login", method="POST",
                                  headers={"Content-Type": "application/json"},
                                  data=json.dumps({"registration_number": matricule, "password": password}).encode())
        cookie = (headers.get("Set-Cookie") or "").lower()
        check("Connexion de test réussie", status == 200, f"statut {status}")
        check("Cookie de session HttpOnly", "httponly" in cookie)
        check("Cookie de session SameSite", "samesite=" in cookie, cookie[:80])
        if not args.allow_http:
            check("Cookie de session Secure (HTTPS seulement)", "secure" in cookie)

    width = max(len(name) for name, _, _ in results)
    failed = 0
    for name, ok, detail in results:
        failed += not ok
        print(f"{'OK     ' if ok else 'ÉCHEC  '}{name:<{width}}  {'' if ok else detail}")
    print(f"\n{len(results) - failed}/{len(results)} contrôles conformes.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
