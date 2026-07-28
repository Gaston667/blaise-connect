-- Idempotent seed for test students and accounts
-- Run as: docker compose exec -T postgres psql -U dialloa -d blaise_connect -f - < database/init/010_seed_students.sql

BEGIN;

-- Create some accounts (registration_number must be unique)
INSERT INTO accounts (id, registration_number, password_hash, role, is_active, failed_login_attempts, locked_until, created_at, updated_at)
SELECT gen_random_uuid(), v.reg, crypt(v.pw, gen_salt('bf')), 'STUDENT', true, 0, NULL, now(), now()
FROM (VALUES
  ('a000001', 'password1'),
  ('a000002', 'password2'),
  ('a000003', 'password3'),
  ('a000004', 'password4'),
  ('a000005', 'password5')
) AS v(reg, pw)
ON CONFLICT (registration_number) DO NOTHING;

-- Create students linked to accounts (if not exists)
INSERT INTO students (id, account_id, first_name, last_name, birth_date, admission_date, status, created_at, updated_at)
SELECT gen_random_uuid(), a.id, s.first_name, s.last_name, s.birth_date, now()::date, 'ACTIVE', now(), now()
FROM (
  VALUES
    ('a000001','Alice','Durand', DATE '2010-04-12'),
    ('a000002','Benoit','Martin', DATE '2011-09-30'),
    ('a000003','Chloe','Nguyen', DATE '2010-12-01'),
    ('a000004','Daniel','Lopez', DATE '2009-06-15'),
    ('a000005','Emma','Klein', DATE '2012-01-20')
) AS s(reg, first_name, last_name, birth_date)
JOIN accounts a ON a.registration_number = s.reg AND a.role = 'STUDENT'
LEFT JOIN students st ON st.account_id = a.id
WHERE st.id IS NULL;

-- Optionally create a student_enrollment for each student into an existing class if available.
-- This attempts to pick the first active class in the current school year.
DO $$
DECLARE
  class_id uuid;
  enrollment_id uuid;
  rec record;
BEGIN
  SELECT id INTO class_id FROM classes LIMIT 1;
  IF class_id IS NULL THEN
    RAISE NOTICE 'No classes found, skipping enrollments.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT s.id AS student_id
    FROM students s
    LEFT JOIN student_enrollments se ON se.student_id = s.id AND se.end_date IS NULL
    WHERE se.id IS NULL
  LOOP
    enrollment_id := gen_random_uuid();
    INSERT INTO student_enrollments (id, student_id, class_id, start_date)
    VALUES (enrollment_id, rec.student_id, class_id, now()::date)
    ON CONFLICT DO NOTHING;
  END LOOP;
END$$;

COMMIT;

-- End of seed
