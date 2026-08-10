-- =========================================================
-- 070 - DONNEES DE TEST POUR LA MIGRATION 007
-- Emploi du temps : profils horaires, volumes, salles,
-- générations, plannings, créneaux et cours spéciaux
-- =========================================================
-- Dépend de :
--   001_db_access.sql
--   002_accounts_and_profiles.sql
--   003_relationships_and_documents.sql
--   004_school_structure.sql
--   005_academic_activity.sql
--   006_report_cards_year_deletion.sql
--   007_timetable.sql
--   020_accounts_and_profiles_test_data.sql
--   030_relationships_and_documents_test_data.sql
--   040_school_structure_test_data.sql
--   050_academic_activity_test_data.sql
--   060_report_cards_year_deletion_test_data.sql
--
-- Objectif de démonstration :
--   - créer un profil horaire "Secondaire" commun au collège et au lycée ;
--   - configurer les horaires et les pauses ;
--   - définir les volumes horaires hebdomadaires ;
--   - créer un emploi du temps publié pour une classe ;
--   - créer un brouillon avec conflit pour tester l'interface admin ;
--   - créer un brouillon issu d'une génération automatique ;
--   - ajouter des cours spéciaux / particuliers visibles dans la même grille.
--
-- Script idempotent : peut être rejoué sans créer de doublons.
-- =========================================================

BEGIN;

-- =========================================================
-- 1. SALLES
-- =========================================================

INSERT INTO rooms (
    name,
    capacity,
    is_active
)
VALUES
    ('Salle A1', 30, true),
    ('Salle A2', 30, true),
    ('Salle B1', 28, true),
    ('Salle Informatique', 24, true),
    ('Laboratoire', 24, true),
    ('Salle Polyvalente', 60, true)
ON CONFLICT DO NOTHING;


-- =========================================================
-- 2. PROFIL HORAIRE SECONDAIRE
-- =========================================================
-- Le profil "Secondaire" regroupe pour la V1 :
--   collège + lycée.
--
-- Les niveaux restent séparés dans class_levels, mais ils partagent
-- la même configuration d'horaires et de pauses.

INSERT INTO schedule_profiles (
    school_year_id,
    name,
    is_active
)
SELECT
    school_year.id,
    'Secondaire',
    true
FROM school_years AS school_year
WHERE school_year.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1
      FROM schedule_profiles AS profile
      WHERE profile.school_year_id = school_year.id
        AND lower(profile.name) = lower('Secondaire')
  );


INSERT INTO schedule_profile_levels (
    schedule_profile_id,
    class_level_id
)
SELECT
    profile.id,
    class_level.id
FROM schedule_profiles AS profile
JOIN school_years AS school_year
    ON school_year.id = profile.school_year_id
JOIN class_levels AS class_level
    ON class_level.code::text IN (
        'SIXIEME',
        'CINQUIEME',
        'QUATRIEME',
        'TROISIEME',
        'SECONDE',
        'PREMIERE',
        'TERMINALE'
    )
WHERE school_year.name = '2026-2027'
  AND lower(profile.name) = lower('Secondaire')
ON CONFLICT (
    schedule_profile_id,
    class_level_id
) DO NOTHING;


-- =========================================================
-- 3. HORAIRES DE JOURNEE
-- =========================================================
-- Lundi à vendredi :
--   08:00 -> 17:00
--   durée indicative d'un cours : 60 minutes

INSERT INTO school_day_schedules (
    schedule_profile_id,
    day_of_week,
    course_start_time,
    course_end_time,
    lesson_duration_minutes
)
SELECT
    profile.id,
    day_data.day_of_week,
    TIME '08:00',
    TIME '17:00',
    60
FROM schedule_profiles AS profile
JOIN school_years AS school_year
    ON school_year.id = profile.school_year_id
CROSS JOIN (
    VALUES
        (1),
        (2),
        (3),
        (4),
        (5)
) AS day_data(day_of_week)
WHERE school_year.name = '2026-2027'
  AND lower(profile.name) = lower('Secondaire')
ON CONFLICT (
    schedule_profile_id,
    day_of_week
) DO NOTHING;


-- =========================================================
-- 4. PAUSES
-- =========================================================

INSERT INTO break_schedules (
    school_day_schedule_id,
    label,
    start_time,
    end_time
)
SELECT
    school_day.id,
    break_data.label,
    break_data.start_time,
    break_data.end_time
FROM school_day_schedules AS school_day
JOIN schedule_profiles AS profile
    ON profile.id = school_day.schedule_profile_id
JOIN school_years AS school_year
    ON school_year.id = profile.school_year_id
CROSS JOIN (
    VALUES
        ('Récréation matin', TIME '10:00', TIME '10:15'),
        ('Pause déjeuner',  TIME '12:00', TIME '13:00'),
        ('Récréation après-midi', TIME '15:00', TIME '15:15')
) AS break_data(label, start_time, end_time)
WHERE school_year.name = '2026-2027'
  AND lower(profile.name) = lower('Secondaire')
  AND NOT EXISTS (
      SELECT 1
      FROM break_schedules AS existing_break
      WHERE existing_break.school_day_schedule_id = school_day.id
        AND existing_break.start_time = break_data.start_time
        AND existing_break.end_time = break_data.end_time
  );


-- =========================================================
-- 5. VOLUMES HORAIRES HEBDOMADAIRES
-- =========================================================
-- Les volumes sont stockés en minutes pour rester simples
-- à manipuler par le futur algorithme.

WITH volume_data (
    level_code,
    subject_name,
    weekly_minutes
) AS (
    VALUES
        ('SIXIEME',   'Mathématiques',       300),
        ('SIXIEME',   'Français',            270),
        ('SIXIEME',   'Anglais',             180),
        ('SIXIEME',   'Histoire-Géographie', 180),
        ('SIXIEME',   'Sciences',            120),
        ('SIXIEME',   'Informatique',         60),

        ('CINQUIEME', 'Mathématiques',       240),
        ('CINQUIEME', 'Français',            240),
        ('CINQUIEME', 'Anglais',             180),
        ('CINQUIEME', 'Histoire-Géographie', 180),
        ('CINQUIEME', 'Sciences',            120),
        ('CINQUIEME', 'Informatique',         60),

        ('QUATRIEME', 'Mathématiques',       240),
        ('QUATRIEME', 'Français',            240),
        ('QUATRIEME', 'Anglais',             180),
        ('QUATRIEME', 'Histoire-Géographie', 180),
        ('QUATRIEME', 'Sciences',            120),
        ('QUATRIEME', 'Informatique',         60),

        ('TROISIEME', 'Mathématiques',       240),
        ('TROISIEME', 'Français',            240),
        ('TROISIEME', 'Anglais',             180),
        ('TROISIEME', 'Histoire-Géographie', 180),
        ('TROISIEME', 'Sciences',            120),
        ('TROISIEME', 'Informatique',         60),

        ('SECONDE',   'Mathématiques',       240),
        ('SECONDE',   'Français',            240),
        ('SECONDE',   'Anglais',             180),
        ('SECONDE',   'Histoire-Géographie', 180),
        ('SECONDE',   'Sciences',            180),
        ('SECONDE',   'Informatique',        120),

        ('PREMIERE',  'Mathématiques',       240),
        ('PREMIERE',  'Français',            240),
        ('PREMIERE',  'Anglais',             180),
        ('PREMIERE',  'Histoire-Géographie', 180),
        ('PREMIERE',  'Sciences',            180),
        ('PREMIERE',  'Informatique',        120),

        ('TERMINALE', 'Mathématiques',       360),
        ('TERMINALE', 'Français',            180),
        ('TERMINALE', 'Anglais',             180),
        ('TERMINALE', 'Histoire-Géographie', 180),
        ('TERMINALE', 'Sciences',            180),
        ('TERMINALE', 'Informatique',        120)
)
INSERT INTO level_subject_requirements (
    school_year_id,
    class_level_id,
    subject_id,
    weekly_minutes
)
SELECT
    school_year.id,
    class_level.id,
    subject.id,
    volume_data.weekly_minutes
FROM volume_data
JOIN class_levels AS class_level
    ON class_level.code::text = volume_data.level_code
JOIN subjects AS subject
    ON subject.name = volume_data.subject_name
CROSS JOIN school_years AS school_year
WHERE school_year.name = '2026-2027'
ON CONFLICT (
    school_year_id,
    class_level_id,
    subject_id
)
DO UPDATE SET
    weekly_minutes = EXCLUDED.weekly_minutes;


-- =========================================================
-- 6. INDISPONIBILITE ENSEIGNANT DE TEST
-- =========================================================
-- Sert à tester l'affichage d'un conflit dans l'interface admin.

INSERT INTO teacher_unavailabilities (
    school_year_id,
    teacher_id,
    day_of_week,
    start_time,
    end_time,
    reason
)
SELECT
    school_year.id,
    teacher.id,
    3,
    TIME '15:00',
    TIME '17:00',
    'Indisponibilité fictive de développement.'
FROM school_years AS school_year
JOIN accounts AS teacher_account
    ON teacher_account.registration_number = 'e000001'
JOIN teachers AS teacher
    ON teacher.account_id = teacher_account.id
WHERE school_year.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1
      FROM teacher_unavailabilities AS unavailable
      WHERE unavailable.school_year_id = school_year.id
        AND unavailable.teacher_id = teacher.id
        AND unavailable.day_of_week = 3
        AND unavailable.start_time = TIME '15:00'
        AND unavailable.end_time = TIME '17:00'
  );


-- =========================================================
-- 7. GENERATION AUTOMATIQUE FICTIVE
-- =========================================================
-- La génération porte sur la période 1.
-- Elle produit plus bas un brouillon pour la Terminale A.

INSERT INTO timetable_generation_runs (
    school_year_id,
    requested_by_account_id,
    status,
    target_start_date,
    target_end_date,
    parameters,
    started_at,
    completed_at
)
SELECT
    school_year.id,
    administrator.id,
    'COMPLETED'::timetable_generation_status_enum,
    DATE '2026-09-01',
    DATE '2026-12-18',
    jsonb_build_object(
        'demo', '070',
        'scope', 'SECONDARY_PERIOD_1',
        'strategy', 'simple_demo_generation'
    ),
    TIMESTAMPTZ '2026-08-20 08:00:00+00',
    TIMESTAMPTZ '2026-08-20 08:01:30+00'
FROM school_years AS school_year
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
WHERE school_year.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1
      FROM timetable_generation_runs AS existing_run
      WHERE existing_run.school_year_id = school_year.id
        AND existing_run.requested_by_account_id = administrator.id
        AND existing_run.target_start_date = DATE '2026-09-01'
        AND existing_run.target_end_date = DATE '2026-12-18'
        AND existing_run.parameters ->> 'demo' = '070'
  );


-- =========================================================
-- 8. EMPLOI DU TEMPS MANUEL PUBLIE - SIXIEME A
-- =========================================================

INSERT INTO timetables (
    class_id,
    version,
    effective_start_date,
    effective_end_date,
    status,
    creation_mode,
    created_by_account_id
)
SELECT
    school_class.id,
    1,
    DATE '2026-09-01',
    DATE '2026-12-18',
    'DRAFT'::timetable_status_enum,
    'MANUAL'::timetable_creation_mode_enum,
    administrator.id
FROM classes AS school_class
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
JOIN class_levels AS class_level
    ON class_level.id = school_class.class_level_id
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
WHERE school_year.name = '2026-2027'
  AND class_level.code::text = 'SIXIEME'
  AND school_class.group_label = 'A'
ON CONFLICT (
    class_id,
    version
) DO NOTHING;


-- Créneaux du planning de 6ème A.
INSERT INTO timetable_slots (
    timetable_id,
    teacher_assignment_id,
    room_id,
    day_of_week,
    start_time,
    end_time
)
SELECT
    timetable.id,
    assignment.id,
    room.id,
    slot_data.day_of_week,
    slot_data.start_time,
    slot_data.end_time
FROM (
    VALUES
        ('SIXIEME', 'Mathématiques',       'Salle A1',           1, TIME '08:00', TIME '09:00'),
        ('SIXIEME', 'Français',            'Salle A1',           1, TIME '09:00', TIME '10:00'),
        ('SIXIEME', 'Anglais',             'Salle A1',           1, TIME '10:15', TIME '11:15'),
        ('SIXIEME', 'Histoire-Géographie', 'Salle A2',           2, TIME '08:00', TIME '09:00'),
        ('SIXIEME', 'Sciences',            'Laboratoire',        2, TIME '09:00', TIME '10:00'),
        ('SIXIEME', 'Informatique',        'Salle Informatique', 3, TIME '08:00', TIME '09:00')
) AS slot_data(
    level_code,
    subject_name,
    room_name,
    day_of_week,
    start_time,
    end_time
)
JOIN school_years AS school_year
    ON school_year.name = '2026-2027'
JOIN class_levels AS class_level
    ON class_level.code::text = slot_data.level_code
JOIN classes AS school_class
    ON school_class.school_year_id = school_year.id
   AND school_class.class_level_id = class_level.id
   AND school_class.group_label = 'A'
JOIN timetables AS timetable
    ON timetable.class_id = school_class.id
   AND timetable.version = 1
   AND timetable.status = 'DRAFT'
JOIN class_subjects AS class_subject
    ON class_subject.class_id = school_class.id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
   AND subject.name = slot_data.subject_name
JOIN teacher_assignments AS assignment
    ON assignment.class_subject_id = class_subject.id
   AND assignment.end_date IS NULL
LEFT JOIN rooms AS room
    ON room.name = slot_data.room_name
WHERE NOT EXISTS (
    SELECT 1
    FROM timetable_slots AS existing_slot
    WHERE existing_slot.timetable_id = timetable.id
      AND existing_slot.teacher_assignment_id = assignment.id
      AND existing_slot.day_of_week = slot_data.day_of_week
      AND existing_slot.start_time = slot_data.start_time
      AND existing_slot.end_time = slot_data.end_time
);


-- Publication du planning de 6ème A.
UPDATE timetables AS timetable
SET
    status = 'PUBLISHED'::timetable_status_enum,
    published_by_account_id = administrator.id,
    published_at = TIMESTAMPTZ '2026-08-21 10:00:00+00'
FROM classes AS school_class
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
JOIN class_levels AS class_level
    ON class_level.id = school_class.class_level_id
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
WHERE timetable.class_id = school_class.id
  AND school_year.name = '2026-2027'
  AND class_level.code::text = 'SIXIEME'
  AND school_class.group_label = 'A'
  AND timetable.version = 1
  AND timetable.status = 'DRAFT';


-- =========================================================
-- 9. BROUILLON MANUEL AVEC CONFLIT - CINQUIEME A
-- =========================================================
-- Objectif :
-- tester l'interface "conflits à résoudre".
--
-- Deux cours sont placés lundi 08:00-09:00 pour la même classe.
-- La base accepte ce conflit dans le DRAFT.
-- La publication devra le refuser.

INSERT INTO timetables (
    class_id,
    version,
    effective_start_date,
    effective_end_date,
    status,
    creation_mode,
    created_by_account_id
)
SELECT
    school_class.id,
    1,
    DATE '2026-09-01',
    DATE '2026-12-18',
    'DRAFT'::timetable_status_enum,
    'MANUAL'::timetable_creation_mode_enum,
    administrator.id
FROM classes AS school_class
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
JOIN class_levels AS class_level
    ON class_level.id = school_class.class_level_id
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
WHERE school_year.name = '2026-2027'
  AND class_level.code::text = 'CINQUIEME'
  AND school_class.group_label = 'A'
ON CONFLICT (
    class_id,
    version
) DO NOTHING;


INSERT INTO timetable_slots (
    timetable_id,
    teacher_assignment_id,
    room_id,
    day_of_week,
    start_time,
    end_time
)
SELECT
    timetable.id,
    assignment.id,
    room.id,
    slot_data.day_of_week,
    slot_data.start_time,
    slot_data.end_time
FROM (
    VALUES
        ('CINQUIEME', 'Mathématiques', 'Salle A2', 1, TIME '08:00', TIME '09:00'),
        ('CINQUIEME', 'Français',      'Salle A2', 1, TIME '08:00', TIME '09:00')
) AS slot_data(
    level_code,
    subject_name,
    room_name,
    day_of_week,
    start_time,
    end_time
)
JOIN school_years AS school_year
    ON school_year.name = '2026-2027'
JOIN class_levels AS class_level
    ON class_level.code::text = slot_data.level_code
JOIN classes AS school_class
    ON school_class.school_year_id = school_year.id
   AND school_class.class_level_id = class_level.id
   AND school_class.group_label = 'A'
JOIN timetables AS timetable
    ON timetable.class_id = school_class.id
   AND timetable.version = 1
   AND timetable.status = 'DRAFT'
JOIN class_subjects AS class_subject
    ON class_subject.class_id = school_class.id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
   AND subject.name = slot_data.subject_name
JOIN teacher_assignments AS assignment
    ON assignment.class_subject_id = class_subject.id
   AND assignment.end_date IS NULL
LEFT JOIN rooms AS room
    ON room.name = slot_data.room_name
WHERE NOT EXISTS (
    SELECT 1
    FROM timetable_slots AS existing_slot
    WHERE existing_slot.timetable_id = timetable.id
      AND existing_slot.teacher_assignment_id = assignment.id
      AND existing_slot.day_of_week = slot_data.day_of_week
      AND existing_slot.start_time = slot_data.start_time
      AND existing_slot.end_time = slot_data.end_time
);


-- =========================================================
-- 10. BROUILLON ISSU D'UNE GENERATION AUTOMATIQUE - TERMINALE A
-- =========================================================

INSERT INTO timetables (
    class_id,
    version,
    effective_start_date,
    effective_end_date,
    status,
    creation_mode,
    created_by_account_id,
    generation_run_id
)
SELECT
    school_class.id,
    1,
    run.target_start_date,
    run.target_end_date,
    'DRAFT'::timetable_status_enum,
    'AUTOMATIC'::timetable_creation_mode_enum,
    administrator.id,
    run.id
FROM classes AS school_class
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
JOIN class_levels AS class_level
    ON class_level.id = school_class.class_level_id
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
JOIN timetable_generation_runs AS run
    ON run.school_year_id = school_year.id
   AND run.parameters ->> 'demo' = '070'
WHERE school_year.name = '2026-2027'
  AND class_level.code::text = 'TERMINALE'
  AND school_class.group_label = 'A'
ON CONFLICT (
    class_id,
    version
) DO NOTHING;


INSERT INTO timetable_slots (
    timetable_id,
    teacher_assignment_id,
    room_id,
    day_of_week,
    start_time,
    end_time
)
SELECT
    timetable.id,
    assignment.id,
    room.id,
    slot_data.day_of_week,
    slot_data.start_time,
    slot_data.end_time
FROM (
    VALUES
        ('TERMINALE', 'Mathématiques', 'Salle B1',           1, TIME '08:00', TIME '09:00'),
        ('TERMINALE', 'Anglais',       'Salle B1',           1, TIME '09:00', TIME '10:00'),
        ('TERMINALE', 'Sciences',      'Laboratoire',        2, TIME '10:15', TIME '11:15'),
        ('TERMINALE', 'Informatique',  'Salle Informatique', 3, TIME '14:00', TIME '15:00')
) AS slot_data(
    level_code,
    subject_name,
    room_name,
    day_of_week,
    start_time,
    end_time
)
JOIN school_years AS school_year
    ON school_year.name = '2026-2027'
JOIN class_levels AS class_level
    ON class_level.code::text = slot_data.level_code
JOIN classes AS school_class
    ON school_class.school_year_id = school_year.id
   AND school_class.class_level_id = class_level.id
   AND school_class.group_label = 'A'
JOIN timetables AS timetable
    ON timetable.class_id = school_class.id
   AND timetable.version = 1
   AND timetable.status = 'DRAFT'
JOIN class_subjects AS class_subject
    ON class_subject.class_id = school_class.id
JOIN subjects AS subject
    ON subject.id = class_subject.subject_id
   AND subject.name = slot_data.subject_name
JOIN teacher_assignments AS assignment
    ON assignment.class_subject_id = class_subject.id
   AND assignment.end_date IS NULL
LEFT JOIN rooms AS room
    ON room.name = slot_data.room_name
WHERE NOT EXISTS (
    SELECT 1
    FROM timetable_slots AS existing_slot
    WHERE existing_slot.timetable_id = timetable.id
      AND existing_slot.teacher_assignment_id = assignment.id
      AND existing_slot.day_of_week = slot_data.day_of_week
      AND existing_slot.start_time = slot_data.start_time
      AND existing_slot.end_time = slot_data.end_time
);


-- =========================================================
-- 11. COURS PARTICULIER PUBLIE - ELEVE u000001
-- =========================================================
-- Ce cours est sans conflit et doit apparaître dans
-- v_student_timetable_entries avec entry_type = SPECIAL.

INSERT INTO special_courses (
    student_enrollment_id,
    subject_id,
    teacher_id,
    room_id,
    title,
    day_of_week,
    start_time,
    end_time,
    valid_from,
    valid_until,
    note,
    created_by_account_id
)
SELECT
    enrollment.id,
    subject.id,
    teacher.id,
    room.id,
    'Soutien en mathématiques',
    3,
    TIME '13:00',
    TIME '14:00',
    DATE '2026-09-15',
    DATE '2026-12-15',
    'Cours particulier fictif publié et affiché dans le même planning que les cours ordinaires.',
    administrator.id
FROM student_enrollments AS enrollment
JOIN students AS student
    ON student.id = enrollment.student_id
JOIN accounts AS student_account
    ON student_account.id = student.account_id
JOIN subjects AS subject
    ON subject.name = 'Mathématiques'
JOIN accounts AS teacher_account
    ON teacher_account.registration_number = 'e000001'
JOIN teachers AS teacher
    ON teacher.account_id = teacher_account.id
LEFT JOIN rooms AS room
    ON room.name = 'Salle A2'
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
WHERE student_account.registration_number = 'u000001'
  AND NOT EXISTS (
      SELECT 1
      FROM special_courses AS existing_course
      WHERE existing_course.student_enrollment_id = enrollment.id
        AND existing_course.title = 'Soutien en mathématiques'
        AND existing_course.day_of_week = 3
        AND existing_course.start_time = TIME '13:00'
        AND existing_course.end_time = TIME '14:00'
  );


UPDATE special_courses AS special_course
SET
    status = 'PUBLISHED'::special_course_status_enum,
    published_by_account_id = administrator.id,
    published_at = TIMESTAMPTZ '2026-09-10 09:00:00+00'
FROM student_enrollments AS enrollment
JOIN students AS student
    ON student.id = enrollment.student_id
JOIN accounts AS student_account
    ON student_account.id = student.account_id
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
WHERE special_course.student_enrollment_id = enrollment.id
  AND student_account.registration_number = 'u000001'
  AND special_course.title = 'Soutien en mathématiques'
  AND special_course.start_time = TIME '13:00'
  AND special_course.status = 'DRAFT';


-- =========================================================
-- 12. COURS PARTICULIER DRAFT AVEC CONFLIT
-- =========================================================
-- Ce cours est volontairement placé sur une indisponibilité
-- de l'enseignant e000001 (mercredi 15h-17h).
--
-- Il reste DRAFT : la base l'accepte, FastAPI doit le signaler
-- dans la liste des conflits et sa publication doit échouer.

INSERT INTO special_courses (
    student_enrollment_id,
    subject_id,
    teacher_id,
    room_id,
    title,
    day_of_week,
    start_time,
    end_time,
    valid_from,
    valid_until,
    note,
    created_by_account_id
)
SELECT
    enrollment.id,
    subject.id,
    teacher.id,
    room.id,
    'Soutien mathématiques - conflit test',
    3,
    TIME '15:00',
    TIME '16:00',
    DATE '2026-09-15',
    DATE '2026-12-15',
    'Brouillon volontairement en conflit avec une indisponibilité enseignant.',
    administrator.id
FROM student_enrollments AS enrollment
JOIN students AS student
    ON student.id = enrollment.student_id
JOIN accounts AS student_account
    ON student_account.id = student.account_id
JOIN subjects AS subject
    ON subject.name = 'Mathématiques'
JOIN accounts AS teacher_account
    ON teacher_account.registration_number = 'e000001'
JOIN teachers AS teacher
    ON teacher.account_id = teacher_account.id
LEFT JOIN rooms AS room
    ON room.name = 'Salle A2'
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
WHERE student_account.registration_number = 'u000001'
  AND NOT EXISTS (
      SELECT 1
      FROM special_courses AS existing_course
      WHERE existing_course.student_enrollment_id = enrollment.id
        AND existing_course.title = 'Soutien mathématiques - conflit test'
  );


-- =========================================================
-- 13. COURS SPECIAL DE CLASSE PUBLIE
-- =========================================================
-- Exemple : séance d'orientation ponctuelle pour toute la Terminale A.

INSERT INTO special_courses (
    class_id,
    subject_id,
    teacher_id,
    room_id,
    title,
    day_of_week,
    start_time,
    end_time,
    valid_from,
    valid_until,
    note,
    created_by_account_id
)
SELECT
    school_class.id,
    NULL,
    NULL,
    room.id,
    'Séance orientation',
    5,
    TIME '14:00',
    TIME '15:00',
    DATE '2026-10-02',
    DATE '2026-10-02',
    'Cours spécial ponctuel pour toute la classe.',
    administrator.id
FROM classes AS school_class
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
JOIN class_levels AS class_level
    ON class_level.id = school_class.class_level_id
LEFT JOIN rooms AS room
    ON room.name = 'Salle Polyvalente'
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
WHERE school_year.name = '2026-2027'
  AND class_level.code::text = 'TERMINALE'
  AND school_class.group_label = 'A'
  AND NOT EXISTS (
      SELECT 1
      FROM special_courses AS existing_course
      WHERE existing_course.class_id = school_class.id
        AND existing_course.title = 'Séance orientation'
        AND existing_course.valid_from = DATE '2026-10-02'
  );


UPDATE special_courses AS special_course
SET
    status = 'PUBLISHED'::special_course_status_enum,
    published_by_account_id = administrator.id,
    published_at = TIMESTAMPTZ '2026-09-20 09:00:00+00'
FROM classes AS school_class
JOIN school_years AS school_year
    ON school_year.id = school_class.school_year_id
JOIN class_levels AS class_level
    ON class_level.id = school_class.class_level_id
JOIN accounts AS administrator
    ON administrator.registration_number = 'a000001'
WHERE special_course.class_id = school_class.id
  AND school_year.name = '2026-2027'
  AND class_level.code::text = 'TERMINALE'
  AND school_class.group_label = 'A'
  AND special_course.title = 'Séance orientation'
  AND special_course.status = 'DRAFT';


COMMIT;
