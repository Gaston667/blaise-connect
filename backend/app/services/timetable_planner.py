"""Planificateur d'emploi du temps d'une classe.

Logique pure, sans accès à la base : elle reçoit les créneaux disponibles, les
matières à placer et les occupations déjà connues, puis propose le meilleur
placement trouvé. Le service `timetable_service` charge les données, appelle
`plan_timetable` et enregistre le résultat.

Règles dures (jamais violées) :
- la classe n'a qu'un cours régulier à la fois ;
- un enseignant n'est jamais à deux endroits en même temps ;
- une salle n'est jamais occupée deux fois en même temps ;
- deux spécialités choisies par un même élève n'ont jamais lieu en même temps ;
- les spécialités se déroulent en blocs identiques (« barrettes ») : deux
  spécialités sont soit exactement au même moment, soit totalement séparées ;
- une spécialité n'a lieu qu'une fois par jour.

Règles souples (optimisées par score) : peu de trous dans la journée, jours
équilibrés, une matière une seule fois par jour, journées démarrant tôt.
Plusieurs essais déterministes sont comparés, le meilleur est conservé.
"""

from __future__ import annotations

import math
import random
from collections import Counter, defaultdict
from dataclasses import dataclass, field, replace
from datetime import time

WEIGHT_GAP = 40
WEIGHT_LOAD = 6
WEIGHT_POSITION = 1
WEIGHT_ADJACENT_DAY = 60
DEFAULT_RESTARTS = 24
EXTRA_RESTARTS = 200
TARGET_BLOCK_MINUTES = 120


@dataclass
class PlannerSubject:
    """Matière d'une classe à placer dans la semaine."""

    key: object
    name: str
    teacher_id: object
    subject_id: object
    minutes: int
    is_specialty: bool = False
    # Séances d'une seule période (EMC, langues, primaire...) au lieu de blocs.
    single_period_sessions: bool = False


@dataclass
class PlanResult:
    """Placement retenu, avec ce qui n'a pas pu être placé et les ajustements."""

    placements: list[dict]
    remaining_minutes: dict
    notes: list[str]
    score: tuple
    reasons: dict = field(default_factory=dict)


def _minutes(value: time) -> int:
    return value.hour * 60 + value.minute


def _overlap(start_a: time, end_a: time, start_b: time, end_b: time) -> bool:
    return start_a < end_b and end_a > start_b


def _gaps(indexes: set[int]) -> int:
    """Nombre de périodes vides entre la première et la dernière période occupées."""

    if not indexes:
        return 0
    return (max(indexes) - min(indexes) + 1) - len(indexes)


class _Layout:
    """Périodes disponibles regroupées par jour, avec les blocs contigus possibles."""

    def __init__(self, periods: list[dict]):
        self.by_day: dict[int, list[dict]] = defaultdict(list)
        for period in sorted(periods, key=lambda item: (item["day_of_week"], item["start_time"])):
            self.by_day[period["day_of_week"]].append(period)
        self._positions: dict[int, list[tuple[int, int]]] = {}

    def positions(self, size: int) -> list[tuple[int, int]]:
        """Débuts (jour, index) où `size` périodes consécutives, sans pause, existent."""

        if size not in self._positions:
            found = []
            for day, day_periods in sorted(self.by_day.items()):
                for index in range(len(day_periods) - size + 1):
                    block = day_periods[index:index + size]
                    if all(block[k]["end_time"] == block[k + 1]["start_time"] for k in range(size - 1)):
                        found.append((day, index))
            self._positions[size] = found
        return self._positions[size]

    def span(self, day: int, index: int, size: int) -> tuple[time, time]:
        block = self.by_day[day][index:index + size]
        return block[0]["start_time"], block[-1]["end_time"]

    def duration(self, day: int, index: int, size: int) -> int:
        return sum(period["duration"] for period in self.by_day[day][index:index + size])

    @property
    def base_duration(self) -> int:
        durations = Counter(period["duration"] for periods in self.by_day.values() for period in periods)
        return durations.most_common(1)[0][0] if durations else 60


def _session_sizes(subject: PlannerSubject, base_duration: int, block_periods: int, notes: list[str]) -> list[int]:
    """Découpe le volume d'une matière en séances (en nombre de périodes)."""

    if subject.minutes <= 0:
        return []
    units = max(1, math.ceil(subject.minutes / base_duration))
    if subject.is_specialty:
        sessions = math.ceil(units / block_periods)
        scheduled = sessions * block_periods * base_duration
        if scheduled != subject.minutes:
            notes.append(
                f"{subject.name} : {subject.minutes} min demandées, arrondies à {scheduled} min "
                f"(blocs de {block_periods * base_duration} min)."
            )
        return [block_periods] * sessions
    size = 1 if subject.single_period_sessions else block_periods
    full, rest = divmod(units, size)
    if units * base_duration != subject.minutes:
        notes.append(
            f"{subject.name} : {subject.minutes} min demandées, arrondies à {units * base_duration} min "
            f"(cours de {base_duration} min)."
        )
    return [size] * full + ([rest] if rest else [])


def _build_specialty_groups(subjects, conflicting_pairs, target_groups) -> list[list[PlannerSubject]]:
    """Regroupe les spécialités en barrettes : une barrette ne contient que des
    spécialités qu'aucun élève ne choisit ensemble, et toutes ses spécialités ont
    les mêmes horaires. Sans choix d'élèves connus, on répartit en `target_groups`
    barrettes (3 en Première, 2 en Terminale) pour qu'aucun élève ne soit bloqué.
    """

    specialties = [subject for subject in subjects if subject.is_specialty]
    degree = {
        subject.key: sum(1 for pair in conflicting_pairs if subject.subject_id in pair)
        for subject in specialties
    }

    def color(order) -> list[list[PlannerSubject]]:
        groups: list[list[PlannerSubject]] = []
        for subject in order:
            for group in groups:
                if all(frozenset((member.subject_id, subject.subject_id)) not in conflicting_pairs for member in group):
                    group.append(subject)
                    break
            else:
                groups.append([subject])
        return groups

    # Coloration gloutonne répétée dans plusieurs ordres : on garde le plus petit
    # nombre de barrettes, puis la répartition la plus équilibrée.
    base_order = sorted(specialties, key=lambda item: (-degree[item.key], item.name))
    groups = color(base_order)
    rng = random.Random("barrettes")
    for _ in range(300):
        order = base_order[:]
        rng.shuffle(order)
        candidate = color(order)
        if (len(candidate), max(map(len, candidate), default=0)) < (len(groups), max(map(len, groups), default=0)):
            groups = candidate
    # Répartition équilibrée quand moins de barrettes que nécessaire (ex. aucun choix connu).
    while len(groups) < target_groups and any(len(group) > 1 for group in groups):
        largest = max(groups, key=len)
        groups.append([largest.pop()])
    return groups


def plan_timetable(
    periods: list[dict],
    subjects: list[PlannerSubject],
    busy_teachers: list[dict],
    busy_rooms: list[dict],
    room_ids: list,
    conflicting_pairs: set[frozenset],
    seed: str = "",
    restarts: int = DEFAULT_RESTARTS,
    specialty_groups_target: int = 0,
    max_day_minutes: int | None = None,
    teacher_max_day_minutes: int | None = None,
    fixed_placements: list[dict] | None = None,
) -> PlanResult:
    """Retourne le meilleur placement trouvé parmi plusieurs essais déterministes."""

    layout = _Layout(periods)
    notes: list[str] = []
    base = layout.base_duration
    block_periods = max(1, round(TARGET_BLOCK_MINUTES / base))
    # Les créneaux verrouillés (placés à la main) sont conservés : seul le volume restant est planifié.
    fixed_placements = [item for item in (fixed_placements or []) if item["key"] in {subject.key for subject in subjects}]
    fixed_minutes: Counter = Counter()
    for item in fixed_placements:
        fixed_minutes[item["key"]] += _minutes(item["end_time"]) - _minutes(item["start_time"])
    session_sizes = {
        subject.key: _session_sizes(
            replace(subject, minutes=max(0, subject.minutes - fixed_minutes[subject.key])),
            base, block_periods, notes,
        )
        for subject in subjects
    }

    teacher_busy: dict[tuple, list[tuple[time, time]]] = defaultdict(list)
    for busy in busy_teachers:
        teacher_busy[(busy["teacher_id"], busy["day_of_week"])].append((busy["start_time"], busy["end_time"]))
    room_busy: dict[tuple, list[tuple[time, time]]] = defaultdict(list)
    for busy in busy_rooms:
        room_busy[(busy["room_id"], busy["day_of_week"])].append((busy["start_time"], busy["end_time"]))
    teacher_weight = Counter(busy["teacher_id"] for busy in busy_teachers)
    conflict_count = Counter()
    for pair in conflicting_pairs:
        for subject_id in pair:
            conflict_count[subject_id] += 1

    teacher_base_load: Counter = Counter()
    for busy in busy_teachers:
        teacher_base_load[(busy["teacher_id"], busy["day_of_week"])] += _minutes(busy["end_time"]) - _minutes(busy["start_time"])
    limits = {
        "class_day_periods": (max_day_minutes // base) if max_day_minutes else None,
        "teacher_day_minutes": teacher_max_day_minutes,
        "teacher_base_load": teacher_base_load,
        "fixed": fixed_placements,
    }
    specialty_groups = _build_specialty_groups(subjects, conflicting_pairs, specialty_groups_target)
    best: PlanResult | None = None
    attempt = 0
    # Un minimum d'essais pour optimiser la qualité ; tant que des heures restent
    # non placées, on insiste (jusqu'à EXTRA_RESTARTS essais supplémentaires).
    while attempt < max(1, restarts) or ((best.score[0] > 0 or best.score[1] > 0) and attempt < restarts + EXTRA_RESTARTS):
        rng = random.Random(f"{seed}|{attempt}")
        result = _run_once(
            layout, subjects, session_sizes, teacher_busy, room_busy, room_ids,
            conflicting_pairs, teacher_weight, conflict_count, rng, attempt, specialty_groups, limits,
        )
        if best is None or result.score < best.score:
            best = result
        attempt += 1
    best.notes = notes + best.notes
    return best


def _run_once(layout, subjects, session_sizes, teacher_busy, room_busy, room_ids,
              conflicting_pairs, teacher_weight, conflict_count, rng, attempt,
              specialty_groups, limits) -> PlanResult:
    occupancy: dict[tuple[int, int], tuple] = {}
    barrettes: dict[tuple, list[dict]] = defaultdict(list)
    teacher_use: dict[tuple, list[tuple[time, time]]] = defaultdict(list)
    subject_days: dict[object, Counter] = defaultdict(Counter)
    day_indexes: dict[int, set[int]] = defaultdict(set)
    placements: list[dict] = []
    placed_minutes: Counter = Counter()
    notes: list[str] = []

    subject_by_key = {subject.key: subject for subject in subjects}
    for fixed in limits["fixed"]:
        subject = subject_by_key[fixed["key"]]
        day, start, end = fixed["day_of_week"], fixed["start_time"], fixed["end_time"]
        covered = [
            index for index, period in enumerate(layout.by_day.get(day, []))
            if _overlap(period["start_time"], period["end_time"], start, end)
        ]
        placements.append(
            {
                "key": subject.key, "subject_name": subject.name, "day_of_week": day,
                "start_time": start, "end_time": end, "room_id": fixed.get("room_id"), "locked": True,
            }
        )
        teacher_use[(subject.teacher_id, day)].append((start, end))
        subject_days[subject.key][day] += 1
        day_indexes[day] |= set(covered)
        placed_minutes[subject.key] += _minutes(end) - _minutes(start)
        if covered and subject.is_specialty:
            barrette = ("S", day, covered[0], len(covered))
            barrettes[barrette].append({"subject_id": subject.subject_id, "room_id": fixed.get("room_id")})
            for index in covered:
                occupancy[(day, index)] = barrette
        elif covered:
            for index in covered:
                occupancy[(day, index)] = ("R", subject.key)

    def noise() -> float:
        return rng.random() * (3 + attempt // 8) if attempt else 0.0

    def teacher_is_free(teacher_id, day, start, end) -> bool:
        for busy_start, busy_end in teacher_busy.get((teacher_id, day), ()):
            if _overlap(busy_start, busy_end, start, end):
                return False
        for used_start, used_end in teacher_use.get((teacher_id, day), ()):
            if _overlap(used_start, used_end, start, end):
                return False
        return not teacher_over_limit(teacher_id, day, start, end)

    def teacher_over_limit(teacher_id, day, start, end) -> bool:
        """Plafond d'heures d'enseignement d'un professeur sur une même journée."""

        limit = limits["teacher_day_minutes"]
        if not limit:
            return False
        load = limits["teacher_base_load"][(teacher_id, day)] + sum(
            _minutes(used_end) - _minutes(used_start) for used_start, used_end in teacher_use.get((teacher_id, day), ())
        )
        return load + _minutes(end) - _minutes(start) > limit

    def class_day_full(day, new_periods) -> bool:
        """Plafond d'heures de cours de la classe sur une même journée."""

        cap = limits["class_day_periods"]
        return bool(cap) and len(day_indexes[day]) + new_periods > cap

    def placement_cost(subject, day, index, size, new_indexes) -> float:
        before = day_indexes[day]
        after = before | new_indexes
        load_before, load_after = len(before), len(after)
        cost = WEIGHT_GAP * (_gaps(after) - _gaps(before))
        cost += WEIGHT_LOAD * (load_after ** 2 - load_before ** 2)
        cost += WEIGHT_POSITION * index
        if not subject.is_specialty:
            cost += 500 * subject_days[subject.key][day]
            # Répartir les séances d'une matière sur la semaine : pas deux jours de suite.
            cost += WEIGHT_ADJACENT_DAY * sum(
                1 for other_day, count in subject_days[subject.key].items() if count and abs(other_day - day) == 1
            )
        return cost + noise()

    def record(subject, day, index, size, room_id, barrette=None):
        start, end = layout.span(day, index, size)
        placement = {
            "key": subject.key,
            "subject_name": subject.name,
            "day_of_week": day,
            "start_time": start,
            "end_time": end,
            "room_id": room_id,
        }
        placements.append(placement)
        teacher_use[(subject.teacher_id, day)].append((start, end))
        subject_days[subject.key][day] += 1
        day_indexes[day] |= set(range(index, index + size))
        placed_minutes[subject.key] += layout.duration(day, index, size)
        if barrette is not None:
            barrettes[barrette].append({"subject_id": subject.subject_id, "room_id": room_id})
        return placement

    def place_specialty(subject, size) -> bool:
        best_choice = None
        for day, index in layout.positions(size):
            barrette = ("S", day, index, size)
            states = {occupancy.get((day, index + k)) for k in range(size)}
            if states == {None}:
                is_new = True
            elif states == {barrette}:
                is_new = False
            else:
                continue
            if subject_days[subject.key][day]:
                continue
            if is_new and class_day_full(day, size):
                continue
            start, end = layout.span(day, index, size)
            if not teacher_is_free(subject.teacher_id, day, start, end):
                continue
            if not is_new and any(
                frozenset((other["subject_id"], subject.subject_id)) in conflicting_pairs
                for other in barrettes[barrette]
            ):
                continue
            new_indexes = set(range(index, index + size)) if is_new else set()
            cost = placement_cost(subject, day, index, size, new_indexes)
            if best_choice is None or cost < best_choice[0]:
                best_choice = (cost, day, index, barrette, start, end)
        if best_choice is None:
            return False
        _, day, index, barrette, start, end = best_choice
        taken = {other["room_id"] for other in barrettes[barrette]}
        room_id = next(
            (
                room for room in room_ids
                if room not in taken
                and not any(_overlap(s, e, start, end) for s, e in room_busy.get((room, day), ()))
            ),
            None,
        )
        for k in range(size):
            occupancy[(day, index + k)] = barrette
        record(subject, day, index, size, room_id, barrette)
        return True

    def place_regular(subject, size) -> bool:
        best_choice = None
        for day, index in layout.positions(size):
            if any((day, index + k) in occupancy for k in range(size)):
                continue
            if class_day_full(day, size):
                continue
            start, end = layout.span(day, index, size)
            if not teacher_is_free(subject.teacher_id, day, start, end):
                continue
            cost = placement_cost(subject, day, index, size, set(range(index, index + size)))
            if best_choice is None or cost < best_choice[0]:
                best_choice = (cost, day, index)
        if best_choice is None:
            return False
        _, day, index = best_choice
        for k in range(size):
            occupancy[(day, index + k)] = ("R", subject.key)
        record(subject, day, index, size, None)
        return True

    def place_group(members, size) -> bool:
        """Place une séance commune à toutes les spécialités d'une barrette."""

        best_choice = None
        for day, index in layout.positions(size):
            if any((day, index + k) in occupancy for k in range(size)):
                continue
            if any(subject_days[member.key][day] for member in members):
                continue
            if class_day_full(day, size):
                continue
            start, end = layout.span(day, index, size)
            teachers = [member.teacher_id for member in members]
            if len(set(teachers)) != len(teachers):
                continue
            if not all(teacher_is_free(teacher, day, start, end) for teacher in teachers):
                continue
            cost = placement_cost(members[0], day, index, size, set(range(index, index + size)))
            if best_choice is None or cost < best_choice[0]:
                best_choice = (cost, day, index, start, end)
        if best_choice is None:
            return False
        _, day, index, start, end = best_choice
        barrette = ("S", day, index, size)
        for k in range(size):
            occupancy[(day, index + k)] = barrette
        taken: set = set()
        for member in members:
            room_id = next(
                (
                    room for room in room_ids
                    if room not in taken
                    and not any(_overlap(s, e, start, end) for s, e in room_busy.get((room, day), ()))
                ),
                None,
            )
            taken.add(room_id)
            record(member, day, index, size, room_id, barrette)
        return True

    specialty_sessions = []
    groups = sorted(
        specialty_groups,
        key=lambda group: -sum(teacher_weight[member.teacher_id] for member in group),
    )
    if attempt:
        rng.shuffle(groups)
    broken_barrettes = 0
    for group in groups:
        longest = max(len(session_sizes[member.key]) for member in group)
        for position in range(longest):
            members = [member for member in group if len(session_sizes[member.key]) > position]
            size = max(session_sizes[member.key][position] for member in members)
            if not place_group(members, size):
                # Barrette impossible à caser d'un bloc : chaque spécialité est placée seule.
                specialty_sessions.extend((member, session_sizes[member.key][position]) for member in members)
                broken_barrettes += 1
    specialty_sessions.sort(key=lambda item: (
        -conflict_count[item[0].subject_id], rng.random() if attempt else 0, item[0].name,
    ))
    regular_sessions = [
        (subject, size) for subject in subjects if not subject.is_specialty for size in session_sizes[subject.key]
    ]
    regular_sessions.sort(key=lambda item: (
        -item[1], -teacher_weight[item[0].teacher_id],
        rng.random() if attempt else -item[0].minutes, item[0].name,
    ))

    for subject, size in specialty_sessions:
        place_specialty(subject, size)
    for subject, size in regular_sessions:
        if place_regular(subject, size):
            continue
        # Un bloc impossible à caser est scindé en périodes isolées plutôt que perdu.
        if size > 1 and all(place_regular(subject, 1) for _ in range(size)):
            notes.append(f"{subject.name} : un bloc de {size} périodes a dû être scindé.")

    def diagnose(subject) -> str:
        sizes = session_sizes[subject.key]
        size = min(sizes) if sizes else 1
        found = layout.positions(size)
        counts: Counter = Counter()
        for day, index in found:
            start, end = layout.span(day, index, size)
            if any((day, index + k) in occupancy for k in range(size)):
                counts["classe"] += 1
            elif not teacher_is_free(subject.teacher_id, day, start, end):
                counts["enseignant"] += 1
            elif class_day_full(day, size):
                counts["journee"] += 1
            else:
                counts["autre"] += 1
        if not found:
            return "Aucun créneau compatible n'existe."
        parts = []
        if counts["classe"]:
            parts.append(f"{counts['classe']} déjà pris par d'autres cours de la classe")
        if counts["enseignant"]:
            parts.append(f"{counts['enseignant']} où l'enseignant est occupé ou a atteint son maximum d'heures par jour")
        if counts["journee"]:
            parts.append(f"{counts['journee']} au-delà du maximum d'heures par jour de la classe")
        if counts["autre"]:
            parts.append(f"{counts['autre']} refusés par les règles de répartition")
        return f"Sur {len(found)} créneaux possibles : " + ", ".join(parts) + "."

    unplaced = sum(max(0, subject.minutes - placed_minutes[subject.key]) for subject in subjects)
    reasons = {
        subject.key: diagnose(subject)
        for subject in subjects
        if subject.minutes - placed_minutes[subject.key] > 0
    }
    same_day = sum(
        1 for subject in subjects if not subject.is_specialty
        for count in subject_days[subject.key].values() if count > 1
    )
    gaps = sum(_gaps(indexes) for indexes in day_indexes.values())
    imbalance = sum(len(indexes) ** 2 for indexes in day_indexes.values())
    return PlanResult(
        placements=placements,
        remaining_minutes={
            subject.key: max(0, subject.minutes - placed_minutes[subject.key]) for subject in subjects
        },
        notes=notes,
        score=(unplaced, broken_barrettes, same_day, gaps, imbalance),
        reasons=reasons,
    )
