-- Migration 013 : vacances scolaires.
--
-- Objectif : permettre à l'administrateur de saisir, pour chaque année scolaire,
--            les périodes de vacances (Toussaint, Noël, hiver, printemps, été...).
--            Les dates sont saisies par l'école : en Guinée, le calendrier du
--            système français est décalé d'environ une semaine, il ne peut donc
--            pas être codé en dur.
-- Nature   : additive (nouvelle table, aucune donnée existante modifiée).
-- Impact   : aucun sur les données existantes. Verrou court (création de table).
-- Règles   : une vacance a une date de fin >= début ; elle reste dans l'année
--            scolaire ; deux vacances d'une même année ne se chevauchent pas ;
--            les vacances d'une année clôturée ne se modifient plus.
BEGIN;

CREATE TABLE school_holidays (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    school_year_id uuid NOT NULL,
    name varchar(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_school_holidays PRIMARY KEY (id),
    -- détail sans sens sans son année : supprimé avec elle (suppression d'année ouverte)
    CONSTRAINT fk_school_holidays_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_years (id) ON DELETE CASCADE,
    CONSTRAINT ck_school_holidays_name_not_blank CHECK (btrim(name) <> ''),
    CONSTRAINT ck_school_holidays_dates CHECK (end_date >= start_date),
    CONSTRAINT ex_school_holidays_no_overlap EXCLUDE USING gist (
        school_year_id WITH =,
        daterange(start_date, end_date, '[]') WITH &&
    )
);

CREATE INDEX idx_school_holidays_school_year_id ON school_holidays (school_year_id);

-- Règle inter-tables : dates incluses dans l'année scolaire, année non clôturée.
CREATE FUNCTION check_school_holiday_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_year school_years%ROWTYPE;
    v_year_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_year_id := OLD.school_year_id;
    ELSE
        v_year_id := NEW.school_year_id;
    END IF;

    SELECT * INTO v_year FROM school_years WHERE id = v_year_id;
    IF NOT FOUND THEN
        -- suppression en cascade de l'année elle-même
        RETURN COALESCE(OLD, NEW);
    END IF;

    IF v_year.closed_at IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Les vacances d''une année clôturée ne peuvent plus être modifiées.';
    END IF;

    IF TG_OP <> 'DELETE'
       AND (NEW.start_date < v_year.start_date OR NEW.end_date > v_year.end_date) THEN
        RAISE EXCEPTION USING ERRCODE = '23514',
            MESSAGE = 'Les vacances doivent rester dans les dates de l''année scolaire.';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_school_holidays_check_rules
BEFORE INSERT OR UPDATE OR DELETE ON school_holidays
FOR EACH ROW
EXECUTE FUNCTION check_school_holiday_rules();

CREATE TRIGGER trg_school_holidays_set_updated_at
BEFORE UPDATE ON school_holidays
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

GRANT SELECT, DELETE ON school_holidays TO blaise_app;
GRANT INSERT (school_year_id, name, start_date, end_date) ON school_holidays TO blaise_app;
GRANT UPDATE (name, start_date, end_date) ON school_holidays TO blaise_app;

COMMIT;
