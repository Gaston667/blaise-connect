"""Vacances scolaires : saisie par l'administrateur, lecture pour tous, effets sur les saisies datées.

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_school_holidays
"""

from datetime import date, timedelta

from sqlalchemy import text

from tests.integration.support import ADMIN, STUDENT, TEACHER, ApiTestCase


class SchoolHolidayTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.client(ADMIN)
        year = self.db.execute(
            text("SELECT id, start_date, end_date FROM school_years WHERE is_current")
        ).one()
        self.year_id = str(year.id)
        self.year_start = year.start_date
        self.year_end = year.end_date
        # une plage lointaine, sans rapport avec les données de test
        self.start = self.year_start + timedelta(days=200)
        self.end = self.start + timedelta(days=13)

    def holidays_url(self, suffix=""):
        return f"/school-years/{self.year_id}/holidays{suffix}"

    def create(self, name="Vacances de printemps", start=None, end=None):
        return self.admin.post(
            self.holidays_url(),
            json={
                "name": name,
                "start_date": (start or self.start).isoformat(),
                "end_date": (end or self.end).isoformat(),
            },
        )

    def test_the_admin_creates_lists_updates_and_deletes_a_holiday(self):
        created = self.create()
        self.assertEqual(created.status_code, 201, created.text)
        holiday = self.data(created)
        listed = self.data(self.admin.get(self.holidays_url()))
        self.assertIn(holiday["id"], [item["id"] for item in listed])

        new_end = (self.end + timedelta(days=2)).isoformat()
        updated = self.admin.patch(self.holidays_url(f"/{holiday['id']}"), json={"end_date": new_end})
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(self.data(updated)["end_date"], new_end)

        self.assertEqual(self.admin.delete(self.holidays_url(f"/{holiday['id']}")).status_code, 204)
        self.assertEqual(self.admin.delete(self.holidays_url(f"/{holiday['id']}")).status_code, 404)

    def test_two_holidays_of_a_year_cannot_overlap(self):
        self.assertEqual(self.create().status_code, 201)
        overlap = self.create("Autres vacances", self.start + timedelta(days=5), self.end + timedelta(days=5))
        self.assertEqual(overlap.status_code, 409)
        self.assertIn("chevauchent", overlap.json()["message"])

    def test_a_holiday_must_stay_inside_the_school_year(self):
        outside = self.create(start=self.year_end + timedelta(days=1), end=self.year_end + timedelta(days=8))
        self.assertEqual(outside.status_code, 409)
        self.assertIn("année scolaire", outside.json()["message"])

    def test_the_end_date_cannot_precede_the_start_date(self):
        backwards = self.create(start=self.end, end=self.start)
        self.assertEqual(backwards.status_code, 409)
        self.assertIn("date de fin", backwards.json()["message"])

    def test_every_role_can_read_but_only_the_admin_can_write(self):
        self.assertEqual(self.create().status_code, 201)
        window = {"date_from": self.start.isoformat(), "date_to": self.end.isoformat()}
        for matricule in (ADMIN, TEACHER, STUDENT):
            response = self.client(matricule).get("/school-holidays", params=window)
            self.assertEqual(response.status_code, 200, matricule)
            self.assertEqual(len(self.data(response)), 1)
        outside_window = {"date_from": (self.end + timedelta(days=30)).isoformat()}
        self.assertEqual(self.data(self.admin.get("/school-holidays", params=outside_window)), [])
        for matricule in (TEACHER, STUDENT):
            denied = self.client(matricule).post(
                self.holidays_url(),
                json={"name": "X", "start_date": self.start.isoformat(), "end_date": self.end.isoformat()},
            )
            self.assertEqual(denied.status_code, 403, matricule)

    def test_an_assessment_cannot_be_created_during_the_holidays(self):
        assignment = self.db.execute(
            text(
                """SELECT ta.id, ta.start_date FROM teacher_assignments ta
                   JOIN class_subjects cs ON cs.id = ta.class_subject_id
                   JOIN classes c ON c.id = cs.class_id
                   JOIN school_years y ON y.id = c.school_year_id
                   WHERE y.is_current AND ta.end_date IS NULL LIMIT 1"""
            )
        ).first()
        if assignment is None:
            self.skipTest("Aucune affectation active dans les données de test.")
        day = max(self.start, assignment.start_date)
        self.assertEqual(self.create(start=day, end=day + timedelta(days=6)).status_code, 201)
        payload = {
            "teacher_assignment_id": str(assignment.id),
            "title": "Contrôle pendant les vacances",
            "assessment_date": day.isoformat(),
            "maximum_score": "20",
            "coefficient": "1",
        }
        refused = self.admin.post("/assessments", json=payload)
        self.assertIn(refused.status_code, (400, 409, 422), refused.text)
        self.assertIn("vacances", refused.json()["message"])

    def test_the_holidays_of_a_closed_year_are_frozen(self):
        year = self.db.execute(
            text("SELECT id FROM school_years WHERE closed_at IS NOT NULL LIMIT 1")
        ).scalar_one_or_none()
        if year is None:
            self.skipTest("Aucune année clôturée dans les données de test.")
        denied = self.admin.post(
            f"/school-years/{year}/holidays",
            json={"name": "Trop tard", "start_date": date(2000, 1, 1).isoformat(), "end_date": date(2000, 1, 2).isoformat()},
        )
        self.assertEqual(denied.status_code, 409)
