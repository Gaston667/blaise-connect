"""Tableau de bord de l'enseignant : réservé aux enseignants, chiffres cohérents avec la base.

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_teacher_dashboard
"""

from sqlalchemy import text

from tests.integration.support import ADMIN, STUDENT, TEACHER, ApiTestCase


class TeacherDashboardTests(ApiTestCase):
    def dashboard(self, matricule=TEACHER):
        return self.client(matricule).get("/teachers/me/dashboard")

    def test_a_teacher_gets_a_complete_dashboard(self):
        response = self.dashboard()
        self.assertEqual(response.status_code, 200, response.text[:200])
        data = self.data(response)
        for key in (
            "today", "today_courses", "next_course", "incomplete_evaluations_count",
            "incomplete_evaluations", "to_review_count", "my_waiting_count", "holiday_today",
        ):
            self.assertIn(key, data)
        self.assertLessEqual(len(data["incomplete_evaluations"]), data["incomplete_evaluations_count"])

    def test_only_teachers_can_open_it(self):
        for matricule in (ADMIN, STUDENT):
            self.assertEqual(self.dashboard(matricule).status_code, 403, matricule)

    def test_the_incomplete_evaluations_match_the_database(self):
        data = self.data(self.dashboard())
        expected = self.db.execute(
            text(
                """
                SELECT COUNT(*) FROM (
                    SELECT assessment.id,
                           (SELECT COUNT(*) FROM student_enrollments e
                            WHERE e.class_id = class_subject.class_id
                              AND e.start_date <= assessment.assessment_date
                              AND (e.end_date IS NULL OR e.end_date >= assessment.assessment_date)) AS expected,
                           (SELECT COUNT(*) FROM grades g WHERE g.assessment_id = assessment.id) AS entered
                    FROM assessments assessment
                    JOIN teacher_assignments assignment ON assignment.id = assessment.teacher_assignment_id
                    JOIN teachers teacher ON teacher.id = assignment.teacher_id
                    JOIN accounts account ON account.id = teacher.account_id
                    JOIN class_subjects class_subject ON class_subject.id = assignment.class_subject_id
                    JOIN classes c ON c.id = class_subject.class_id
                    JOIN school_years y ON y.id = c.school_year_id
                    WHERE account.registration_number = :matricule
                      AND y.is_current AND assessment.assessment_date <= CURRENT_DATE
                ) AS evaluations WHERE entered < expected
                """
            ),
            {"matricule": TEACHER},
        ).scalar_one()
        self.assertEqual(data["incomplete_evaluations_count"], expected)

    def test_no_course_is_shown_during_the_holidays(self):
        year = self.db.execute(text("SELECT id FROM school_years WHERE is_current")).scalar_one()
        self.db.execute(
            text(
                """INSERT INTO school_holidays (school_year_id, name, start_date, end_date)
                   VALUES (:year, 'Vacances de test', CURRENT_DATE, CURRENT_DATE)"""
            ),
            {"year": year},
        )
        data = self.data(self.dashboard())
        self.assertEqual(data["holiday_today"], "Vacances de test")
        self.assertEqual(data["today_courses"], [])
