"""Tests d'intégration des emplois du temps sur la base PostgreSQL de développement.

Ils ne tournent que si `RUN_DB_TESTS=1` et ne laissent aucune trace : chaque test
s'exécute dans une transaction annulée à la fin (les `commit` du service sont
remplacés par de simples `flush`).

    docker exec -e RUN_DB_TESTS=1 -w /app container-backend \
        python -m unittest tests.integration.test_timetable_database
"""

import datetime
import os
from collections import defaultdict
from unittest import SkipTest, TestCase

from sqlalchemy import text

RUN = os.getenv("RUN_DB_TESTS") == "1"


class TimetableDatabaseTests(TestCase):
    @classmethod
    def setUpClass(cls):
        if not RUN:
            raise SkipTest("RUN_DB_TESTS=1 est requis (base de développement).")
        from app.core.database import session_factory
        from app.services import timetable_service

        cls.service = timetable_service
        cls.session_factory = session_factory

    def setUp(self):
        self.db = self.session_factory()
        self.db.commit = self.db.flush  # rien n'est jamais validé
        admin = self.db.execute(
            text("SELECT id FROM accounts WHERE registration_number = 'a000001'")
        ).scalar_one_or_none()
        if admin is None:
            raise SkipTest("Les données de test (compte a000001) sont absentes.")
        self.admin = admin
        self.classes = self.db.execute(
            text(
                """
                SELECT c.id, l.name || ' ' || c.group_label AS name, l.code, l.education_stage AS stage
                FROM classes c JOIN class_levels l ON l.id = c.class_level_id
                JOIN school_years y ON y.id = c.school_year_id
                WHERE y.is_current ORDER BY l.display_order
                """
            )
        ).mappings().all()
        if not self.classes:
            raise SkipTest("Aucune classe dans l'année courante.")

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    # ------------------------------------------------------------------ non-régression
    def test_read_functions_used_by_the_screens_exist_and_work(self):
        service = self.service
        class_id = self.classes[0]["id"]
        self.assertIsInstance(service.get_class_timetable(self.db, str(class_id)), list)
        self.assertIsInstance(service.get_class_timetable(self.db, str(class_id), published_only=True), list)
        teacher = self.db.execute(text("SELECT id FROM teachers LIMIT 1")).scalar_one()
        self.assertIn("slots", service.get_teacher_timetable(self.db, str(teacher)))
        student = self.db.execute(
            text("SELECT student_id FROM student_enrollments WHERE end_date IS NULL LIMIT 1")
        ).scalar_one()
        self.assertIn("slots", service.get_student_timetable(self.db, str(student)))
        self.assertIsInstance(service.get_timetable_alerts(self.db), list)

    def test_startup_check_accepts_current_schema_and_rejects_a_missing_column(self):
        from app.core import schema_check
        from app.core.database import engine

        schema_check.verify_required_migrations(engine)
        original = schema_check.REQUIRED_COLUMNS
        schema_check.REQUIRED_COLUMNS = original + [("subjects", "colonne_inexistante", "999_test.sql")]
        try:
            with self.assertRaisesRegex(RuntimeError, "999_test.sql"):
                schema_check.verify_required_migrations(engine)
        finally:
            schema_check.REQUIRED_COLUMNS = original

    # ------------------------------------------------------------------ génération globale
    def test_generate_all_respects_every_hard_rule(self):
        result = self.service.generate_all_timetables(self.db, self.admin)
        self.assertEqual(result["skipped"], [])
        self.assertEqual(result["complete_count"], len(result["classes"]))

        def count(sql):
            return self.db.execute(text(sql)).scalar_one()

        self.assertEqual(count(
            """SELECT count(*) FROM timetable_slots a JOIN timetables ta ON ta.id = a.timetable_id
               JOIN teacher_assignments aa ON aa.id = a.teacher_assignment_id
               JOIN timetable_slots b ON b.id <> a.id AND b.day_of_week = a.day_of_week
                AND b.start_time < a.end_time AND b.end_time > a.start_time
               JOIN timetables tb ON tb.id = b.timetable_id
               JOIN teacher_assignments ab ON ab.id = b.teacher_assignment_id AND ab.teacher_id = aa.teacher_id
               WHERE ta.status = 'DRAFT' AND tb.status = 'DRAFT'"""), 0, "un enseignant est à deux endroits")
        self.assertEqual(count(
            """SELECT count(*) FROM timetable_slots a JOIN timetables ta ON ta.id = a.timetable_id
               JOIN timetable_slots b ON b.id <> a.id AND b.room_id = a.room_id AND b.day_of_week = a.day_of_week
                AND b.start_time < a.end_time AND b.end_time > a.start_time
               JOIN timetables tb ON tb.id = b.timetable_id
               WHERE a.room_id IS NOT NULL AND ta.status = 'DRAFT' AND tb.status = 'DRAFT'"""), 0, "une salle est occupée deux fois")
        for school_class in self.classes:
            self.assertEqual(
                self.service.get_student_specialty_overlaps(self.db, school_class["id"]), [],
                f"{school_class['name']} : un élève a deux spécialités en même temps",
            )

    def test_daily_limits_are_respected(self):
        self.service.generate_all_timetables(self.db, self.admin)
        for school_class in self.classes:
            slots = self.db.execute(
                text(
                    """SELECT s.day_of_week, s.start_time, s.end_time FROM timetable_slots s
                       JOIN timetables t ON t.id = s.timetable_id WHERE t.class_id = :c AND t.status = 'DRAFT'"""
                ),
                {"c": school_class["id"]},
            ).mappings().all()
            per_day = defaultdict(set)
            for slot in slots:
                per_day[slot["day_of_week"]].add((slot["start_time"], slot["end_time"]))
            cap = self.service.STAGE_MAX_DAY_MINUTES[school_class["stage"]]
            for day, intervals in per_day.items():
                minutes = sum((e.hour * 60 + e.minute) - (b.hour * 60 + b.minute) for b, e in intervals)
                self.assertLessEqual(minutes, cap, f"{school_class['name']} le jour {day}")

    def test_grouped_publication_passes_the_database_checks(self):
        self.service.generate_all_timetables(self.db, self.admin)
        result = self.service.publish_all_timetables(self.db, self.admin)
        self.assertEqual(len(result["published"]), len(self.classes))
        self.assertEqual(result["not_published"], [])

    def test_partial_overlap_with_the_published_timetable_is_refused(self):
        self.service.generate_all_timetables(self.db, self.admin)
        class_id = self.classes[0]["id"]
        configuration = self.service.get_class_timetable_configuration(self.db, class_id)
        requirements = [
            self.service.WeeklySubjectRequirementUpsert(
                class_subject_id=item["class_subject_id"], weekly_minutes=item["weekly_minutes"]
            )
            for item in configuration["requirements"] if item["weekly_minutes"]
        ]
        self.service.generate_timetable(
            self.db, class_id, requirements,
            configuration["school_year_start_date"] + datetime.timedelta(days=120),
            configuration["school_year_start_date"] + datetime.timedelta(days=150),
            self.admin,
        )
        with self.assertRaises(ValueError):
            self.service.validate_timetable(self.db, class_id, self.admin)

    # ------------------------------------------------------------------ créneaux verrouillés
    def test_manual_slot_is_locked_and_survives_a_regeneration(self):
        self.service.generate_all_timetables(self.db, self.admin)
        school_class = next(c for c in self.classes if c["code"] == "SECONDE")
        slots = self.service.get_class_timetable(self.db, str(school_class["id"]))
        victim = next(s for s in slots if s["subject_name"] == "Français")
        self.service.delete_timetable_slot(self.db, str(victim["id"]))
        taken = {(s["day_of_week"], str(s["start_time"])[:5]) for s in self.service.get_class_timetable(self.db, str(school_class["id"]))}
        free = next(
            (d, h) for d in (1, 2, 3, 4, 5) for h in ("08:00", "10:15", "13:15", "15:30")
            if (d, h) not in taken and (d, h) != (victim["day_of_week"], str(victim["start_time"])[:5])
        )
        start = datetime.time.fromisoformat(free[1])
        end = (datetime.datetime.combine(datetime.date.today(), start) + datetime.timedelta(hours=2)).time()
        self.service.create_timetable_slot(
            self.db, school_class["id"], victim["class_subject_id"], free[0], start, end, None, self.admin
        )
        self.service.generate_all_timetables(self.db, self.admin)
        kept = [
            s for s in self.service.get_class_timetable(self.db, str(school_class["id"]))
            if s["subject_name"] == "Français" and s["is_locked"]
        ]
        self.assertEqual([(s["day_of_week"], str(s["start_time"])[:5]) for s in kept], [free])

    # ------------------------------------------------------------------ cours particuliers
    def test_special_course_is_refused_during_student_lessons_and_accepted_when_free(self):
        service = self.service
        school_class = next(c for c in self.classes if c["code"] == "TERMINALE")
        student = self.db.execute(
            text(
                """SELECT s.id, e.id AS enrollment_id FROM student_enrollments e JOIN students s ON s.id = e.student_id
                   WHERE e.class_id = :c AND e.end_date IS NULL ORDER BY s.last_name LIMIT 1"""
            ),
            {"c": school_class["id"]},
        ).mappings().one()
        subject_id = self.db.execute(
            text(
                """SELECT cs.subject_id FROM class_subjects cs JOIN subjects s ON s.id = cs.subject_id
                   WHERE cs.class_id = :c AND s.name = 'Philosophie'"""
            ),
            {"c": school_class["id"]},
        ).scalar_one()
        lesson = self.db.execute(
            text(
                """SELECT sl.day_of_week, sl.start_time, sl.end_time FROM timetables t
                   JOIN timetable_slots sl ON sl.timetable_id = t.id
                   JOIN teacher_assignments a ON a.id = sl.teacher_assignment_id
                   JOIN class_subjects cs ON cs.id = a.class_subject_id
                   JOIN subjects sub ON sub.id = cs.subject_id
                   WHERE t.class_id = :c AND t.status = 'PUBLISHED' AND NOT sub.is_specialty LIMIT 1"""
            ),
            {"c": school_class["id"]},
        ).mappings().one()
        with self.assertRaises(ValueError):
            service.create_special_course(
                self.db, school_class["id"], student["id"], subject_id, "Soutien",
                lesson["day_of_week"], lesson["start_time"], lesson["end_time"], None, self.admin,
            )
        self.db.rollback()
        self.db.commit = self.db.flush
        suggestions = service.suggest_special_course_slots(self.db, school_class["id"], student["id"], subject_id, 60, limit=5)
        for suggestion in suggestions:
            clash = (
                suggestion["day_of_week"] == lesson["day_of_week"]
                and suggestion["start_time"] < lesson["end_time"]
                and suggestion["end_time"] > lesson["start_time"]
            )
            self.assertFalse(clash)
        if suggestions:
            chosen = suggestions[0]
            created = service.create_special_course(
                self.db, school_class["id"], student["id"], subject_id, "Soutien",
                chosen["day_of_week"], chosen["start_time"], chosen["end_time"], None, self.admin,
            )
            status = self.db.execute(text("SELECT status FROM special_courses WHERE id = :i"), {"i": created["id"]}).scalar_one()
            self.assertEqual(status, "PUBLISHED")
