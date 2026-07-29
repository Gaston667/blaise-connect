-- =========================================================
-- 008 - MATIERES ET ASSOCIATIONS MATIERE / CLASSE
-- =========================================================
-- Objectif :
--   1. créer les matières de test manquantes ;
--   2. associer toutes les matières aux classes de l'année 2026-2027 ;
--   3. attribuer un coefficient à chaque matière.
--
-- Script idempotent : il peut être exécuté plusieurs fois sans doublon.

BEGIN;

-- 1. Création des matières de test.
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

-- 2. Association de chaque matière à chaque classe de l'année 2026-2027.
-- Les coefficients sont définis selon la matière.
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
JOIN school_years
    ON school_years.id = classes.school_year_id
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

COMMIT;

-- Vérifications recommandées après exécution :
-- SELECT * FROM subjects ORDER BY name;
--
-- SELECT
--     class_levels.name AS niveau,
--     classes.group_label AS groupe,
--     subjects.name AS matiere,
--     class_subjects.coefficient
-- FROM class_subjects
-- JOIN classes ON classes.id = class_subjects.class_id
-- JOIN class_levels ON class_levels.id = classes.class_level_id
-- JOIN subjects ON subjects.id = class_subjects.subject_id
-- JOIN school_years ON school_years.id = classes.school_year_id
-- WHERE school_years.name = '2026-2027'
-- ORDER BY class_levels.display_order, classes.group_label, subjects.name;
