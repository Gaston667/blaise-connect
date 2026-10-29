"""Inscription d'un élève dans une classe : spécialités obligatoires en Première et Terminale.

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_class_enrollment
"""

import datetime

from sqlalchemy import text

from tests.integration.support import ADMIN, ApiTestCase


class ClassEnrollmentTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        self.admin = self.client(ADMIN)
        self.classes = {
            row["code"]: str(row["id"])
            for row in self.db.execute(
                text(
                    """SELECT c.id, l.code::text AS code FROM classes c
                       JOIN class_levels l ON l.id = c.class_level_id
                       JOIN school_years y ON y.id = c.school_year_id WHERE y.is_current"""
                )
            ).mappings()
        }
        free = self.db.execute(
            text(
                """SELECT s.id FROM students s
                   WHERE s.status = 'ACTIVE' AND s.archived_at IS NULL
                     AND NOT EXISTS (SELECT 1 FROM student_enrollments e WHERE e.student_id = s.id AND e.end_date IS NULL)
                   ORDER BY s.created_at LIMIT 1"""
            )
        ).scalar_one_or_none()
        if free is None:
            self.skipTest("Aucun élève sans classe dans les données de test.")
        self.student_id = str(free)

    def specialty_ids(self, class_id, count):
        items = self.data(self.admin.get(f"/school-classes/{class_id}/subjects", params={"is_active": "true"}))
        return [item["subject_id"] for item in items if item["is_specialty"]][:count]

    def enroll(self, class_id, specialty_ids):
        return self.admin.post(
            f"/students/{self.student_id}/enroll",
            json={"class_id": class_id, "start_date": datetime.date.today().isoformat(), "specialty_subject_ids": specialty_ids},
        )

    def test_the_class_detail_exposes_its_level_code(self):
        # l'écran d'inscription s'en sert pour savoir s'il doit demander des spécialités
        for code, class_id in self.classes.items():
            detail = self.data(self.admin.get(f"/school-classes/{class_id}/detail"))
            self.assertEqual(detail["level_code"], code)

    def test_a_terminale_enrollment_without_specialties_is_refused_with_a_clear_message(self):
        response = self.enroll(self.classes["TERMINALE"], [])
        self.assertIn(response.status_code, (400, 409, 422))
        self.assertIn("2 spécialités", response.json()["message"])

    def test_a_premiere_enrollment_needs_three_specialties(self):
        two = self.specialty_ids(self.classes["PREMIERE"], 2)
        response = self.enroll(self.classes["PREMIERE"], two)
        self.assertIn(response.status_code, (400, 409, 422))
        self.assertIn("3 spécialités", response.json()["message"])

    def test_a_terminale_enrollment_with_two_specialties_succeeds(self):
        chosen = self.specialty_ids(self.classes["TERMINALE"], 2)
        self.assertEqual(len(chosen), 2)
        response = self.enroll(self.classes["TERMINALE"], chosen)
        self.assertIn(response.status_code, (200, 201), response.text[:200])
        saved = self.data(self.admin.get(f"/students/{self.student_id}/specialties"))
        self.assertEqual(sorted(str(item["subject_id"]) for item in saved["items"]), sorted(str(i) for i in chosen))

    def test_a_class_without_specialties_needs_none(self):
        response = self.enroll(self.classes["SIXIEME"], [])
        self.assertIn(response.status_code, (200, 201), response.text[:200])


class TerminaleFromPremiereTests(ApiTestCase):
    """En Terminale, un élève ne garde que des spécialités qu'il avait en Première."""

    def setUp(self):
        super().setUp()
        self.admin = self.client(ADMIN)
        rows = self.db.execute(
            text(
                """SELECT c.id, l.code::text AS code FROM classes c
                   JOIN class_levels l ON l.id = c.class_level_id
                   JOIN school_years y ON y.id = c.school_year_id WHERE y.is_current"""
            )
        ).mappings().all()
        self.terminale = str(next(r["id"] for r in rows if r["code"] == "TERMINALE"))
        row = self.db.execute(
            text(
                """SELECT e.student_id, array_agg(sp.subject_id::text ORDER BY sp.subject_id) AS subjects
                   FROM student_enrollments e
                   JOIN classes c ON c.id = e.class_id JOIN class_levels l ON l.id = c.class_level_id
                   JOIN student_specialties sp ON sp.student_enrollment_id = e.id
                   WHERE l.code = 'PREMIERE' AND e.end_date IS NULL
                   GROUP BY e.student_id HAVING count(*) = 3 LIMIT 1"""
            )
        ).mappings().first()
        if row is None:
            self.skipTest("Aucun élève de Première avec 3 spécialités dans les données de test.")
        self.student_id = str(row["student_id"])
        self.premiere_subjects = set(row["subjects"])

    def options(self):
        return self.data(self.admin.get(f"/students/{self.student_id}/specialty-options", params={"class_id": self.terminale}))

    def enroll(self, subject_ids):
        return self.admin.post(
            f"/students/{self.student_id}/enroll",
            json={"class_id": self.terminale, "start_date": datetime.date.today().isoformat(), "specialty_subject_ids": subject_ids},
        )

    def test_only_the_premiere_specialties_are_offered_in_terminale(self):
        options = self.options()
        self.assertTrue(options["restricted_to_premiere"])
        self.assertEqual(options["required_count"], 2)
        offered = {str(item["subject_id"]) for item in options["items"]}
        self.assertTrue(offered, "aucune spécialité proposée")
        self.assertTrue(offered <= self.premiere_subjects, "une spécialité absente de la Première est proposée")

    def test_a_specialty_not_followed_in_premiere_is_refused(self):
        class_specialties = [
            str(item["subject_id"])
            for item in self.data(self.admin.get(f"/school-classes/{self.terminale}/subjects", params={"is_active": "true"}))
            if item["is_specialty"]
        ]
        outsiders = [subject for subject in class_specialties if subject not in self.premiere_subjects]
        if not outsiders:
            self.skipTest("La Terminale ne propose que des spécialités déjà suivies en Première.")
        offered = [str(item["subject_id"]) for item in self.options()["items"]]
        response = self.enroll([offered[0], outsiders[0]])
        self.assertIn(response.status_code, (400, 409, 422))
        self.assertIn("Première", response.json()["message"])

    def test_two_of_the_premiere_specialties_are_accepted(self):
        offered = [str(item["subject_id"]) for item in self.options()["items"]]
        if len(offered) < 2:
            self.skipTest("Moins de 2 spécialités de Première sont proposées en Terminale.")
        response = self.enroll(offered[:2])
        self.assertIn(response.status_code, (200, 201), response.text[:200])


class EnrollmentDateTests(ApiTestCase):
    def test_the_class_list_shows_the_enrollment_date_not_the_admission_date(self):
        admin = self.client(ADMIN)
        row = self.db.execute(
            text(
                """SELECT e.student_id, e.class_id, e.start_date FROM student_enrollments e
                   WHERE e.end_date IS NULL LIMIT 1"""
            )
        ).first()
        if row is None:
            self.skipTest("Aucun élève inscrit dans les données de test.")
        items = self.data(admin.get("/students/", params={"class_id": str(row.class_id), "limit": 100}))
        items = items if isinstance(items, list) else items["items"]
        found = next(item for item in items if item["id"] == str(row.student_id))
        self.assertEqual(found["enrollment_start_date"], row.start_date.isoformat())
        detail = self.data(admin.get(f"/students/{row.student_id}"))
        self.assertEqual(detail["enrollment_start_date"], row.start_date.isoformat())
