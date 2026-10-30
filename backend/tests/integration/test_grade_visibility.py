"""Un élève et sa famille ne voient une note que lorsque l'évaluation est complète.

Une évaluation est complète quand chaque élève inscrit à sa date a reçu une note ou
une absence. Tant que l'enseignant n'a pas tout saisi, aucune note de l'évaluation
n'apparaît (liste, détail, moyennes), ce qui évite de comparer les résultats avant la fin.

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_grade_visibility
"""

from sqlalchemy import text

from tests.integration.support import GUARDIAN_TWO_CHILDREN, STUDENT, ApiTestCase

# Évaluation où l'élève a une note mais où au moins un camarade n'en a pas encore.
FIND_INCOMPLETE_SQL = """
    SELECT assessment.id AS assessment_id, class_subject.class_id,
           assessment.assessment_date
    FROM grades AS grade
    JOIN student_enrollments AS mine ON mine.id = grade.student_enrollment_id
    JOIN assessments AS assessment ON assessment.id = grade.assessment_id
    JOIN teacher_assignments AS assignment ON assignment.id = assessment.teacher_assignment_id
    JOIN class_subjects AS class_subject ON class_subject.id = assignment.class_subject_id
    WHERE mine.student_id = :student_id
      AND EXISTS (
          SELECT 1 FROM student_enrollments AS expected
          WHERE expected.class_id = class_subject.class_id
            AND expected.start_date <= assessment.assessment_date
            AND (expected.end_date IS NULL OR expected.end_date >= assessment.assessment_date)
            AND NOT EXISTS (
                SELECT 1 FROM grades AS entered
                WHERE entered.assessment_id = assessment.id
                  AND entered.student_enrollment_id = expected.id
            )
      )
    LIMIT 1
"""

COMPLETE_ASSESSMENT_SQL = """
    INSERT INTO grades (assessment_id, student_enrollment_id, result_type, score)
    SELECT :assessment_id, expected.id, 'SCORED', 0
    FROM student_enrollments AS expected
    WHERE expected.class_id = :class_id
      AND expected.start_date <= :assessment_date
      AND (expected.end_date IS NULL OR expected.end_date >= :assessment_date)
      AND NOT EXISTS (
          SELECT 1 FROM grades AS entered
          WHERE entered.assessment_id = :assessment_id
            AND entered.student_enrollment_id = expected.id
      )
"""


class GradeVisibilityTests(ApiTestCase):
    def student_id_of(self, matricule):
        return self.db.execute(
            text(
                """SELECT student.id FROM students student
                   JOIN accounts account ON account.id = student.account_id
                   WHERE account.registration_number = :m"""
            ),
            {"m": matricule},
        ).scalar_one()

    def child_with_incomplete_assessment(self, guardian_matricule):
        rows = self.db.execute(
            text(
                """SELECT link.student_id FROM student_guardians link
                   JOIN guardians guardian ON guardian.id = link.guardian_id
                   JOIN accounts account ON account.id = guardian.account_id
                   WHERE account.registration_number = :m"""
            ),
            {"m": guardian_matricule},
        ).scalars().all()
        for student_id in rows:
            if self.db.execute(text(FIND_INCOMPLETE_SQL), {"student_id": student_id}).first():
                return student_id
        self.skipTest("Aucun enfant de ce parent n'a une évaluation incomplète.")

    # --- vues : (liste, détail, synthèse) selon que c'est l'élève ou son parent ---
    def student_views(self):
        http = self.client(STUDENT)
        return (
            self.student_id_of(STUDENT),
            lambda: self.data(http.get("/students/me/grades")),
            lambda assessment_id: http.get(f"/students/me/grades/assessments/{assessment_id}"),
            lambda: self.data(http.get("/students/me/grades/summary")),
        )

    def guardian_views(self):
        http = self.client(GUARDIAN_TWO_CHILDREN)
        student_id = self.child_with_incomplete_assessment(GUARDIAN_TWO_CHILDREN)
        base = f"/guardian/children/{student_id}"
        return (
            student_id,
            lambda: self.data(http.get(f"{base}/grades")),
            lambda assessment_id: http.get(f"{base}/grades/assessments/{assessment_id}"),
            lambda: self.data(http.get(f"{base}/grades/summary")),
        )

    def check_rule(self, views):
        student_id, list_grades, get_detail, get_summary = views
        found = self.db.execute(text(FIND_INCOMPLETE_SQL), {"student_id": student_id}).first()
        if found is None:
            self.skipTest("Aucune évaluation incomplète avec une note pour cet élève.")
        assessment_id = str(found.assessment_id)

        # 1) tant que la saisie n'est pas terminée : la note est invisible partout
        self.assertNotIn(assessment_id, {str(item["assessment_id"]) for item in list_grades()})
        self.assertEqual(get_detail(assessment_id).status_code, 404)
        self.assertGreaterEqual(get_summary()["pending_publication_count"], 1)

        # 2) dès que l'enseignant a saisi tous les élèves : elle devient visible
        self.db.execute(
            text(COMPLETE_ASSESSMENT_SQL),
            {
                "assessment_id": found.assessment_id,
                "class_id": found.class_id,
                "assessment_date": found.assessment_date,
            },
        )
        self.assertIn(assessment_id, {str(item["assessment_id"]) for item in list_grades()})
        self.assertEqual(get_detail(assessment_id).status_code, 200)

    def test_a_student_does_not_see_a_grade_until_every_classmate_has_one(self):
        self.check_rule(self.student_views())

    def test_a_parent_does_not_see_a_grade_until_every_classmate_has_one(self):
        self.check_rule(self.guardian_views())

    def test_the_averages_ignore_assessments_still_being_entered(self):
        student_id, list_grades, _, get_summary = self.student_views()
        visible = {str(item["assessment_id"]) for item in list_grades()}
        incomplete = self.db.execute(text(FIND_INCOMPLETE_SQL), {"student_id": student_id}).first()
        if incomplete is None:
            self.skipTest("Aucune évaluation incomplète avec une note pour cet élève.")
        self.assertNotIn(str(incomplete.assessment_id), visible)
        # la moyenne n'existe que si au moins une évaluation complète est visible
        if not visible:
            self.assertIsNone(get_summary()["overall_average"])
