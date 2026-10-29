"""Tests du planificateur d'emploi du temps (logique pure, sans base de données)."""

from datetime import time
from unittest import TestCase

from app.services.timetable_planner import PlannerSubject, plan_timetable


def _periods(duration=60, days=(1, 2, 3, 4, 5), morning=2, afternoon=2, start_hour=8):
    """Journées de `morning` + `afternoon` périodes, séparées par une pause."""

    periods = []
    for day in days:
        cursor = start_hour * 60
        for block in (morning, afternoon):
            for _ in range(block):
                periods.append(
                    {
                        "day_of_week": day,
                        "start_time": time(cursor // 60, cursor % 60),
                        "end_time": time((cursor + duration) // 60, (cursor + duration) % 60),
                        "duration": duration,
                    }
                )
                cursor += duration
            cursor += 90  # pause : jamais de bloc à cheval dessus
    return periods


def _subject(key, minutes, teacher=None, specialty=False, single=False):
    return PlannerSubject(
        key=key, name=key, teacher_id=teacher or f"t-{key}", subject_id=f"s-{key}",
        minutes=minutes, is_specialty=specialty, single_period_sessions=single,
    )


def _overlapping(first, second):
    return (
        first["day_of_week"] == second["day_of_week"]
        and first["start_time"] < second["end_time"]
        and first["end_time"] > second["start_time"]
    )


def _plan(subjects, periods=None, busy_teachers=(), busy_rooms=(), rooms=(), conflicts=(), groups=0):
    return plan_timetable(
        periods or _periods(), subjects, list(busy_teachers), list(busy_rooms),
        list(rooms), {frozenset(pair) for pair in conflicts}, seed="test", restarts=8,
        specialty_groups_target=groups,
    )


class TimetablePlannerTests(TestCase):
    def test_places_full_volume_without_overlap(self):
        result = _plan([_subject("maths", 240), _subject("francais", 240), _subject("hg", 180)])
        self.assertEqual(sum(result.remaining_minutes.values()), 0)
        for first in result.placements:
            for second in result.placements:
                if first is not second:
                    self.assertFalse(_overlapping(first, second))

    def test_specialties_chosen_together_never_overlap(self):
        subjects = [_subject("maths", 240, specialty=True), _subject("svt", 240, specialty=True)]
        result = _plan(subjects, conflicts=[("s-maths", "s-svt")])
        self.assertEqual(sum(result.remaining_minutes.values()), 0)
        maths = [p for p in result.placements if p["key"] == "maths"]
        svt = [p for p in result.placements if p["key"] == "svt"]
        for first in maths:
            for second in svt:
                self.assertFalse(_overlapping(first, second))

    def test_unrelated_specialties_share_the_same_block_exactly(self):
        subjects = [_subject("maths", 240, specialty=True), _subject("ses", 240, specialty=True)]
        result = _plan(subjects)
        for first in (p for p in result.placements if p["key"] == "maths"):
            for second in (p for p in result.placements if p["key"] == "ses"):
                if _overlapping(first, second):
                    self.assertEqual(
                        (first["start_time"], first["end_time"]),
                        (second["start_time"], second["end_time"]),
                    )

    def test_specialty_never_twice_the_same_day(self):
        result = _plan([_subject("maths", 360, specialty=True)])
        days = [p["day_of_week"] for p in result.placements]
        self.assertEqual(len(days), len(set(days)))

    def test_busy_teacher_is_respected(self):
        busy = [
            {"teacher_id": "prof", "day_of_week": day, "start_time": time(8, 0), "end_time": time(18, 0)}
            for day in (1, 2, 3)
        ]
        result = _plan([_subject("maths", 240, teacher="prof")], busy_teachers=busy)
        self.assertEqual(result.remaining_minutes["maths"], 0)
        self.assertTrue(all(p["day_of_week"] in (4, 5) for p in result.placements))

    def test_unavailable_teacher_leaves_unplaced_minutes(self):
        busy = [
            {"teacher_id": "prof", "day_of_week": day, "start_time": time(0, 0), "end_time": time(23, 59)}
            for day in (1, 2, 3, 4, 5)
        ]
        result = _plan([_subject("maths", 120, teacher="prof")], busy_teachers=busy)
        self.assertEqual(result.remaining_minutes["maths"], 120)

    def test_same_teacher_is_never_in_two_places(self):
        subjects = [
            _subject("maths", 240, teacher="prof", specialty=True),
            _subject("ses", 240, teacher="prof", specialty=True),
        ]
        result = _plan(subjects)
        for first in result.placements:
            for second in result.placements:
                if first is not second:
                    self.assertFalse(_overlapping(first, second))

    def test_busy_room_is_avoided_for_specialties(self):
        busy_rooms = [
            {"room_id": "r1", "day_of_week": day, "start_time": time(0, 0), "end_time": time(23, 59)}
            for day in (1, 2, 3, 4, 5)
        ]
        result = _plan([_subject("maths", 240, specialty=True)], busy_rooms=busy_rooms, rooms=["r1", "r2"])
        self.assertTrue(all(p["room_id"] == "r2" for p in result.placements))

    def test_two_specialties_in_one_block_get_different_rooms(self):
        subjects = [_subject("maths", 240, specialty=True), _subject("ses", 240, specialty=True)]
        result = _plan(subjects, rooms=["r1", "r2"])
        by_slot = {}
        for placement in result.placements:
            by_slot.setdefault((placement["day_of_week"], placement["start_time"]), []).append(placement["room_id"])
        for rooms in by_slot.values():
            self.assertEqual(len(rooms), len(set(rooms)))

    def test_one_session_per_subject_and_day_when_possible(self):
        result = _plan([_subject("anglais", 180, single=True)])
        days = [p["day_of_week"] for p in result.placements]
        self.assertEqual(len(days), len(set(days)))

    def test_days_are_compact_without_gaps(self):
        subjects = [_subject("maths", 240), _subject("francais", 240), _subject("hg", 180), _subject("eps", 120)]
        result = _plan(subjects)
        self.assertEqual(result.score[3], 0)

    def test_load_is_balanced_over_the_week(self):
        result = _plan([_subject("maths", 240), _subject("francais", 240), _subject("hg", 240), _subject("eps", 240)])
        minutes_by_day = {}
        for placement in result.placements:
            start = placement["start_time"].hour * 60 + placement["start_time"].minute
            end = placement["end_time"].hour * 60 + placement["end_time"].minute
            minutes_by_day[placement["day_of_week"]] = minutes_by_day.get(placement["day_of_week"], 0) + end - start
        self.assertLessEqual(max(minutes_by_day.values()) - min(minutes_by_day.values()), 120)

    def test_volume_not_multiple_of_lesson_is_rounded_up_with_a_note(self):
        result = _plan([_subject("hg", 90, single=True)])
        self.assertEqual(result.remaining_minutes["hg"], 0)
        self.assertTrue(any("arrondies" in note for note in result.notes))

    def test_works_with_45_minute_lessons(self):
        result = _plan([_subject("maths", 270), _subject("francais", 270)], periods=_periods(duration=45))
        self.assertEqual(sum(result.remaining_minutes.values()), 0)

    def test_single_period_sessions_for_young_pupils(self):
        result = _plan([_subject("lecture", 180, single=True)])
        self.assertTrue(all(p["end_time"].hour * 60 + p["end_time"].minute - p["start_time"].hour * 60 - p["start_time"].minute == 60
                            for p in result.placements))

    def test_block_that_cannot_fit_is_split_instead_of_lost(self):
        # Une seule période libre par jour : aucun bloc de 2 h n'est possible.
        periods = _periods(morning=1, afternoon=1)
        result = _plan([_subject("maths", 120)], periods=periods)
        self.assertEqual(result.remaining_minutes["maths"], 0)

    def test_result_is_deterministic(self):
        subjects = [_subject("maths", 240), _subject("francais", 240), _subject("hg", 180)]
        first = _plan(subjects)
        second = _plan(subjects)
        self.assertEqual(first.placements, second.placements)


class SpecialtyBarretteTests(TestCase):
    def _slots_of(self, result, key):
        return sorted((p["day_of_week"], p["start_time"], p["end_time"]) for p in result.placements if p["key"] == key)

    def _six_specialties(self):
        return [_subject(name, 240, specialty=True) for name in ("maths", "svt", "pc", "ses", "hggsp", "nsi")]

    def test_specialties_of_a_barrette_share_exactly_the_same_hours(self):
        # Chaque élève prend une spé dans chacune des 3 barrettes : maths/svt/pc se combinent entre barrettes.
        conflicts = [
            ("s-maths", "s-ses"), ("s-maths", "s-nsi"), ("s-svt", "s-ses"), ("s-svt", "s-hggsp"),
            ("s-pc", "s-hggsp"), ("s-pc", "s-nsi"), ("s-maths", "s-svt"), ("s-maths", "s-pc"), ("s-svt", "s-pc"),
            ("s-ses", "s-hggsp"), ("s-ses", "s-nsi"), ("s-hggsp", "s-nsi"),
        ]
        result = _plan(self._six_specialties(), conflicts=conflicts, groups=3, rooms=["r1", "r2", "r3", "r4", "r5", "r6"],
                       periods=_periods(morning=3, afternoon=3))
        self.assertEqual(sum(result.remaining_minutes.values()), 0)
        for first in ("maths", "svt", "pc", "ses", "hggsp", "nsi"):
            for second in ("maths", "svt", "pc", "ses", "hggsp", "nsi"):
                if first < second and frozenset(("s-" + first, "s-" + second)) not in {frozenset(c) for c in conflicts}:
                    self.assertEqual(self._slots_of(result, first), self._slots_of(result, second))

    def test_without_known_choices_specialties_are_split_into_target_barrettes(self):
        result = _plan(self._six_specialties(), groups=3, periods=_periods(morning=3, afternoon=3))
        distinct_schedules = {tuple(self._slots_of(result, name)) for name in ("maths", "svt", "pc", "ses", "hggsp", "nsi")}
        self.assertEqual(len(distinct_schedules), 3)

    def test_two_specialties_of_a_student_never_overlap_across_barrettes(self):
        result = _plan(self._six_specialties(), groups=3, periods=_periods(morning=3, afternoon=3))
        names = ("maths", "svt", "pc", "ses", "hggsp", "nsi")
        by_schedule = {}
        for name in names:
            by_schedule.setdefault(tuple(self._slots_of(result, name)), []).append(name)
        groups = list(by_schedule.values())
        # un élève qui prend une spé par barrette n'a jamais deux spés en même temps
        for first_group in groups:
            for second_group in groups:
                if first_group is not second_group:
                    for a in first_group:
                        for b in second_group:
                            for x in (p for p in result.placements if p["key"] == a):
                                for y in (p for p in result.placements if p["key"] == b):
                                    self.assertFalse(_overlapping(x, y))


class DailyLimitsAndDiagnosticsTests(TestCase):
    def _minutes_by_day(self, result):
        total = {}
        for p in result.placements:
            total[p["day_of_week"]] = total.get(p["day_of_week"], 0) + (
                p["end_time"].hour * 60 + p["end_time"].minute - p["start_time"].hour * 60 - p["start_time"].minute
            )
        return total

    def test_class_day_limit_is_respected(self):
        subjects = [_subject(name, 240) for name in ("maths", "francais", "hg", "svt")]
        result = plan_timetable(_periods(), subjects, [], [], [], set(), seed="t", restarts=6, max_day_minutes=240)
        self.assertTrue(all(minutes <= 240 for minutes in self._minutes_by_day(result).values()))

    def test_teacher_daily_maximum_counts_hours_already_given_elsewhere(self):
        busy = [{"teacher_id": "prof", "day_of_week": day, "start_time": time(8, 0), "end_time": time(11, 0)} for day in (1, 2, 3, 4, 5)]
        result = plan_timetable(
            _periods(), [_subject("maths", 240, teacher="prof")], busy, [], [], set(),
            seed="t", restarts=6, teacher_max_day_minutes=300,
        )
        # 3 h déjà données chaque jour : au plus 2 h de plus par jour
        self.assertTrue(all(minutes <= 120 for minutes in self._minutes_by_day(result).values()))
        self.assertEqual(result.remaining_minutes["maths"], 0)

    def test_sessions_of_a_subject_avoid_consecutive_days(self):
        result = _plan([_subject("maths", 120, single=True)])
        days = sorted(p["day_of_week"] for p in result.placements)
        self.assertEqual(len(days), 2)
        self.assertGreater(days[1] - days[0], 1)

    def test_unplaced_hours_come_with_a_reason(self):
        busy = [
            {"teacher_id": "prof", "day_of_week": day, "start_time": time(0, 0), "end_time": time(23, 59)}
            for day in (1, 2, 3, 4, 5)
        ]
        result = _plan([_subject("maths", 120, teacher="prof")], busy_teachers=busy)
        self.assertIn("enseignant", result.reasons["maths"])


class LockedSlotsTests(TestCase):
    def _fixed(self, key, day, start, end, room=None):
        return {"key": key, "day_of_week": day, "start_time": start, "end_time": end, "room_id": room}

    def test_locked_slot_is_kept_and_counts_toward_the_volume(self):
        fixed = [self._fixed("maths", 3, time(8, 0), time(10, 0))]
        result = plan_timetable(
            _periods(), [_subject("maths", 240)], [], [], [], set(), seed="t", restarts=6, fixed_placements=fixed,
        )
        locked = [p for p in result.placements if p.get("locked")]
        self.assertEqual([(p["day_of_week"], p["start_time"], p["end_time"]) for p in locked], [(3, time(8, 0), time(10, 0))])
        self.assertEqual(result.remaining_minutes["maths"], 0)
        total = sum(p["end_time"].hour * 60 + p["end_time"].minute - p["start_time"].hour * 60 - p["start_time"].minute for p in result.placements)
        self.assertEqual(total, 240)

    def test_other_courses_are_planned_around_a_locked_slot(self):
        fixed = [self._fixed("maths", 1, time(8, 0), time(10, 0))]
        result = plan_timetable(
            _periods(), [_subject("maths", 120), _subject("francais", 240)], [], [], [], set(),
            seed="t", restarts=6, fixed_placements=fixed,
        )
        for first in result.placements:
            for second in result.placements:
                if first is not second:
                    self.assertFalse(_overlapping(first, second))

    def test_locked_slot_of_unknown_subject_is_ignored(self):
        fixed = [self._fixed("inconnue", 1, time(8, 0), time(10, 0))]
        result = plan_timetable(
            _periods(), [_subject("maths", 120)], [], [], [], set(), seed="t", restarts=4, fixed_placements=fixed,
        )
        self.assertFalse(any(p.get("locked") for p in result.placements))
