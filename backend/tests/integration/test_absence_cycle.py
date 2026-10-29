"""Cycle complet des absences : appel, consultation, justificatif du parent, décision de l'administration.

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_absence_cycle
"""

import datetime

from sqlalchemy import text

from tests.integration.support import (
    ADMIN, GUARDIAN_ONE_CHILD, GUARDIAN_TWO_CHILDREN, STUDENT, TEACHER, ApiTestCase,
)

CHILD = "u000001"  # Abdoulaye Diallo, enfant du parent p000002


class AbsenceCycleTests(ApiTestCase):
    def setUp(self):
        super().setUp()
        row = self.db.execute(
            text(
                """SELECT ta.id AS assignment_id, e.id AS enrollment_id, s.id AS student_id
                   FROM teacher_assignments ta
                   JOIN teachers t ON t.id = ta.teacher_id
                   JOIN accounts ta_acc ON ta_acc.id = t.account_id AND ta_acc.registration_number = :teacher
                   JOIN class_subjects cs ON cs.id = ta.class_subject_id
                   JOIN student_enrollments e ON e.class_id = cs.class_id AND e.end_date IS NULL
                   JOIN students s ON s.id = e.student_id
                   JOIN accounts s_acc ON s_acc.id = s.account_id AND s_acc.registration_number = :child
                   WHERE ta.start_date <= CURRENT_DATE AND (ta.end_date IS NULL OR ta.end_date >= CURRENT_DATE)
                   LIMIT 1"""
            ),
            {"teacher": TEACHER, "child": CHILD},
        ).mappings().first()
        if row is None:
            self.skipTest("Aucune affectation de l'enseignant e000001 dans la classe de l'élève u000001.")
        self.assignment_id, self.enrollment_id, self.student_id = (
            str(row["assignment_id"]), str(row["enrollment_id"]), str(row["student_id"]),
        )

    def record_absence(self, days_ago=0, hour=17):
        """Fait faire un appel par l'enseignant ; retourne l'identifiant de l'absence."""

        day = (datetime.date.today() - datetime.timedelta(days=days_ago)).isoformat()
        response = self.client(TEACHER).post(
            "/attendance/events",
            json={
                "teacher_assignment_id": self.assignment_id,
                "attendance_date": day,
                "course_start_time": f"{hour:02d}:10",
                "course_end_time": f"{hour:02d}:50",
                "incidents": [{"student_enrollment_id": self.enrollment_id, "incident_type": "ABSENT"}],
            },
        )
        self.assertIn(response.status_code, (200, 201), response.text[:200])
        return str(self.db.execute(
            text(
                """SELECT r.id FROM attendance_records r JOIN attendance_events ev ON ev.id = r.attendance_event_id
                   WHERE r.student_enrollment_id = :e AND ev.attendance_date = :d AND ev.course_start_time = :t"""
            ),
            {"e": self.enrollment_id, "d": day, "t": datetime.time(hour, 10)},
        ).scalar_one())

    def justify(self, record_id, matricule=GUARDIAN_TWO_CHILDREN, reason="Rendez-vous médical"):
        return self.client(matricule).post(
            f"/guardian/children/{self.student_id}/attendance/{record_id}/justification",
            data={"reason": reason},
        )

    def status_of(self, record_id):
        return self.db.execute(
            text("SELECT justification_status FROM attendance_records WHERE id = :i"), {"i": record_id}
        ).scalar_one()

    def test_full_cycle_teacher_parent_admin(self):
        record = self.record_absence()
        self.assertEqual(self.status_of(record), "UNJUSTIFIED")

        # le parent voit l'absence de son enfant
        parent_view = self.data(self.client(GUARDIAN_TWO_CHILDREN).get(f"/guardian/children/{self.student_id}/attendance"))
        self.assertTrue(any(item["id"] == record for item in parent_view["incidents"]))

        # le parent justifie : l'incident passe « en attente »
        self.assertEqual(self.justify(record).status_code, 201)
        self.assertEqual(self.status_of(record), "PENDING")

        # un deuxième dépôt est refusé tant que le premier n'est pas traité
        self.assertIn(self.justify(record).status_code, (400, 409))

        # l'administration accepte
        review = self.client(ADMIN).patch(
            f"/attendance/records/{record}/justification", json={"status": "JUSTIFIED", "review_comment": "Certificat reçu"}
        )
        self.assertEqual(review.status_code, 200, review.text[:200])
        self.assertEqual(self.status_of(record), "JUSTIFIED")

        # un incident déjà justifié ne peut plus être re-soumis
        self.assertIn(self.justify(record).status_code, (400, 409))

    def test_a_rejected_justification_cannot_be_resubmitted(self):
        record = self.record_absence(hour=16)
        self.assertEqual(self.justify(record).status_code, 201)
        review = self.client(ADMIN).patch(
            f"/attendance/records/{record}/justification", json={"status": "REJECTED", "review_comment": "Non recevable"}
        )
        self.assertEqual(review.status_code, 200, review.text[:200])
        self.assertEqual(self.status_of(record), "REJECTED")
        self.assertIn(self.justify(record).status_code, (400, 409))

    def test_the_justification_deadline_is_enforced(self):
        record = self.record_absence(days_ago=15, hour=15)
        self.assertIn(self.justify(record).status_code, (400, 409))
        self.assertEqual(self.status_of(record), "UNJUSTIFIED")

    def test_a_too_short_reason_is_refused(self):
        record = self.record_absence(hour=14)
        self.assertIn(self.justify(record, reason="x").status_code, (400, 409, 422))
        self.assertEqual(self.status_of(record), "UNJUSTIFIED")

    def test_only_the_family_of_the_child_can_justify(self):
        record = self.record_absence(hour=13)
        self.assertEqual(self.justify(record, matricule=GUARDIAN_ONE_CHILD).status_code, 404)
        self.assertEqual(self.status_of(record), "UNJUSTIFIED")

    def test_students_and_teachers_cannot_review_a_justification(self):
        record = self.record_absence(hour=12)
        self.assertEqual(self.justify(record).status_code, 201)
        for matricule in (STUDENT, TEACHER):
            response = self.client(matricule).patch(
                f"/attendance/records/{record}/justification", json={"status": "JUSTIFIED"}
            )
            self.assertEqual(response.status_code, 403, matricule)
        self.assertEqual(self.status_of(record), "PENDING")

    def test_an_unsupported_file_type_is_refused(self):
        record = self.record_absence(hour=11)
        response = self.client(GUARDIAN_TWO_CHILDREN).post(
            f"/guardian/children/{self.student_id}/attendance/{record}/justification",
            data={"reason": "Certificat joint"},
            files={"document": ("virus.exe", b"MZ....", "application/x-msdownload")},
        )
        self.assertIn(response.status_code, (400, 409, 415, 422))
        self.assertEqual(self.status_of(record), "UNJUSTIFIED")

    def test_a_review_comment_that_is_too_short_is_refused_with_a_clear_message(self):
        record = self.record_absence(hour=10)
        self.assertEqual(self.justify(record).status_code, 201)
        response = self.client(ADMIN).patch(
            f"/attendance/records/{record}/justification", json={"status": "JUSTIFIED", "review_comment": "OK"}
        )
        self.assertEqual(response.status_code, 422)
        self.assertIn("3 caractères", response.json()["message"])
        self.assertEqual(self.status_of(record), "PENDING")

    def test_an_empty_review_comment_is_accepted(self):
        record = self.record_absence(hour=9)
        self.assertEqual(self.justify(record).status_code, 201)
        response = self.client(ADMIN).patch(
            f"/attendance/records/{record}/justification", json={"status": "JUSTIFIED", "review_comment": "  "}
        )
        self.assertEqual(response.status_code, 200, response.text[:200])
        self.assertEqual(self.status_of(record), "JUSTIFIED")
