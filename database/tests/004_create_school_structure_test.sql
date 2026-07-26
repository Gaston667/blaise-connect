-- =========================================================
-- TESTS SQL DE LA MIGRATION 004
-- =========================================================
-- À exécuter uniquement sur une base de test après 001 à 004.
-- Les données fictives sont annulées à la fin.
-- =========================================================

BEGIN;

DO $$
DECLARE
    v_admin_account_id uuid;
    v_teacher_account_id uuid;
    v_second_teacher_account_id uuid;
    v_student_account_id uuid;
    v_student_id uuid;
    v_teacher_id uuid;
    v_school_year_id uuid;
    v_other_school_year_id uuid;
    v_class_level_id uuid;
    v_class_id uuid;
    v_subject_id uuid;
    v_first_period_id uuid;
BEGIN
    INSERT INTO accounts (
        registration_number,
        password_hash,
        role
    )
    VALUES (
        'a000001',
        '$argon2id$v=19$m=65536,t=3,p=4$fake$fake_hash_value',
        'ADMIN'
    )
    RETURNING id INTO v_admin_account_id;

    INSERT INTO accounts (
        registration_number,
        password_hash,
        role
    )
    VALUES (
        't000001',
        '$argon2id$v=19$m=65536,t=3,p=4$fake$fake_hash_value',
        'TEACHER'
    )
    RETURNING id INTO v_teacher_account_id;

    INSERT INTO accounts (
        registration_number,
        password_hash,
        role
    )
    VALUES (
        'e000001',
        '$argon2id$v=19$m=65536,t=3,p=4$fake$fake_hash_value',
        'STUDENT'
    )
    RETURNING id INTO v_student_account_id;

    INSERT INTO students (
        account_id,
        first_name,
        last_name,
        admission_date
    )
    VALUES (
        v_student_account_id,
        'Fatou',
        'Camara',
        DATE '2026-09-01'
    )
    RETURNING id INTO v_student_id;

    -- Le statut ARCHIVED exige une date d'archivage.
    BEGIN
        UPDATE students
           SET status = 'ARCHIVED'
         WHERE id = v_student_id;

        RAISE EXCEPTION
            'Échec : un élève archivé sans date a été accepté.';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    INSERT INTO teachers (
        account_id,
        first_name,
        last_name,
        email,
        hire_date,
        photo_path
    )
    VALUES (
        v_teacher_account_id,
        'Aminata',
        'Diallo',
        'aminata.diallo@example.test',
        DATE '2026-07-01',
        'teachers/aminata-diallo.webp'
    )
    RETURNING id INTO v_teacher_id;

    -- Email enseignant unique sans tenir compte de la casse.
    BEGIN
        INSERT INTO accounts (
            registration_number,
            password_hash,
            role
        )
        VALUES (
            't000002',
            '$argon2id$v=19$m=65536,t=3,p=4$fake$fake_hash_value',
            'TEACHER'
        )
        RETURNING id INTO v_second_teacher_account_id;

        INSERT INTO teachers (
            account_id,
            first_name,
            last_name,
            email,
            hire_date
        )
        VALUES (
            v_second_teacher_account_id,
            'Mamadou',
            'Bah',
            'AMINATA.DIALLO@example.test',
            DATE '2026-07-01'
        );

        RAISE EXCEPTION
            'Échec : un email enseignant en doublon a été accepté.';
    EXCEPTION
        WHEN unique_violation THEN
            NULL;
    END;

    INSERT INTO school_years (
        name,
        start_date,
        end_date
    )
    VALUES (
        '2026-2027',
        DATE '2026-09-01',
        DATE '2027-06-30'
    )
    RETURNING id INTO v_school_year_id;

    -- Une année peut devenir courante avant la création de ses périodes.
    UPDATE school_years
       SET is_current = true
     WHERE id = v_school_year_id;

    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;

    INSERT INTO reporting_periods (
        school_year_id,
        name,
        start_date,
        end_date
    )
    VALUES
        (
            v_school_year_id,
            'Trimestre 1',
            DATE '2026-09-01',
            DATE '2026-12-18'
        ),
        (
            v_school_year_id,
            'Trimestre 2',
            DATE '2026-12-19',
            DATE '2027-03-31'
        ),
        (
            v_school_year_id,
            'Trimestre 3',
            DATE '2027-04-01',
            DATE '2027-06-30'
        );

    SELECT rp.id
      INTO v_first_period_id
      FROM reporting_periods AS rp
     WHERE rp.school_year_id = v_school_year_id
       AND rp.name = 'Trimestre 1';

    -- Les périodes peuvent ensuite être définies progressivement.
    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;

    -- Une période courante ne peut pas créer un espace.
    BEGIN
        UPDATE reporting_periods
           SET end_date = DATE '2026-12-17'
         WHERE id = v_first_period_id;

        SET CONSTRAINTS ALL IMMEDIATE;

        RAISE EXCEPTION
            'Échec : un espace entre les périodes a été accepté.';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    SET CONSTRAINTS ALL DEFERRED;

    -- Deux années ne peuvent pas se chevaucher.
    BEGIN
        INSERT INTO school_years (
            name,
            start_date,
            end_date
        )
        VALUES (
            '2027-CHEVAUCHEMENT',
            DATE '2027-06-15',
            DATE '2028-05-31'
        );

        RAISE EXCEPTION
            'Échec : deux années qui se chevauchent ont été acceptées.';
    EXCEPTION
        WHEN exclusion_violation THEN
            NULL;
    END;

    INSERT INTO school_years (
        name,
        start_date,
        end_date
    )
    VALUES (
        '2027-2028',
        DATE '2027-09-01',
        DATE '2028-06-30'
    )
    RETURNING id INTO v_other_school_year_id;

    -- Une période ne peut pas sortir de son année.
    BEGIN
        INSERT INTO reporting_periods (
            school_year_id,
            name,
            start_date,
            end_date
        )
        VALUES (
            v_other_school_year_id,
            'Période invalide',
            DATE '2027-08-31',
            DATE '2027-12-31'
        );

        SET CONSTRAINTS ALL IMMEDIATE;

        RAISE EXCEPTION
            'Échec : une période hors de son année a été acceptée.';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    SET CONSTRAINTS ALL DEFERRED;

    INSERT INTO class_levels (
        code,
        name,
        education_stage,
        display_order
    )
    VALUES (
        'TERMINALE',
        'Terminale',
        'HIGH_SCHOOL',
        15
    )
    RETURNING id INTO v_class_level_id;

    INSERT INTO classes (
        school_year_id,
        class_level_id,
        main_teacher_id,
        group_label,
        capacity
    )
    VALUES (
        v_school_year_id,
        v_class_level_id,
        v_teacher_id,
        'A',
        30
    )
    RETURNING id INTO v_class_id;

    INSERT INTO student_enrollments (
        student_id,
        class_id,
        start_date
    )
    VALUES (
        v_student_id,
        v_class_id,
        DATE '2026-09-01'
    );

    -- Un élève ne peut posséder qu'une seule inscription ouverte.
    BEGIN
        INSERT INTO student_enrollments (
            student_id,
            class_id,
            start_date
        )
        VALUES (
            v_student_id,
            v_class_id,
            DATE '2026-09-02'
        );

        RAISE EXCEPTION
            'Échec : une seconde inscription ouverte a été acceptée.';
    EXCEPTION
        WHEN unique_violation THEN
            NULL;
    END;

    INSERT INTO subjects (
        name,
        description
    )
    VALUES (
        'Mathématiques',
        'Enseignement de mathématiques.'
    )
    RETURNING id INTO v_subject_id;

    INSERT INTO class_subjects (
        class_id,
        subject_id,
        coefficient
    )
    VALUES (
        v_class_id,
        v_subject_id,
        4.00
    );

    -- Un coefficient doit être strictement positif.
    BEGIN
        UPDATE class_subjects
           SET coefficient = 0
         WHERE class_subjects.class_id = v_class_id
           AND class_subjects.subject_id = v_subject_id;

        RAISE EXCEPTION
            'Échec : un coefficient nul a été accepté.';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    -- Un enseignant ne peut pas clôturer l'année.
    BEGIN
        UPDATE school_years
           SET is_current = false,
               closed_at = now(),
               closed_by_account_id = v_teacher_account_id
         WHERE id = v_school_year_id;

        SET CONSTRAINTS ALL IMMEDIATE;

        RAISE EXCEPTION
            'Échec : un compte non ADMIN a clôturé l''année.';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    SET CONSTRAINTS ALL DEFERRED;

    -- Clôture valide par un administrateur.
    UPDATE school_years
       SET is_current = false,
           closed_at = now(),
           closed_by_account_id = v_admin_account_id
     WHERE id = v_school_year_id;

    SET CONSTRAINTS ALL IMMEDIATE;
    SET CONSTRAINTS ALL DEFERRED;

    IF NOT EXISTS (
        SELECT 1
          FROM student_enrollments AS se
         WHERE se.student_id = v_student_id
           AND se.end_date = DATE '2027-06-30'
           AND se.end_reason = 'YEAR_COMPLETED'
    ) THEN
        RAISE EXCEPTION
            'Échec : la clôture n''a pas terminé l''inscription ouverte.';
    END IF;

    -- Une année clôturée ne peut plus être rouverte.
    BEGIN
        UPDATE school_years
           SET closed_at = NULL,
               closed_by_account_id = NULL
         WHERE id = v_school_year_id;

        RAISE EXCEPTION
            'Échec : une année clôturée a été rouverte.';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    -- Les périodes de l'année clôturée sont immuables.
    BEGIN
        UPDATE reporting_periods
           SET name = 'Période modifiée'
         WHERE id = v_first_period_id;

        RAISE EXCEPTION
            'Échec : une période d''année clôturée a été modifiée.';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    -- Les classes de l'année clôturée sont immuables.
    BEGIN
        UPDATE classes
           SET capacity = 35
         WHERE id = v_class_id;

        RAISE EXCEPTION
            'Échec : une classe d''année clôturée a été modifiée.';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;

    -- Les matières de classe de l'année clôturée sont immuables.
    BEGIN
        UPDATE class_subjects
           SET coefficient = 5.00
         WHERE class_subjects.class_id = v_class_id
           AND class_subjects.subject_id = v_subject_id;

        RAISE EXCEPTION
            'Échec : une matière de classe clôturée a été modifiée.';
    EXCEPTION
        WHEN check_violation THEN
            NULL;
    END;
END;
$$;

ROLLBACK;
