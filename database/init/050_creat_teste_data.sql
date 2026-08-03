-- =========================================================
-- 050 - JEU DE DONNEES DE TEST (FUSION 007 + 008 + 009)
-- =========================================================
-- Mot de passe commun des comptes : test@1234
-- Script idempotent: peut etre rejoue sans doublons.

BEGIN;

-- 1. Comptes: 3 admins, 7 enseignants, 10 eleves, 10 responsables.
INSERT INTO accounts (
    registration_number,
    password_hash,
    role,
    is_active,
    failed_login_attempts,
    locked_until,
    last_login_at,
    archived_at,
    created_at,
    updated_at
)
SELECT
    account_prefix || lpad(account_number::text, 6, '0'),
    '$argon2id$v=19$m=65536,t=3,p=4$fdzl7sb+dyZM9pHYxntmkw$52e5qk6b3tG8l+6BGx7tG997wmj9NNhOnr2MDm+M7bg',
    account_role,
    true,
    0,
    NULL,
    TIMESTAMPTZ '2026-07-28 08:00:00+00' + account_number * INTERVAL '5 minutes',
    NULL,
    TIMESTAMPTZ '2026-07-01 08:00:00+00',
    TIMESTAMPTZ '2026-07-28 08:00:00+00'
FROM (
    SELECT 'a', account_number, 'ADMIN' FROM generate_series(1, 3) AS account_number
    UNION ALL
    SELECT 'e', account_number, 'TEACHER' FROM generate_series(1, 7) AS account_number
    UNION ALL
    SELECT 'u', account_number, 'STUDENT' FROM generate_series(1, 10) AS account_number
    UNION ALL
    SELECT 'p', account_number, 'GUARDIAN' FROM generate_series(1, 10) AS account_number
) AS generated_accounts(account_prefix, account_number, account_role)
ON CONFLICT (registration_number) DO NOTHING;

-- 2. Profils administrateurs.
INSERT INTO administrators (
    account_id,
    first_name,
    last_name,
    gender,
    email,
    phone,
    address,
    hire_date,
    job_title,
    photo_path,
    archived_at,
    created_at,
    updated_at
)
SELECT
    accounts.id,
    (ARRAY['Aminata', 'Mamadou', 'Fatoumata'])[profile_number],
    (ARRAY['Diallo', 'Camara', 'Bah'])[profile_number],
    (ARRAY['FEMALE', 'MALE', 'FEMALE'])[profile_number],
    accounts.registration_number || '@blaiseconnect.test',
    '+224620100' || lpad(profile_number::text, 3, '0'),
    profile_number || ' avenue de la Direction, Conakry',
    DATE '2020-09-01' + profile_number,
    (ARRAY['Directrice', 'Gestionnaire scolaire', 'Secrétaire'])[profile_number],
    '/photos/administrators/' || accounts.registration_number || '.jpg',
    NULL,
    now(),
    now()
FROM accounts
JOIN LATERAL (
    SELECT substring(accounts.registration_number FROM 2)::integer
) AS profile(profile_number) ON true
WHERE accounts.role = 'ADMIN'
ON CONFLICT (account_id) DO NOTHING;

-- 3. Profils enseignants.
INSERT INTO teachers (
    account_id,
    first_name,
    last_name,
    birth_date,
    gender,
    email,
    phone,
    address,
    hire_date,
    qualification,
    photo_path,
    archived_at,
    created_at,
    updated_at
)
SELECT
    accounts.id,
    (ARRAY['Ibrahima', 'Mariama', 'Ousmane', 'Aïssatou', 'Alpha', 'Kadiatou', 'Moussa'])[profile_number],
    (ARRAY['Sylla', 'Condé', 'Barry', 'Keita', 'Sow', 'Touré', 'Camara'])[profile_number],
    DATE '1980-01-10' + (profile_number * 700),
    CASE WHEN profile_number % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END,
    accounts.registration_number || '@blaiseconnect.test',
    '+224621200' || lpad(profile_number::text, 3, '0'),
    profile_number || ' rue des Enseignants, Conakry',
    DATE '2018-09-01' + (profile_number * 30),
    (ARRAY['Licence Mathématiques', 'Master Lettres', 'Licence Anglais', 'Master Histoire', 'Licence Biologie', 'Master Informatique', 'Licence Physique'])[profile_number],
    '/photos/teachers/' || accounts.registration_number || '.jpg',
    NULL,
    now(),
    now()
FROM accounts
JOIN LATERAL (
    SELECT substring(accounts.registration_number FROM 2)::integer
) AS profile(profile_number) ON true
WHERE accounts.role = 'TEACHER'
ON CONFLICT (account_id) DO NOTHING;

-- 4. Profils eleves.
INSERT INTO students (
    account_id,
    first_name,
    last_name,
    birth_date,
    gender,
    email,
    phone,
    address,
    admission_date,
    status,
    photo_path,
    birth_place,
    nationality,
    previous_level,
    updated_by_account_id,
    archived_at,
    created_at,
    updated_at
)
SELECT
    accounts.id,
    (ARRAY['Abdoulaye', 'Hawa', 'Mohamed', 'Nènè', 'Sékou', 'Mariam', 'Amadou', 'Fanta', 'Lamine', 'Aminata'])[profile_number],
    (ARRAY['Diallo', 'Bah', 'Camara', 'Keita', 'Condé', 'Sylla', 'Sow', 'Barry', 'Touré', 'Cissé'])[profile_number],
    DATE '2011-01-01' + (profile_number * 95),
    CASE WHEN profile_number % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END,
    accounts.registration_number || '@eleve.blaiseconnect.test',
    '+224622300' || lpad(profile_number::text, 3, '0'),
    profile_number || ' quartier scolaire, Conakry',
    DATE '2026-09-01',
    'ACTIVE',
    '/photos/students/' || accounts.registration_number || '.jpg',
    (ARRAY['Conakry', 'Kindia', 'Labé', 'Kankan', 'Mamou', 'Boké', 'Faranah', 'Nzérékoré', 'Coyah', 'Dubréka'])[profile_number],
    'Guinéenne',
    (ARRAY['CM2', 'CM2', 'SIXIEME', 'SIXIEME', 'CINQUIEME', 'CINQUIEME', 'CM2', 'SIXIEME', 'CINQUIEME', 'CM2'])[profile_number],
    administrator_account.id,
    NULL,
    now(),
    now()
FROM accounts
JOIN LATERAL (
    SELECT substring(accounts.registration_number FROM 2)::integer
) AS profile(profile_number) ON true
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator_account
WHERE accounts.role = 'STUDENT'
ON CONFLICT (account_id) DO NOTHING;

-- 5. Profils responsables.
INSERT INTO guardians (
    account_id,
    first_name,
    last_name,
    gender,
    email,
    phone,
    address,
    occupation,
    employer,
    photo_path,
    archived_at,
    created_at,
    updated_at
)
SELECT
    accounts.id,
    (ARRAY['Boubacar', 'Aïcha', 'Lansana', 'M’Mah', 'Aboubacar', 'Hadja', 'Sory', 'Ramatoulaye', 'Fodé', 'Kadiatou'])[profile_number],
    (ARRAY['Diallo', 'Bah', 'Camara', 'Keita', 'Condé', 'Sylla', 'Sow', 'Barry', 'Touré', 'Cissé'])[profile_number],
    CASE WHEN profile_number % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END,
    accounts.registration_number || '@blaiseconnect.test',
    '+224623400' || lpad(profile_number::text, 3, '0'),
    profile_number || ' quartier des Familles, Conakry',
    (ARRAY['Commerçant', 'Infirmière', 'Chauffeur', 'Couturière', 'Ingénieur', 'Enseignante', 'Agriculteur', 'Comptable', 'Technicien', 'Pharmacienne'])[profile_number],
    (ARRAY['Indépendant', 'Hôpital communal', 'Transport urbain', 'Atelier familial', 'Société guinéenne', 'École primaire', 'Exploitation familiale', 'Cabinet comptable', 'Entreprise locale', 'Pharmacie centrale'])[profile_number],
    '/photos/guardians/' || accounts.registration_number || '.jpg',
    NULL,
    now(),
    now()
FROM accounts
JOIN LATERAL (
    SELECT substring(accounts.registration_number FROM 2)::integer
) AS profile(profile_number) ON true
WHERE accounts.role = 'GUARDIAN'
ON CONFLICT (account_id) DO NOTHING;

-- 6. Lien responsable principal/legal fictif par eleve.
WITH ordered_students AS (
    SELECT
        students.id,
        row_number() OVER (ORDER BY accounts.registration_number) AS row_number
    FROM students
    JOIN accounts ON accounts.id = students.account_id
),
ordered_guardians AS (
    SELECT
        guardians.id,
        row_number() OVER (ORDER BY accounts.registration_number) AS row_number
    FROM guardians
    JOIN accounts ON accounts.id = guardians.account_id
)
INSERT INTO student_guardians (
    student_id,
    guardian_id,
    relationship_type,
    relationship_details,
    is_legal_guardian,
    is_primary_contact,
    is_emergency_contact
)
SELECT
    ordered_students.id,
    ordered_guardians.id,
    CASE WHEN ordered_students.row_number % 2 = 0 THEN 'MOTHER' ELSE 'FATHER' END,
    NULL,
    true,
    true,
    true
FROM ordered_students
JOIN ordered_guardians ON ordered_guardians.row_number = ordered_students.row_number
ON CONFLICT (student_id, guardian_id) DO NOTHING;

-- 7. Annee scolaire courante.
INSERT INTO school_years (
    name,
    start_date,
    end_date,
    is_current
)
VALUES (
    '2026-2027',
    DATE '2026-09-01',
    DATE '2027-07-15',
    true
)
ON CONFLICT (name) DO NOTHING;

-- 8. Periodes de bulletin.
INSERT INTO reporting_periods (
    school_year_id,
    name,
    start_date,
    end_date
)
SELECT
    school_years.id,
    period_data.name,
    period_data.start_date,
    period_data.end_date
FROM school_years
CROSS JOIN (
    VALUES
        ('Période 1', DATE '2026-09-01', DATE '2026-12-18'),
        ('Période 2', DATE '2026-12-19', DATE '2027-03-31'),
        ('Période 3', DATE '2027-04-01', DATE '2027-07-15')
) AS period_data(name, start_date, end_date)
WHERE school_years.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1
      FROM reporting_periods
      WHERE reporting_periods.school_year_id = school_years.id
        AND reporting_periods.start_date = period_data.start_date
  );

-- 9. Tous les niveaux disponibles ; le jeu de test active le secondaire.
INSERT INTO class_levels (code, name, education_stage, display_order, is_active)
VALUES
    ('PETITE_SECTION', 'Petite Section', 'PRESCHOOL', 1, false),
    ('MOYENNE_SECTION', 'Moyenne Section', 'PRESCHOOL', 2, false),
    ('GRANDE_SECTION', 'Grande Section', 'PRESCHOOL', 3, false),
    ('CP', 'CP', 'PRIMARY', 4, false),
    ('CE1', 'CE1', 'PRIMARY', 5, false),
    ('CE2', 'CE2', 'PRIMARY', 6, false),
    ('CM1', 'CM1', 'PRIMARY', 7, false),
    ('CM2', 'CM2', 'PRIMARY', 8, false),
    ('SIXIEME', '6ème', 'MIDDLE_SCHOOL', 9, false),
    ('CINQUIEME', '5ème', 'MIDDLE_SCHOOL', 10, false),
    ('QUATRIEME', '4ème', 'MIDDLE_SCHOOL', 11, false),
    ('TROISIEME', '3ème', 'MIDDLE_SCHOOL', 12, false),
    ('SECONDE', '2nde', 'HIGH_SCHOOL', 13, true),
    ('PREMIERE', '1ère', 'HIGH_SCHOOL', 14, true),
    ('TERMINALE', 'Terminale', 'HIGH_SCHOOL', 15, true)
ON CONFLICT (code) DO NOTHING;

-- Normalisation des display_order (si des valeurs existaient deja).
UPDATE class_levels SET display_order = 1 WHERE code = 'PETITE_SECTION';
UPDATE class_levels SET display_order = 2 WHERE code = 'MOYENNE_SECTION';
UPDATE class_levels SET display_order = 3 WHERE code = 'GRANDE_SECTION';
UPDATE class_levels SET display_order = 4 WHERE code = 'CP';
UPDATE class_levels SET display_order = 5 WHERE code = 'CE1';
UPDATE class_levels SET display_order = 6 WHERE code = 'CE2';
UPDATE class_levels SET display_order = 7 WHERE code = 'CM1';
UPDATE class_levels SET display_order = 8 WHERE code = 'CM2';
UPDATE class_levels SET display_order = 9 WHERE code = 'SIXIEME';
UPDATE class_levels SET display_order = 10 WHERE code = 'CINQUIEME';
UPDATE class_levels SET display_order = 11 WHERE code = 'QUATRIEME';
UPDATE class_levels SET display_order = 12 WHERE code = 'TROISIEME';
UPDATE class_levels SET display_order = 13 WHERE code = 'SECONDE';
UPDATE class_levels SET display_order = 14 WHERE code = 'PREMIERE';
UPDATE class_levels SET display_order = 15 WHERE code = 'TERMINALE';

UPDATE class_levels
SET is_active = education_stage IN ('MIDDLE_SCHOOL', 'HIGH_SCHOOL');

-- 10. Matieres de test.
INSERT INTO subjects (
    name,
    description,
    is_active
)
VALUES
    ('Mathématiques', 'Matière fictive de développement', true),
    ('Français', 'Matière fictive de développement', true),
    ('Anglais', 'Matière fictive de développement', true),
    ('Histoire-Géographie', 'Matière fictive de développement', true),
    ('Sciences', 'Matière fictive de développement', true),
    ('Informatique', 'Matière fictive de développement', true)
ON CONFLICT DO NOTHING;

-- 11. Toutes les classes annuelles du secondaire, de la 6eme a la Terminale.
INSERT INTO classes (
    school_year_id,
    class_level_id,
    main_teacher_id,
    group_label,
    capacity
)
SELECT
    school_years.id,
    class_levels.id,
    teachers.id,
    'A',
    30
FROM (
    VALUES
        ('SIXIEME', 'e000001'),
        ('CINQUIEME', 'e000002'),
        ('QUATRIEME', 'e000003'),
        ('TROISIEME', 'e000004'),
        ('SECONDE', 'e000005'),
        ('PREMIERE', 'e000006'),
        ('TERMINALE', 'e000007')
) AS class_data(level_code, teacher_registration_number)
JOIN school_years ON school_years.name = '2026-2027'
JOIN class_levels ON class_levels.code::text = class_data.level_code
JOIN accounts ON accounts.registration_number = class_data.teacher_registration_number
JOIN teachers ON teachers.account_id = accounts.id
ON CONFLICT (school_year_id, class_level_id, group_label) DO NOTHING;

-- 12. Association de toutes les matieres de test aux classes de 2026-2027.
INSERT INTO class_subjects (
    class_id,
    subject_id,
    coefficient
)
SELECT
    classes.id,
    subjects.id,
    CASE subjects.name
        WHEN 'Mathématiques' THEN 4.00
        WHEN 'Français' THEN 4.00
        WHEN 'Anglais' THEN 3.00
        WHEN 'Histoire-Géographie' THEN 2.00
        WHEN 'Sciences' THEN 2.00
        WHEN 'Informatique' THEN 2.00
        ELSE 1.00
    END
FROM classes
JOIN school_years ON school_years.id = classes.school_year_id
CROSS JOIN subjects
WHERE school_years.name = '2026-2027'
  AND subjects.name IN (
      'Mathématiques',
      'Français',
      'Anglais',
      'Histoire-Géographie',
      'Sciences',
      'Informatique'
  )
  AND subjects.is_active = true
ON CONFLICT (class_id, subject_id) DO NOTHING;

-- 13. Repartition des eleves dans toutes les classes du secondaire.
WITH ordered_students AS (
    SELECT
        students.id,
        row_number() OVER (
            ORDER BY accounts.registration_number
        ) AS row_number
    FROM students
    JOIN accounts ON accounts.id = students.account_id
    WHERE accounts.role = 'STUDENT'
      AND NOT EXISTS (
          SELECT 1
          FROM student_enrollments AS existing_enrollment
          WHERE existing_enrollment.student_id = students.id
            AND existing_enrollment.end_date IS NULL
      )
),
ordered_classes AS (
    SELECT
        classes.id,
        row_number() OVER (
            ORDER BY class_levels.display_order
        ) AS row_number
    FROM classes
    JOIN school_years ON school_years.id = classes.school_year_id
    JOIN class_levels ON class_levels.id = classes.class_level_id
    WHERE school_years.name = '2026-2027'
),
class_count AS (
    SELECT count(*) AS total
    FROM ordered_classes
)
INSERT INTO student_enrollments (
    student_id,
    class_id,
    start_date
)
SELECT
    ordered_students.id,
    ordered_classes.id,
    DATE '2026-09-01'
FROM ordered_students
JOIN class_count ON class_count.total > 0
JOIN ordered_classes
    ON ordered_classes.row_number = ((ordered_students.row_number - 1) % class_count.total) + 1
ON CONFLICT (student_id, class_id) DO NOTHING;

-- 14. Affectation d'un enseignant à chaque matière de chaque classe.
INSERT INTO teacher_assignments (
    teacher_id,
    class_subject_id,
    start_date
)
SELECT
    teacher.id,
    class_subject.id,
    school_year.start_date
FROM class_subjects AS class_subject
JOIN classes AS school_class ON school_class.id = class_subject.class_id
JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
JOIN subjects AS subject ON subject.id = class_subject.subject_id
JOIN (
    VALUES
        ('Mathématiques', 'e000001'),
        ('Français', 'e000002'),
        ('Anglais', 'e000003'),
        ('Histoire-Géographie', 'e000004'),
        ('Sciences', 'e000005'),
        ('Informatique', 'e000006')
) AS assignment_data(subject_name, teacher_registration_number)
    ON assignment_data.subject_name = subject.name
JOIN accounts AS teacher_account
    ON teacher_account.registration_number = assignment_data.teacher_registration_number
JOIN teachers AS teacher ON teacher.account_id = teacher_account.id
WHERE school_year.name = '2026-2027'
  AND NOT EXISTS (
      SELECT 1
      FROM teacher_assignments AS existing_assignment
      WHERE existing_assignment.class_subject_id = class_subject.id
        AND existing_assignment.end_date IS NULL
  );

-- 15. Deux évaluations fictives par matière de classe.
INSERT INTO assessments (
    teacher_assignment_id,
    title,
    description,
    assessment_date,
    maximum_score,
    coefficient
)
SELECT
    assignment.id,
    assessment_data.title,
    'Évaluation fictive utilisée pour vérifier les notes et les bulletins.',
    assessment_data.assessment_date,
    assessment_data.maximum_score,
    assessment_data.coefficient
FROM teacher_assignments AS assignment
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN classes AS school_class ON school_class.id = class_subject.class_id
JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
CROSS JOIN (
    VALUES
        ('Évaluation diagnostique', DATE '2026-10-05', 20.00::numeric, 1.00::numeric),
        ('Contrôle de la période 1', DATE '2026-11-10', 10.00::numeric, 2.00::numeric)
) AS assessment_data(title, assessment_date, maximum_score, coefficient)
WHERE school_year.name = '2026-2027'
ON CONFLICT (teacher_assignment_id, title, assessment_date) DO NOTHING;

-- 16. Notes des élèves. Une absence justifiée est exclue du calcul ; une
-- absence non justifiée reste ABSENT en base mais vaut zéro dans le calcul.
INSERT INTO grades (
    assessment_id,
    student_enrollment_id,
    result_type,
    score,
    comment,
    justification_status,
    reviewed_by_account_id,
    reviewed_at
)
SELECT
    assessment.id,
    enrollment.id,
    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_number IN (1, 2)
        THEN 'ABSENT'
        ELSE 'SCORED'
    END,
    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_number IN (1, 2)
        THEN NULL
        ELSE round(
            mod(
                student_number * 3 + char_length(subject.name) + extract(day FROM assessment.assessment_date)::integer,
                assessment.maximum_score::integer + 1
            )::numeric,
            2
        )
    END,
    'Résultat fictif de développement',
    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_number = 1
        THEN 'JUSTIFIED'
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_number = 2
        THEN 'UNJUSTIFIED'
        ELSE NULL
    END,
    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_number = 1
        THEN administrator_account.id
        ELSE NULL
    END,
    CASE
        WHEN assessment.title = 'Évaluation diagnostique'
         AND subject.name = 'Mathématiques'
         AND student_number = 1
        THEN TIMESTAMPTZ '2026-10-07 10:00:00+00'
        ELSE NULL
    END
FROM assessments AS assessment
JOIN teacher_assignments AS assignment
    ON assignment.id = assessment.teacher_assignment_id
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN subjects AS subject ON subject.id = class_subject.subject_id
JOIN student_enrollments AS enrollment
    ON enrollment.class_id = class_subject.class_id
JOIN students AS student ON student.id = enrollment.student_id
JOIN accounts AS student_account ON student_account.id = student.account_id
JOIN LATERAL (
    SELECT substring(student_account.registration_number FROM 2)::integer
) AS profile(student_number) ON true
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator_account
ON CONFLICT (assessment_id, student_enrollment_id) DO NOTHING;

-- 17. Demande fictive de correction d'une note numérique.
INSERT INTO grade_change_requests (
    grade_id,
    requested_by_account_id,
    previous_result_type,
    previous_score,
    previous_justification_status,
    proposed_result_type,
    proposed_score,
    proposed_justification_status,
    request_reason
)
SELECT
    grade.id,
    teacher.account_id,
    grade.result_type,
    grade.score,
    grade.justification_status,
    'SCORED',
    CASE
        WHEN grade.score < assessment.maximum_score THEN grade.score + 1
        ELSE grade.score - 1
    END,
    NULL,
    'Erreur de saisie fictive à vérifier.'
FROM grades AS grade
JOIN assessments AS assessment ON assessment.id = grade.assessment_id
JOIN teacher_assignments AS assignment
    ON assignment.id = assessment.teacher_assignment_id
JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
WHERE grade.result_type = 'SCORED'
  AND NOT EXISTS (
      SELECT 1
      FROM grade_change_requests AS existing_request
      WHERE existing_request.grade_id = grade.id
        AND existing_request.status = 'PENDING'
  )
ORDER BY grade.created_at, grade.id
LIMIT 1;

-- 18. Appel de présence pour le cours de mathématiques de chaque classe.
INSERT INTO attendance_events (
    teacher_assignment_id,
    attendance_date,
    course_start_time,
    course_end_time
)
SELECT
    assignment.id,
    DATE '2026-10-20',
    TIME '08:00',
    TIME '09:00'
FROM teacher_assignments AS assignment
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN subjects AS subject ON subject.id = class_subject.subject_id
JOIN classes AS school_class ON school_class.id = class_subject.class_id
JOIN school_years AS school_year ON school_year.id = school_class.school_year_id
WHERE school_year.name = '2026-2027'
  AND subject.name = 'Mathématiques'
ON CONFLICT (
    teacher_assignment_id,
    attendance_date,
    course_start_time,
    course_end_time
) DO NOTHING;

-- Seuls les élèves absents ou en retard produisent une ligne d'incident.
WITH ranked_enrollments AS (
    SELECT
        enrollment.id,
        enrollment.class_id,
        row_number() OVER (
            PARTITION BY enrollment.class_id
            ORDER BY student_account.registration_number
        ) AS class_position
    FROM student_enrollments AS enrollment
    JOIN students AS student ON student.id = enrollment.student_id
    JOIN accounts AS student_account ON student_account.id = student.account_id
)
INSERT INTO attendance_records (
    attendance_event_id,
    student_enrollment_id,
    incident_type,
    late_minutes,
    reason,
    justification_status,
    recorded_by_account_id,
    reviewed_by_account_id,
    reviewed_at,
    updated_by_account_id
)
SELECT
    event.id,
    ranked_enrollment.id,
    CASE WHEN ranked_enrollment.class_position = 1 THEN 'ABSENT' ELSE 'LATE' END,
    CASE WHEN ranked_enrollment.class_position = 2 THEN 12 ELSE NULL END,
    NULL,
    CASE WHEN ranked_enrollment.class_position = 1 THEN 'JUSTIFIED' ELSE 'PENDING' END,
    teacher.account_id,
    CASE WHEN ranked_enrollment.class_position = 1 THEN administrator_account.id ELSE NULL END,
    CASE
        WHEN ranked_enrollment.class_position = 1
        THEN TIMESTAMPTZ '2026-10-21 09:00:00+00'
        ELSE NULL
    END,
    CASE
        WHEN ranked_enrollment.class_position = 1 THEN administrator_account.id
        ELSE teacher.account_id
    END
FROM attendance_events AS event
JOIN teacher_assignments AS assignment
    ON assignment.id = event.teacher_assignment_id
JOIN teachers AS teacher ON teacher.id = assignment.teacher_id
JOIN class_subjects AS class_subject
    ON class_subject.id = assignment.class_subject_id
JOIN ranked_enrollments AS ranked_enrollment
    ON ranked_enrollment.class_id = class_subject.class_id
   AND ranked_enrollment.class_position <= 2
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator_account
ON CONFLICT DO NOTHING;

-- Une modification crée automatiquement une ligne d'historique.
UPDATE attendance_records AS attendance_record
SET
    reason = 'Retard lié au transport scolaire.',
    last_change_reason = 'Ajout du motif communiqué.',
    updated_by_account_id = attendance_record.recorded_by_account_id
WHERE attendance_record.incident_type = 'LATE'
  AND attendance_record.reason IS NULL;

-- 19. Signalement fictif d'une correction d'assiduité.
INSERT INTO attendance_change_requests (
    attendance_record_id,
    requested_by_account_id,
    requested_action,
    proposed_incident_type,
    proposed_late_minutes,
    proposed_reason,
    request_reason
)
SELECT
    attendance_record.id,
    attendance_record.recorded_by_account_id,
    'UPDATE',
    'LATE',
    5,
    attendance_record.reason,
    'Durée du retard fictivement corrigée.'
FROM attendance_records AS attendance_record
WHERE attendance_record.incident_type = 'LATE'
  AND attendance_record.deleted_at IS NULL
  AND NOT EXISTS (
      SELECT 1
      FROM attendance_change_requests AS existing_request
      WHERE existing_request.attendance_record_id = attendance_record.id
        AND existing_request.status = 'PENDING'
  )
ORDER BY attendance_record.created_at, attendance_record.id
LIMIT 1;

-- 20. Métadonnées de justificatifs fictifs ; les fichiers restent hors de PostgreSQL.
INSERT INTO documents (
    document_type_id,
    title,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    sha256,
    uploaded_by_account_id
)
SELECT
    document_type.id,
    'Justificatif de l''évaluation diagnostique',
    'accounts/' || student_account.registration_number
        || '/justificatifs/evaluation-' || grade.id || '.pdf',
    'justificatif-evaluation.pdf',
    'application/pdf',
    2048,
    repeat(md5(grade.id::text), 2),
    administrator_account.id
FROM grades AS grade
JOIN student_enrollments AS enrollment
    ON enrollment.id = grade.student_enrollment_id
JOIN students AS student ON student.id = enrollment.student_id
JOIN accounts AS student_account ON student_account.id = student.account_id
JOIN document_types AS document_type
    ON document_type.code = 'ASSESSMENT_JUSTIFICATION'
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator_account
WHERE grade.result_type = 'ABSENT'
  AND grade.justification_status = 'JUSTIFIED'
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO grade_documents (grade_id, document_id)
SELECT grade.id, document.id
FROM grades AS grade
JOIN student_enrollments AS enrollment
    ON enrollment.id = grade.student_enrollment_id
JOIN students AS student ON student.id = enrollment.student_id
JOIN accounts AS student_account ON student_account.id = student.account_id
JOIN documents AS document
    ON document.storage_path = 'accounts/' || student_account.registration_number
        || '/justificatifs/evaluation-' || grade.id || '.pdf'
ON CONFLICT (grade_id, document_id) DO NOTHING;

INSERT INTO documents (
    document_type_id,
    title,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    sha256,
    uploaded_by_account_id
)
SELECT
    document_type.id,
    'Justificatif d''absence au cours',
    'accounts/' || student_account.registration_number
        || '/justificatifs/absence-' || attendance_record.id || '.pdf',
    'justificatif-absence.pdf',
    'application/pdf',
    3072,
    repeat(md5(attendance_record.id::text), 2),
    administrator_account.id
FROM attendance_records AS attendance_record
JOIN student_enrollments AS enrollment
    ON enrollment.id = attendance_record.student_enrollment_id
JOIN students AS student ON student.id = enrollment.student_id
JOIN accounts AS student_account ON student_account.id = student.account_id
JOIN document_types AS document_type
    ON document_type.code = 'ATTENDANCE_JUSTIFICATION'
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator_account
WHERE attendance_record.incident_type = 'ABSENT'
  AND attendance_record.justification_status = 'JUSTIFIED'
ON CONFLICT (storage_path) DO NOTHING;

INSERT INTO attendance_record_documents (attendance_record_id, document_id)
SELECT attendance_record.id, document.id
FROM attendance_records AS attendance_record
JOIN student_enrollments AS enrollment
    ON enrollment.id = attendance_record.student_enrollment_id
JOIN students AS student ON student.id = enrollment.student_id
JOIN accounts AS student_account ON student_account.id = student.account_id
JOIN documents AS document
    ON document.storage_path = 'accounts/' || student_account.registration_number
        || '/justificatifs/absence-' || attendance_record.id || '.pdf'
ON CONFLICT (attendance_record_id, document_id) DO NOTHING;

-- 21. Bulletins provisoires de la première période.
WITH subject_averages AS (
    SELECT
        grade.student_enrollment_id,
        class_subject.id AS class_subject_id,
        class_subject.coefficient AS subject_coefficient,
        round(
            sum(
                CASE
                    WHEN grade.result_type = 'SCORED'
                    THEN (grade.score / assessment.maximum_score) * 20 * assessment.coefficient
                    WHEN grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                    THEN 0
                    ELSE NULL
                END
            )
            / NULLIF(
                sum(
                    CASE
                        WHEN grade.result_type = 'SCORED'
                          OR grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                        THEN assessment.coefficient
                        ELSE 0
                    END
                ),
                0
            ),
            2
        ) AS subject_average
    FROM grades AS grade
    JOIN assessments AS assessment ON assessment.id = grade.assessment_id
    JOIN teacher_assignments AS assignment
        ON assignment.id = assessment.teacher_assignment_id
    JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
    JOIN reporting_periods AS period
        ON assessment.assessment_date BETWEEN period.start_date AND period.end_date
    JOIN school_years AS school_year ON school_year.id = period.school_year_id
    WHERE school_year.name = '2026-2027'
      AND period.name = 'Période 1'
    GROUP BY
        grade.student_enrollment_id,
        class_subject.id,
        class_subject.coefficient
),
general_averages AS (
    SELECT
        subject_average.student_enrollment_id,
        round(
            sum(subject_average.subject_average * subject_average.subject_coefficient)
            / NULLIF(sum(subject_average.subject_coefficient), 0),
            2
        ) AS general_average
    FROM subject_averages AS subject_average
    WHERE subject_average.subject_average IS NOT NULL
    GROUP BY subject_average.student_enrollment_id
)
INSERT INTO report_cards (
    student_enrollment_id,
    reporting_period_id,
    general_average,
    overall_comment,
    generated_by_account_id,
    generated_at
)
SELECT
    general_average.student_enrollment_id,
    period.id,
    general_average.general_average,
    'Bulletin provisoire fictif de développement.',
    administrator_account.id,
    TIMESTAMPTZ '2026-12-19 08:00:00+00'
FROM general_averages AS general_average
CROSS JOIN (
    SELECT reporting_period.id
    FROM reporting_periods AS reporting_period
    JOIN school_years AS school_year
        ON school_year.id = reporting_period.school_year_id
    WHERE school_year.name = '2026-2027'
      AND reporting_period.name = 'Période 1'
) AS period
CROSS JOIN (
    SELECT id
    FROM accounts
    WHERE registration_number = 'a000001'
) AS administrator_account
ON CONFLICT (student_enrollment_id, reporting_period_id) DO NOTHING;

WITH subject_averages AS (
    SELECT
        grade.student_enrollment_id,
        class_subject.id AS class_subject_id,
        class_subject.coefficient AS subject_coefficient,
        round(
            sum(
                CASE
                    WHEN grade.result_type = 'SCORED'
                    THEN (grade.score / assessment.maximum_score) * 20 * assessment.coefficient
                    WHEN grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                    THEN 0
                    ELSE NULL
                END
            )
            / NULLIF(
                sum(
                    CASE
                        WHEN grade.result_type = 'SCORED'
                          OR grade.justification_status IN ('UNJUSTIFIED', 'REJECTED')
                        THEN assessment.coefficient
                        ELSE 0
                    END
                ),
                0
            ),
            2
        ) AS subject_average
    FROM grades AS grade
    JOIN assessments AS assessment ON assessment.id = grade.assessment_id
    JOIN teacher_assignments AS assignment
        ON assignment.id = assessment.teacher_assignment_id
    JOIN class_subjects AS class_subject
        ON class_subject.id = assignment.class_subject_id
    JOIN reporting_periods AS period
        ON assessment.assessment_date BETWEEN period.start_date AND period.end_date
    JOIN school_years AS school_year ON school_year.id = period.school_year_id
    WHERE school_year.name = '2026-2027'
      AND period.name = 'Période 1'
    GROUP BY
        grade.student_enrollment_id,
        class_subject.id,
        class_subject.coefficient
)
INSERT INTO report_card_subjects (
    report_card_id,
    class_subject_id,
    subject_average,
    applied_coefficient,
    teacher_comment
)
SELECT
    report_card.id,
    subject_average.class_subject_id,
    subject_average.subject_average,
    subject_average.subject_coefficient,
    'Appréciation fictive de développement.'
FROM subject_averages AS subject_average
JOIN report_cards AS report_card
    ON report_card.student_enrollment_id = subject_average.student_enrollment_id
JOIN reporting_periods AS period ON period.id = report_card.reporting_period_id
WHERE period.name = 'Période 1'
  AND subject_average.subject_average IS NOT NULL
ON CONFLICT (report_card_id, class_subject_id) DO NOTHING;

INSERT INTO report_card_grades (report_card_id, grade_id)
SELECT report_card.id, grade.id
FROM report_cards AS report_card
JOIN reporting_periods AS period ON period.id = report_card.reporting_period_id
JOIN grades AS grade
    ON grade.student_enrollment_id = report_card.student_enrollment_id
JOIN assessments AS assessment ON assessment.id = grade.assessment_id
WHERE assessment.assessment_date BETWEEN period.start_date AND period.end_date
ON CONFLICT (report_card_id, grade_id) DO NOTHING;

COMMIT;
