"""Droits réels de chaque rôle : qui peut appeler quoi (administrateur, enseignant, élève, parent, anonyme).

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_access_control
"""

import re

from tests.integration.support import (
    ADMIN, GUARDIAN_ONE_CHILD, STUDENT, TEACHER, ApiTestCase,
)

UNKNOWN_ID = "00000000-0000-0000-0000-000000000000"

ROLES = {
    "ADMIN": ADMIN,
    "TEACHER": TEACHER,
    "STUDENT": STUDENT,
    "GUARDIAN": GUARDIAN_ONE_CHILD,
}

# Routes sans authentification, voulues publiques.
PUBLIC = {
    ("GET", "/health"),
    ("GET", "/media/accounts/default-photo"),
    ("POST", "/auth/login"),
    ("POST", "/auth/logout"),
}

# chemin -> rôles autorisés
ADMIN_ONLY = [
    "/accounts", "/administrators/overview", "/guardians", "/rooms", "/report-cards",
    "/admin-dashboard", "/timetables/alerts", "/teacher-busy-slots",
    "/attendance/alerts", "/attendance/change-requests",
    f"/school-classes/{UNKNOWN_ID}/timetable", f"/school-years/{UNKNOWN_ID}/day-schedules",
    f"/students/{UNKNOWN_ID}/status-history", f"/students/{UNKNOWN_ID}/guardians",
]
STAFF = [
    "/assessments", "/assessments/summary", "/grades", "/grades/options", "/attendance/events",
    "/attendance/records", "/attendance/options", "/class-levels", "/school-classes",
    "/school-classes/overview", "/school-years", "/students/", "/subjects/overview",
    "/teachers/overview", "/grade-change-requests",
]
STUDENT_ONLY = [
    "/students/me", "/students/me/grades", "/students/me/grades/summary",
    "/students/me/timetable", "/attendance/me",
]
TEACHER_ONLY = ["/teachers/me/timetable"]
GUARDIAN_ONLY = ["/guardian/children"]
ANY_CONNECTED = ["/auth/me"]

ALLOWED = {
    "ADMIN_ONLY": {"ADMIN"},
    "STAFF": {"ADMIN", "TEACHER"},
    "STUDENT_ONLY": {"STUDENT"},
    "TEACHER_ONLY": {"TEACHER"},
    "GUARDIAN_ONLY": {"GUARDIAN"},
    "ANY_CONNECTED": {"ADMIN", "TEACHER", "STUDENT", "GUARDIAN"},
}
GROUPS = {
    "ADMIN_ONLY": ADMIN_ONLY, "STAFF": STAFF, "STUDENT_ONLY": STUDENT_ONLY,
    "TEACHER_ONLY": TEACHER_ONLY, "GUARDIAN_ONLY": GUARDIAN_ONLY, "ANY_CONNECTED": ANY_CONNECTED,
}


class AccessControlTests(ApiTestCase):
    def test_every_protected_route_refuses_an_anonymous_visitor(self):
        anonymous = self.client()
        leaks = []
        for path, operations in self.app.openapi()["paths"].items():
            url = re.sub(r"\{[^}]+\}", UNKNOWN_ID, path)
            for method in operations:
                if (method.upper(), path) in PUBLIC:
                    continue
                response = anonymous.request(method.upper(), url, json={} if method != "get" else None)
                if response.status_code != 401:
                    leaks.append(f"{method.upper()} {path} -> {response.status_code}")
        self.assertEqual(leaks, [], "routes accessibles sans connexion : " + "; ".join(leaks))

    def test_each_role_only_reaches_its_own_routes(self):
        problems = []
        clients = {role: self.client(matricule) for role, matricule in ROLES.items()}
        for group, paths in GROUPS.items():
            for path in paths:
                for role, http in clients.items():
                    status = http.get(path).status_code
                    if role in ALLOWED[group]:
                        if status in (401, 403):
                            problems.append(f"{role} devrait accéder à {path} ({group}) : {status}")
                    elif status != 403:
                        problems.append(f"{role} ne devrait pas accéder à {path} ({group}) : {status}")
        self.assertEqual(problems, [], "\n".join(problems))

    def test_write_actions_are_reserved_to_the_right_roles(self):
        forbidden_for_non_admin = [
            ("POST", "/accounts"), ("POST", "/timetables/generate-all"), ("POST", "/timetables/publish-all"),
            ("POST", f"/school-years/{UNKNOWN_ID}/close"), ("DELETE", f"/school-years/{UNKNOWN_ID}"),
            ("POST", "/rooms"), ("POST", f"/school-classes/{UNKNOWN_ID}/timetable/generate"),
            ("POST", f"/school-classes/{UNKNOWN_ID}/timetable/validate"),
            ("DELETE", f"/timetable-slots/{UNKNOWN_ID}"), ("POST", f"/accounts/{UNKNOWN_ID}/password"),
        ]
        problems = []
        for role in ("TEACHER", "STUDENT", "GUARDIAN"):
            http = self.client(ROLES[role])
            for method, path in forbidden_for_non_admin:
                status = http.request(method, path, json={}).status_code
                if status != 403:
                    problems.append(f"{role} {method} {path} -> {status}")
        self.assertEqual(problems, [], "\n".join(problems))

    def test_a_connected_user_never_receives_secrets(self):
        for matricule in ROLES.values():
            body = self.client(matricule).get("/auth/me").text.lower()
            for secret in ("password_hash", "pbkdf2", "argon2", "$2b$", "session"):
                self.assertNotIn(secret, body, f"{matricule} : « {secret} » exposé par /auth/me")
