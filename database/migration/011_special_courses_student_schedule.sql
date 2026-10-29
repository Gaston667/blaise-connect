-- Migration corrective : un cours particulier individuel n'entre en conflit qu'avec
-- les cours que l'élève suit réellement (tronc commun de la classe et spécialités
-- qu'il a choisies). Auparavant, il était refusé dès qu'un cours de la classe avait
-- lieu au même moment, y compris une spécialité suivie par d'autres élèves seulement.
-- Aucun schéma ni donnée n'est modifié : seules deux fonctions de contrôle changent.
BEGIN;

CREATE OR REPLACE FUNCTION check_special_course_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_class_id uuid;
    target_school_year_id uuid;
    target_level_id uuid;
BEGIN
    IF NEW.status <> 'PUBLISHED'
       OR OLD.status = 'PUBLISHED'
    THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtext('blaiseconnect:timetable-publication')
    );

    IF NEW.class_id IS NOT NULL THEN
        SELECT school_class.id,
               school_class.school_year_id,
               school_class.class_level_id
          INTO target_class_id,
               target_school_year_id,
               target_level_id
          FROM classes AS school_class
         WHERE school_class.id = NEW.class_id;
    ELSE
        SELECT school_class.id,
               school_class.school_year_id,
               school_class.class_level_id
          INTO target_class_id,
               target_school_year_id,
               target_level_id
          FROM student_enrollments AS enrollment
          JOIN classes AS school_class
            ON school_class.id = enrollment.class_id
         WHERE enrollment.id = NEW.student_enrollment_id;
    END IF;

    IF target_class_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La cible du cours spécial est introuvable.';
    END IF;

    -- Le jour récurrent doit réellement exister dans la période choisie.
    IF NOT EXISTS (
        SELECT 1
          FROM generate_series(
                   NEW.valid_from::timestamp,
                   NEW.valid_until::timestamp,
                   interval '1 day'
               ) AS occurrence(day_value)
         WHERE extract(isodow FROM occurrence.day_value)::smallint =
               NEW.day_of_week
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La période choisie ne contient aucune occurrence du jour sélectionné.';
    END IF;

    -- Horaires + pauses.
    IF NOT EXISTS (
        SELECT 1
          FROM schedule_profile_levels AS profile_level
          JOIN schedule_profiles AS profile
            ON profile.id = profile_level.schedule_profile_id
          JOIN school_day_schedules AS schedule
            ON schedule.schedule_profile_id = profile.id
         WHERE profile.school_year_id = target_school_year_id
           AND profile.is_active = true
           AND profile_level.class_level_id = target_level_id
           AND schedule.day_of_week = NEW.day_of_week
           AND NEW.start_time >= schedule.course_start_time
           AND NEW.end_time <= schedule.course_end_time
           AND NOT EXISTS (
               SELECT 1
                 FROM break_schedules AS break
                WHERE break.school_day_schedule_id = schedule.id
                  AND break.start_time < NEW.end_time
                  AND break.end_time > NEW.start_time
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : le cours spécial ne respecte pas les horaires ou les pauses.';
    END IF;

    -- Indisponibilité de l'enseignant.
    IF NEW.teacher_id IS NOT NULL
       AND EXISTS (
           SELECT 1
             FROM teacher_unavailabilities AS unavailable
            WHERE unavailable.school_year_id = target_school_year_id
              AND unavailable.teacher_id = NEW.teacher_id
              AND unavailable.day_of_week = NEW.day_of_week
              AND unavailable.start_time < NEW.end_time
              AND unavailable.end_time > NEW.start_time
       )
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : l''enseignant est indisponible.';
    END IF;

    -- Conflit avec un emploi du temps régulier publié.
    IF EXISTS (
        SELECT 1
          FROM timetables AS timetable
          JOIN classes AS school_class
            ON school_class.id = timetable.class_id
          JOIN timetable_slots AS slot
            ON slot.timetable_id = timetable.id
          JOIN teacher_assignments AS assignment
            ON assignment.id = slot.teacher_assignment_id
         WHERE timetable.status = 'PUBLISHED'
           AND school_class.school_year_id = target_school_year_id
           AND daterange(
                   timetable.effective_start_date,
                   timetable.effective_end_date,
                   '[]'
               )
               && daterange(
                   NEW.valid_from,
                   NEW.valid_until,
                   '[]'
               )
           AND slot.day_of_week = NEW.day_of_week
           AND slot.start_time < NEW.end_time
           AND slot.end_time > NEW.start_time
           AND (
               (
                   timetable.class_id = target_class_id
                   AND (
                       NEW.class_id IS NOT NULL
                       OR NOT EXISTS (
                           SELECT 1
                             FROM class_subjects AS slot_class_subject
                             JOIN subjects AS slot_subject
                               ON slot_subject.id = slot_class_subject.subject_id
                            WHERE slot_class_subject.id = assignment.class_subject_id
                              AND slot_subject.is_specialty
                              AND NOT EXISTS (
                                  SELECT 1
                                    FROM student_specialties AS choice
                                   WHERE choice.student_enrollment_id = NEW.student_enrollment_id
                                     AND choice.subject_id = slot_subject.id
                              )
                       )
                   )
               )
               OR (
                   NEW.teacher_id IS NOT NULL
                   AND assignment.teacher_id = NEW.teacher_id
               )
               OR (
                   NEW.room_id IS NOT NULL
                   AND slot.room_id = NEW.room_id
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : conflit avec un emploi du temps publié.';
    END IF;

    -- Conflit avec un autre cours spécial publié.
    IF EXISTS (
        SELECT 1
          FROM special_courses AS other_course
          LEFT JOIN student_enrollments AS other_enrollment
            ON other_enrollment.id = other_course.student_enrollment_id
         WHERE other_course.id <> NEW.id
           AND other_course.status = 'PUBLISHED'
           AND other_course.day_of_week = NEW.day_of_week
           AND other_course.start_time < NEW.end_time
           AND other_course.end_time > NEW.start_time
           AND daterange(
                   other_course.valid_from,
                   other_course.valid_until,
                   '[]'
               )
               && daterange(
                   NEW.valid_from,
                   NEW.valid_until,
                   '[]'
               )
           AND (
               (
                   NEW.teacher_id IS NOT NULL
                   AND other_course.teacher_id = NEW.teacher_id
               )
               OR (
                   NEW.room_id IS NOT NULL
                   AND other_course.room_id = NEW.room_id
               )
               OR (
                   NEW.student_enrollment_id IS NOT NULL
                   AND other_course.student_enrollment_id =
                       NEW.student_enrollment_id
               )
               OR (
                   NEW.class_id IS NOT NULL
                   AND (
                       other_course.class_id = NEW.class_id
                       OR other_enrollment.class_id = NEW.class_id
                   )
               )
               OR (
                   NEW.student_enrollment_id IS NOT NULL
                   AND other_course.class_id = target_class_id
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : conflit avec un autre cours spécial ou particulier.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_timetable_publish()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    current_school_year_id uuid;
    current_level_id uuid;
    conflicting_special_course_title varchar(150);
    conflicting_special_course_day smallint;
    conflicting_special_course_start time;
    conflicting_special_course_end time;
    conflicting_special_course_teacher_first_name text;
    conflicting_special_course_teacher_last_name text;
    conflicting_special_course_room_name varchar(100);
    conflicting_special_course_reason text;
    conflicting_timetable_subject varchar(100);
    conflicting_timetable_day smallint;
    conflicting_timetable_start time;
    conflicting_timetable_end time;
    conflicting_timetable_teacher_first_name text;
    conflicting_timetable_teacher_last_name text;
    conflicting_timetable_class_name text;
    conflicting_timetable_class_subject varchar(100);
    conflicting_timetable_reason text;
BEGIN
    IF NEW.status <> 'PUBLISHED'
       OR OLD.status = 'PUBLISHED'
    THEN
        RETURN NEW;
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtext('blaiseconnect:timetable-publication')
    );

    SELECT school_class.school_year_id,
           school_class.class_level_id
      INTO current_school_year_id,
           current_level_id
      FROM classes AS school_class
     WHERE school_class.id = NEW.class_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23503',
            MESSAGE = 'La classe de l''emploi du temps est introuvable.';
    END IF;

    IF NEW.creation_mode = 'AUTOMATIC'
       AND NOT EXISTS (
           SELECT 1
             FROM timetable_generation_runs AS run
            WHERE run.id = NEW.generation_run_id
              AND run.status = 'COMPLETED'
       )
    THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'La génération automatique doit être terminée avant publication.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM timetable_slots AS slot
         WHERE slot.timetable_id = NEW.id
    ) AND NOT EXISTS (
        SELECT 1
          FROM timetable_date_slots AS date_slot
         WHERE date_slot.timetable_id = NEW.id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Un emploi du temps vide ne peut pas être publié.';
    END IF;

    -- Deux créneaux de la classe qui se chevauchent sont interdits, sauf si
    -- les deux sont des spécialités (bloc commun, groupes en parallèle dans
    -- des salles différentes).
    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS slot_a
          JOIN teacher_assignments AS assignment_a ON assignment_a.id = slot_a.teacher_assignment_id
          JOIN class_subjects AS class_subject_a ON class_subject_a.id = assignment_a.class_subject_id
          JOIN subjects AS subject_a ON subject_a.id = class_subject_a.subject_id
          JOIN timetable_slots AS slot_b
            ON slot_b.timetable_id = slot_a.timetable_id
           AND slot_b.id <> slot_a.id
           AND slot_b.day_of_week = slot_a.day_of_week
           AND slot_b.start_time < slot_a.end_time
           AND slot_b.end_time > slot_a.start_time
          JOIN teacher_assignments AS assignment_b ON assignment_b.id = slot_b.teacher_assignment_id
          JOIN class_subjects AS class_subject_b ON class_subject_b.id = assignment_b.class_subject_id
          JOIN subjects AS subject_b ON subject_b.id = class_subject_b.subject_id
         WHERE slot_a.timetable_id = NEW.id
           AND NOT (subject_a.is_specialty AND subject_b.is_specialty)
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : deux cours de la classe se chevauchent.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS candidate
         WHERE candidate.timetable_id = NEW.id
           AND NOT EXISTS (
               SELECT 1
                 FROM schedule_profile_levels AS profile_level
                 JOIN schedule_profiles AS profile
                   ON profile.id = profile_level.schedule_profile_id
                 JOIN school_day_schedules AS schedule
                   ON schedule.schedule_profile_id = profile.id
                WHERE profile.school_year_id = current_school_year_id
                  AND profile.is_active = true
                  AND profile_level.class_level_id = current_level_id
                  AND schedule.day_of_week = candidate.day_of_week
                  AND candidate.start_time >= schedule.course_start_time
                  AND candidate.end_time <= schedule.course_end_time
                  AND NOT EXISTS (
                      SELECT 1
                        FROM break_schedules AS break
                       WHERE break.school_day_schedule_id = schedule.id
                         AND break.start_time < candidate.end_time
                         AND break.end_time > candidate.start_time
                  )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : un créneau ne respecte pas les horaires ou les pauses.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS candidate
          JOIN teacher_assignments AS assignment
            ON assignment.id = candidate.teacher_assignment_id
          JOIN teacher_unavailabilities AS unavailable
            ON unavailable.school_year_id = current_school_year_id
           AND unavailable.teacher_id = assignment.teacher_id
           AND unavailable.day_of_week = candidate.day_of_week
           AND unavailable.start_time < candidate.end_time
           AND unavailable.end_time > candidate.start_time
         WHERE candidate.timetable_id = NEW.id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : un enseignant est indisponible sur un créneau.';
    END IF;

    IF EXISTS (
        SELECT 1
          FROM timetable_slots AS slot_a
          JOIN teacher_assignments AS assignment_a
            ON assignment_a.id = slot_a.teacher_assignment_id
          JOIN timetable_slots AS slot_b
            ON slot_b.timetable_id = slot_a.timetable_id
           AND slot_b.id <> slot_a.id
           AND slot_b.day_of_week = slot_a.day_of_week
           AND slot_b.start_time < slot_a.end_time
           AND slot_b.end_time > slot_a.start_time
          JOIN teacher_assignments AS assignment_b
            ON assignment_b.id = slot_b.teacher_assignment_id
         WHERE slot_a.timetable_id = NEW.id
           AND (
               assignment_a.teacher_id = assignment_b.teacher_id
               OR (
                   slot_a.room_id IS NOT NULL
                   AND slot_a.room_id = slot_b.room_id
               )
           )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Publication impossible : conflit interne d''enseignant ou de salle.';
    END IF;

    SELECT
        candidate_subject.name, candidate.day_of_week, candidate.start_time, candidate.end_time,
        candidate_teacher.first_name, candidate_teacher.last_name,
        published_class_level.name || ' ' || published_class.group_label,
        published_subject.name,
        CASE
            WHEN candidate_assignment.teacher_id = published_assignment.teacher_id
                THEN 'enseignant déjà pris'
            ELSE 'salle déjà occupée'
        END
      INTO
        conflicting_timetable_subject, conflicting_timetable_day,
        conflicting_timetable_start, conflicting_timetable_end,
        conflicting_timetable_teacher_first_name, conflicting_timetable_teacher_last_name,
        conflicting_timetable_class_name, conflicting_timetable_class_subject,
        conflicting_timetable_reason
      FROM timetable_slots AS candidate
      JOIN teacher_assignments AS candidate_assignment
        ON candidate_assignment.id = candidate.teacher_assignment_id
      JOIN class_subjects AS candidate_class_subject
        ON candidate_class_subject.id = candidate_assignment.class_subject_id
      JOIN subjects AS candidate_subject ON candidate_subject.id = candidate_class_subject.subject_id
      JOIN teachers AS candidate_teacher ON candidate_teacher.id = candidate_assignment.teacher_id
      JOIN timetable_slots AS published
        ON published.day_of_week = candidate.day_of_week
       AND published.start_time < candidate.end_time
       AND published.end_time > candidate.start_time
      JOIN timetables AS published_timetable
        ON published_timetable.id = published.timetable_id
      JOIN classes AS published_class
        ON published_class.id = published_timetable.class_id
      JOIN class_levels AS published_class_level
        ON published_class_level.id = published_class.class_level_id
      JOIN teacher_assignments AS published_assignment
        ON published_assignment.id = published.teacher_assignment_id
      JOIN class_subjects AS published_class_subject
        ON published_class_subject.id = published_assignment.class_subject_id
      JOIN subjects AS published_subject ON published_subject.id = published_class_subject.subject_id
     WHERE candidate.timetable_id = NEW.id
       AND published_timetable.status = 'PUBLISHED'
       AND published_timetable.class_id <> NEW.class_id
       AND published_class.school_year_id = current_school_year_id
       AND daterange(
               published_timetable.effective_start_date,
               published_timetable.effective_end_date,
               '[]'
           )
           && daterange(
               NEW.effective_start_date,
               NEW.effective_end_date,
               '[]'
           )
       AND (
           candidate_assignment.teacher_id =
               published_assignment.teacher_id
           OR (
               candidate.room_id IS NOT NULL
               AND candidate.room_id = published.room_id
           )
       )
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = format(
                'Publication impossible : %s %s est déjà en cours avec %s (%s) le %s de %s à %s (%s).',
                conflicting_timetable_teacher_first_name,
                conflicting_timetable_teacher_last_name,
                conflicting_timetable_class_name,
                conflicting_timetable_class_subject,
                CASE conflicting_timetable_day
                    WHEN 1 THEN 'lundi' WHEN 2 THEN 'mardi' WHEN 3 THEN 'mercredi'
                    WHEN 4 THEN 'jeudi' WHEN 5 THEN 'vendredi' WHEN 6 THEN 'samedi'
                    ELSE 'dimanche'
                END,
                to_char(conflicting_timetable_start, 'HH24:MI'),
                to_char(conflicting_timetable_end, 'HH24:MI'),
                conflicting_timetable_reason
            );
    END IF;

    SELECT
        special_course.title,
        special_course.day_of_week,
        special_course.start_time,
        special_course.end_time,
        conflict_teacher.first_name,
        conflict_teacher.last_name,
        conflict_room.name,
        CASE
            WHEN special_course.teacher_id = candidate_assignment.teacher_id
                THEN 'enseignant déjà pris'
            WHEN candidate.room_id IS NOT NULL
                 AND special_course.room_id = candidate.room_id
                THEN 'salle déjà occupée'
            ELSE 'chevauchement de créneau'
        END
      INTO
        conflicting_special_course_title,
        conflicting_special_course_day,
        conflicting_special_course_start,
        conflicting_special_course_end,
        conflicting_special_course_teacher_first_name,
        conflicting_special_course_teacher_last_name,
        conflicting_special_course_room_name,
        conflicting_special_course_reason
      FROM timetable_slots AS candidate
      JOIN teacher_assignments AS candidate_assignment
        ON candidate_assignment.id = candidate.teacher_assignment_id
      JOIN special_courses AS special_course
        ON special_course.day_of_week = candidate.day_of_week
       AND special_course.start_time < candidate.end_time
       AND special_course.end_time > candidate.start_time
      LEFT JOIN teachers AS conflict_teacher
        ON conflict_teacher.id = special_course.teacher_id
      LEFT JOIN rooms AS conflict_room
        ON conflict_room.id = special_course.room_id
      LEFT JOIN student_enrollments AS enrollment
        ON enrollment.id = special_course.student_enrollment_id
      LEFT JOIN classes AS special_class
        ON special_class.id = special_course.class_id
      LEFT JOIN classes AS enrollment_class
        ON enrollment_class.id = enrollment.class_id
     WHERE candidate.timetable_id = NEW.id
       AND special_course.status = 'PUBLISHED'
       AND COALESCE(
               special_class.school_year_id,
               enrollment_class.school_year_id
           ) = current_school_year_id
       AND daterange(
               special_course.valid_from,
               special_course.valid_until,
               '[]'
           )
           && daterange(
               NEW.effective_start_date,
               NEW.effective_end_date,
               '[]'
           )
       AND (
           special_course.class_id = NEW.class_id
           OR (
               enrollment.class_id = NEW.class_id
               AND NOT EXISTS (
                   SELECT 1
                     FROM class_subjects AS slot_class_subject
                     JOIN subjects AS slot_subject
                       ON slot_subject.id = slot_class_subject.subject_id
                    WHERE slot_class_subject.id = candidate_assignment.class_subject_id
                      AND slot_subject.is_specialty
                      AND NOT EXISTS (
                          SELECT 1
                            FROM student_specialties AS choice
                           WHERE choice.student_enrollment_id = enrollment.id
                             AND choice.subject_id = slot_subject.id
                      )
               )
           )
           OR special_course.teacher_id = candidate_assignment.teacher_id
           OR (
               candidate.room_id IS NOT NULL
               AND special_course.room_id = candidate.room_id
           )
       )
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = format(
                'Publication impossible : le cours particulier « %s » (%s, %s) avec %s %s%s est en conflit (%s).',
                conflicting_special_course_title,
                CASE conflicting_special_course_day
                    WHEN 1 THEN 'lundi' WHEN 2 THEN 'mardi' WHEN 3 THEN 'mercredi'
                    WHEN 4 THEN 'jeudi' WHEN 5 THEN 'vendredi' WHEN 6 THEN 'samedi'
                    ELSE 'dimanche'
                END,
                to_char(conflicting_special_course_start, 'HH24:MI') || '-' ||
                    to_char(conflicting_special_course_end, 'HH24:MI'),
                COALESCE(conflicting_special_course_teacher_first_name, ''),
                COALESCE(conflicting_special_course_teacher_last_name, ''),
                CASE WHEN conflicting_special_course_room_name IS NOT NULL
                     THEN ' en ' || conflicting_special_course_room_name ELSE '' END,
                conflicting_special_course_reason
            );
    END IF;

    RETURN NEW;
END;
$$;

COMMIT;
