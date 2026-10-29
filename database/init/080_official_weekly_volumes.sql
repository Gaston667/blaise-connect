-- Volumes horaires hebdomadaires alignés sur le programme officiel français
-- (collège et lycée général), arrondis à l'heure pleine car le générateur
-- travaille par créneaux d'une heure. Script de données : il n'altère pas le
-- schéma et peut être rejoué sans effet de bord.
--
-- Les spécialités (is_specialty = true) ne sont pas modifiées : 4 h en
-- Première, 6 h en Terminale. Une matière absente de la liste officielle d'un
-- niveau n'est plus planifiée (sa ligne de volume est retirée) ; la matière
-- reste dans la classe, avec ses notes et ses bulletins.

BEGIN;

CREATE TEMP TABLE official_volumes (
    level_code text NOT NULL,
    subject_name text NOT NULL,
    weekly_minutes integer NOT NULL
) ON COMMIT DROP;

INSERT INTO official_volumes (level_code, subject_name, weekly_minutes) VALUES
    ('SIXIEME',   'Français', 240), ('SIXIEME',   'Mathématiques', 240),
    ('SIXIEME',   'Histoire-Géographie', 180), ('SIXIEME', 'Anglais', 240),
    ('SIXIEME',   'Éducation physique et sportive (EPS)', 240),
    ('SIXIEME',   'Sciences de la vie et de la Terre (SVT)', 120),
    ('SIXIEME',   'Physique-Chimie', 120), ('SIXIEME', 'Arts', 120),
    ('SIXIEME',   'Enseignement moral et civique (EMC)', 60),

    ('CINQUIEME', 'Français', 240), ('CINQUIEME', 'Mathématiques', 240),
    ('CINQUIEME', 'Histoire-Géographie', 180), ('CINQUIEME', 'Anglais', 180),
    ('CINQUIEME', 'Espagnol', 120),
    ('CINQUIEME', 'Éducation physique et sportive (EPS)', 180),
    ('CINQUIEME', 'Sciences de la vie et de la Terre (SVT)', 120),
    ('CINQUIEME', 'Physique-Chimie', 120), ('CINQUIEME', 'Arts', 120),
    ('CINQUIEME', 'Enseignement moral et civique (EMC)', 60),

    ('QUATRIEME', 'Français', 240), ('QUATRIEME', 'Mathématiques', 240),
    ('QUATRIEME', 'Histoire-Géographie', 180), ('QUATRIEME', 'Anglais', 180),
    ('QUATRIEME', 'Espagnol', 120),
    ('QUATRIEME', 'Éducation physique et sportive (EPS)', 180),
    ('QUATRIEME', 'Sciences de la vie et de la Terre (SVT)', 120),
    ('QUATRIEME', 'Physique-Chimie', 120), ('QUATRIEME', 'Arts', 120),
    ('QUATRIEME', 'Enseignement moral et civique (EMC)', 60),

    ('TROISIEME', 'Français', 240), ('TROISIEME', 'Mathématiques', 240),
    ('TROISIEME', 'Histoire-Géographie', 180), ('TROISIEME', 'Anglais', 180),
    ('TROISIEME', 'Espagnol', 120),
    ('TROISIEME', 'Éducation physique et sportive (EPS)', 180),
    ('TROISIEME', 'Sciences de la vie et de la Terre (SVT)', 120),
    ('TROISIEME', 'Physique-Chimie', 120), ('TROISIEME', 'Arts', 120),
    ('TROISIEME', 'Enseignement moral et civique (EMC)', 60),

    ('SECONDE',   'Français', 240), ('SECONDE',   'Mathématiques', 240),
    ('SECONDE',   'Histoire-Géographie', 180), ('SECONDE', 'Anglais', 180),
    ('SECONDE',   'Espagnol', 120), ('SECONDE',   'Physique-Chimie', 180),
    ('SECONDE',   'Sciences de la vie et de la Terre (SVT)', 120),
    ('SECONDE',   'Éducation physique et sportive (EPS)', 120),
    ('SECONDE',   'Enseignement moral et civique (EMC)', 60),
    ('SECONDE',   'Sciences numériques et technologie (SNT)', 120),

    ('PREMIERE',  'Français', 240), ('PREMIERE',  'Histoire-Géographie', 180),
    ('PREMIERE',  'Anglais', 120), ('PREMIERE',  'Espagnol', 120),
    ('PREMIERE',  'Éducation physique et sportive (EPS)', 120),
    ('PREMIERE',  'Enseignement scientifique', 120),
    ('PREMIERE',  'Enseignement moral et civique (EMC)', 60),

    ('TERMINALE', 'Philosophie', 240), ('TERMINALE', 'Histoire-Géographie', 180),
    ('TERMINALE', 'Anglais', 120), ('TERMINALE', 'Espagnol', 120),
    ('TERMINALE', 'Éducation physique et sportive (EPS)', 120),
    ('TERMINALE', 'Enseignement scientifique', 120),
    ('TERMINALE', 'Enseignement moral et civique (EMC)', 60);

-- Mise à jour des volumes officiels pour les matières déjà présentes.
UPDATE level_subject_requirements AS requirement
SET weekly_minutes = official.weekly_minutes
FROM official_volumes AS official
JOIN class_levels AS class_level ON class_level.code::text = official.level_code
JOIN subjects AS subject ON subject.name = official.subject_name
WHERE requirement.class_level_id = class_level.id
  AND requirement.subject_id = subject.id
  AND requirement.weekly_minutes IS DISTINCT FROM official.weekly_minutes;

-- Retrait du planning des matières hors programme (hors spécialités).
DELETE FROM level_subject_requirements AS requirement
USING class_levels AS class_level, subjects AS subject
WHERE class_level.id = requirement.class_level_id
  AND subject.id = requirement.subject_id
  AND class_level.code::text IN ('SIXIEME', 'CINQUIEME', 'QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE')
  AND subject.is_specialty = false
  AND NOT EXISTS (
      SELECT 1 FROM official_volumes AS official
      WHERE official.level_code = class_level.code::text
        AND official.subject_name = subject.name
  );

COMMIT;
