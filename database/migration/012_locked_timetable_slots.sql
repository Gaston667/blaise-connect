-- Migration additive : créneaux verrouillés.
--
-- is_locked = true : créneau placé à la main par l'administrateur. Une
-- régénération automatique le conserve et planifie le reste autour de lui.
BEGIN;

ALTER TABLE timetable_slots
    ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

ALTER TABLE timetable_date_slots
    ADD COLUMN is_locked boolean NOT NULL DEFAULT false;

GRANT INSERT (is_locked), UPDATE (is_locked) ON timetable_slots TO blaise_app;
GRANT INSERT (is_locked), UPDATE (is_locked) ON timetable_date_slots TO blaise_app;

COMMIT;
