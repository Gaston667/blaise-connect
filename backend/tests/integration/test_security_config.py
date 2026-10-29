"""Sécurité HTTP : hôtes autorisés, CORS, cookie de session, fichiers privés, connexion.

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_security_config
"""

import os
import subprocess
import sys
from unittest import TestCase

from tests.integration.support import ADMIN, PASSWORD, STUDENT, ApiTestCase


class HttpSecurityTests(ApiTestCase):
    def test_an_unknown_host_is_refused(self):
        response = self.client(host="evil.example.com").get("/health")
        self.assertEqual(response.status_code, 400)

    def test_cors_only_allows_declared_origins(self):
        http = self.client()
        allowed = http.options(
            "/auth/login",
            headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"},
        )
        self.assertEqual(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173")
        self.assertEqual(allowed.headers.get("access-control-allow-credentials"), "true")
        refused = http.options(
            "/auth/login",
            headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "POST"},
        )
        self.assertNotIn("access-control-allow-origin", refused.headers)

    def test_security_headers_are_present(self):
        headers = self.client().get("/health").headers
        for name in ("x-content-type-options", "x-frame-options", "referrer-policy"):
            self.assertIn(name, headers, f"en-tête {name} manquant")
        self.assertEqual(headers["x-content-type-options"].lower(), "nosniff")

    def test_session_cookie_is_http_only_and_same_site(self):
        response = self.client().post(
            "/auth/login", json={"registration_number": ADMIN, "password": PASSWORD}
        )
        cookie = response.headers["set-cookie"].lower()
        self.assertIn("httponly", cookie)
        self.assertIn("samesite=lax", cookie)
        self.assertIn("path=/", cookie)

    def test_logout_revokes_the_session(self):
        http = self.client(STUDENT)
        self.assertEqual(http.get("/auth/me").status_code, 200)
        self.assertEqual(http.post("/auth/logout").status_code, 204)
        # le cookie supprimé n'est plus renvoyé : on rejoue l'ancien jeton à la main
        self.assertEqual(self.client().get("/auth/me").status_code, 401)

    def test_a_stolen_token_stops_working_after_logout(self):
        http = self.client(STUDENT)
        token = http.cookies.get("blaise_session")
        self.assertTrue(token)
        http.post("/auth/logout")
        replay = self.client()
        replay.cookies.set("blaise_session", token)
        self.assertEqual(replay.get("/auth/me").status_code, 401)

    def test_login_does_not_reveal_whether_an_account_exists(self):
        unknown = self.client().post("/auth/login", json={"registration_number": "u999999", "password": PASSWORD})
        wrong = self.client().post("/auth/login", json={"registration_number": STUDENT, "password": "Mauvais123!"})
        self.assertEqual(unknown.status_code, 401)
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(unknown.json()["message"], wrong.json()["message"])

    def test_repeated_failures_lock_the_account(self):
        http = self.client()
        statuses = [
            http.post("/auth/login", json={"registration_number": STUDENT, "password": "Mauvais123!"}).status_code
            for _ in range(12)
        ]
        self.assertIn(423, statuses, "aucun verrouillage après 12 échecs consécutifs")
        locked = http.post("/auth/login", json={"registration_number": STUDENT, "password": PASSWORD})
        self.assertEqual(locked.status_code, 423, "un compte verrouillé doit refuser même le bon mot de passe")

    def test_sql_injection_in_the_login_is_harmless(self):
        response = self.client().post(
            "/auth/login", json={"registration_number": "' OR '1'='1' --", "password": "x' OR '1'='1"}
        )
        self.assertIn(response.status_code, (401, 422))

    def test_private_photos_need_an_administrator(self):
        path = f"/media/accounts/{STUDENT}/photos/profile-photo.jpg"
        self.assertEqual(self.client().get(path).status_code, 401)
        self.assertEqual(self.client(STUDENT).get(path).status_code, 403)
        self.assertEqual(self.client(ADMIN).get(path).status_code, 200)

    def test_path_traversal_on_files_is_refused(self):
        admin = self.client(ADMIN)
        for path in (
            "/media/accounts/..%2F..%2Fetc/photos/passwd",
            f"/media/accounts/{STUDENT}/photos/..%2F..%2F.env",
        ):
            self.assertIn(admin.get(path).status_code, (400, 404, 422), path)

    def test_documents_need_the_right_account(self):
        paths = [
            "/students/00000000-0000-0000-0000-000000000000/documents/00000000-0000-0000-0000-000000000000/content",
            "/grades/00000000-0000-0000-0000-000000000000/documents/00000000-0000-0000-0000-000000000000/content",
            "/attendance/records/00000000-0000-0000-0000-000000000000/documents/00000000-0000-0000-0000-000000000000/content",
        ]
        for path in paths:
            self.assertEqual(self.client().get(path).status_code, 401, path)


class ProductionConfigurationTests(TestCase):
    """La configuration refuse de démarrer en production sans hôtes ni origines déclarés."""

    def run_config(self, **environment):
        env = {**os.environ, **environment}
        for variable in ("ALLOWED_HOSTS", "ALLOWED_ORIGINS"):
            if variable not in environment:
                env.pop(variable, None)
        return subprocess.run(
            [sys.executable, "-c", "import app.core.http_security_config as c; print(c.ALLOWED_HOSTS)"],
            env=env, capture_output=True, text=True, cwd=os.getcwd(),
        )

    def test_production_without_hosts_and_origins_refuses_to_start(self):
        result = self.run_config(APP_ENV="production")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("ALLOWED_HOSTS", result.stderr)

    def test_production_with_declared_hosts_and_origins_starts(self):
        result = self.run_config(
            APP_ENV="production", ALLOWED_HOSTS="ecole.example.com", ALLOWED_ORIGINS="https://ecole.example.com",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("ecole.example.com", result.stdout)

    def test_session_cookie_secure_flag_must_be_a_clear_boolean(self):
        for value, ok in (("true", True), ("false", True), ("peut-être", False)):
            result = subprocess.run(
                [sys.executable, "-c", "import app.core.session_cookie_config as c; print(c.SESSION_COOKIE_SECURE)"],
                env={**os.environ, "SESSION_COOKIE_SECURE": value}, capture_output=True, text=True, cwd=os.getcwd(),
            )
            self.assertEqual(result.returncode == 0, ok, f"SESSION_COOKIE_SECURE={value}: {result.stderr[-120:]}")

    def test_api_documentation_is_closed_in_production_and_open_in_development(self):
        code = "from app.main import app; print(app.docs_url, app.redoc_url, app.openapi_url)"
        production = subprocess.run(
            [sys.executable, "-c", code],
            env={**os.environ, "APP_ENV": "production", "ALLOWED_HOSTS": "ecole.example.com",
                 "ALLOWED_ORIGINS": "https://ecole.example.com"},
            capture_output=True, text=True, cwd=os.getcwd(),
        )
        self.assertEqual(production.returncode, 0, production.stderr[-300:])
        self.assertEqual(production.stdout.split(), ["None", "None", "None"])
        development = subprocess.run(
            [sys.executable, "-c", code], env={**os.environ, "APP_ENV": "development"},
            capture_output=True, text=True, cwd=os.getcwd(),
        )
        self.assertEqual(development.stdout.split(), ["/docs", "/redoc", "/openapi.json"])
