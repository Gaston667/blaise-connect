"""Désinscription d'un élève de sa classe.

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_unenroll
"""

from sqlalchemy import text

from tests.integration.support import ADMIN, ApiTestCase


class UnenrollTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.client(ADMIN)
        row = self.db.execute(
            text(
                """SELECT e.student_id FROM student_enrollments e
                   JOIN classes c ON c.id = e.class_id
                   JOIN school_years y ON y.id = c.school_year_id
                   WHERE e.end_date IS NULL AND y.is_current AND y.closed_at IS NULL LIMIT 1"""
            )
        ).first()
        if row is None:
            self.skipTest("Aucun élève inscrit dans les données de test.")
        self.student_id = str(row.student_id)

    def test_an_enrolled_student_can_be_unenrolled(self):
        response = self.admin.post(f"/students/{self.student_id}/unenroll")
        self.assertEqual(response.status_code, 200, response.text[:300])
        self.assertIsNone(self.data(self.admin.get(f"/students/{self.student_id}")).get("class_id"))

    def test_unenrolling_twice_gives_a_clear_message(self):
        self.admin.post(f"/students/{self.student_id}/unenroll")
        response = self.admin.post(f"/students/{self.student_id}/unenroll")
        self.assertEqual(response.status_code, 409)
        self.assertIn("inscription en cours", response.json()["message"])
