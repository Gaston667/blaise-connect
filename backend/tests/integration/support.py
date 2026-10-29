"""Outils communs aux tests d'intégration de l'API (base de développement, transaction annulée).

Tous les tests qui en héritent sont ignorés sans `RUN_DB_TESTS=1`. Une seule session
SQLAlchemy est partagée par toutes les requêtes d'un test : les `commit` deviennent
de simples `flush` et tout est annulé à la fin (aucune trace dans la base).
"""

import os
from unittest import SkipTest, TestCase

RUN = os.getenv("RUN_DB_TESTS") == "1"
PASSWORD = "Password123!"

# Comptes fictifs des données de test (voir database/init)
ADMIN = "a000001"
TEACHER = "e000001"
STUDENT = "u000003"
GUARDIAN_TWO_CHILDREN = "p000002"
GUARDIAN_ONE_CHILD = "p000003"


class ApiTestCase(TestCase):
    @classmethod
    def setUpClass(cls):
        if not RUN:
            raise SkipTest("RUN_DB_TESTS=1 est requis (base de développement).")
        from fastapi.testclient import TestClient

        from app.core.database import get_db, session_factory
        from app.main import app

        cls.app = app
        cls.TestClient = TestClient
        cls.get_db = staticmethod(get_db)
        cls.session_factory = staticmethod(session_factory)

    def setUp(self):
        self.db = self.session_factory()
        self.db.commit = self.db.flush

        def shared_session():
            yield self.db

        self.app.dependency_overrides[self.get_db] = shared_session

    def tearDown(self):
        self.app.dependency_overrides.pop(self.get_db, None)
        self.db.rollback()
        self.db.close()

    def client(self, registration_number=None, host="localhost", password=PASSWORD):
        """Client HTTP ; connecté avec le matricule donné, anonyme sinon."""

        http = self.TestClient(self.app, base_url=f"http://{host}", raise_server_exceptions=False)
        if registration_number:
            response = http.post(
                "/auth/login",
                json={"registration_number": registration_number, "password": password},
            )
            self.assertEqual(response.status_code, 200, f"connexion de {registration_number} impossible")
        return http

    @staticmethod
    def data(response):
        """Contenu utile d'une réponse (l'API enveloppe les succès dans `data`)."""

        return response.json()["data"]
