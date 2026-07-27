BEGIN;

GRANT INSERT (
    closed_at,
    closed_by_account_id
)
ON school_years TO blaise_app;

COMMIT;