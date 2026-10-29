-- Migration additive : durée type d'une séance par matière.
--
-- session_periods = nombre de périodes consécutives d'une séance :
--   1 = séance d'une période (langues vivantes, EMC...) ;
--   2 = bloc de deux périodes (par défaut, ex. Mathématiques, Français).
-- Remplace la liste de noms de matières qui était fixée dans le générateur
-- d'emploi du temps. Aucune donnée existante n'est supprimée.
BEGIN;

ALTER TABLE subjects
    ADD COLUMN session_periods smallint NOT NULL DEFAULT 2;

ALTER TABLE subjects
    ADD CONSTRAINT ck_subjects_session_periods
    CHECK (session_periods BETWEEN 1 AND 4);

UPDATE subjects
SET session_periods = 1
WHERE name IN (
    'Anglais', 'Espagnol', 'Allemand', 'Arts', 'Enseignement moral et civique (EMC)', 'EMC'
);

COMMIT;
