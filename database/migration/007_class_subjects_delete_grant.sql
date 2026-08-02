-- =========================================================
-- MIGRATION 007 : autorise le retrait d'une matière de classe
-- =========================================================
-- class_subjects n'a ni colonne d'archivage (is_active) ni fin de
-- validité (end_date), contrairement aux autres tables de la liste
-- REVOKE DELETE de la migration 004. Le retrait d'une matière d'une
-- classe (fonctionnalité déjà présente côté application) n'a donc pas
-- d'autre mécanisme possible que la suppression de la ligne.
-- La table reste protégée par son trigger d'immuabilité d'année
-- clôturée (protect_closed_class_subject) et, plus tard, par les
-- futures tables assessments/grades référençant class_subjects en
-- ON DELETE RESTRICT.
-- =========================================================

BEGIN;

GRANT DELETE ON TABLE class_subjects TO blaise_app;

COMMIT;
