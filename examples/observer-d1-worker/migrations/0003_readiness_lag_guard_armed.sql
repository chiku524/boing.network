-- Persist when the readiness lag guard is allowed to enforce BOING_READINESS_MAX_LAG_FINALIZED
-- (set to 1 after scheduled ingest observes lag <= arm threshold — see persist-d1 / readiness.ts).
ALTER TABLE ingest_cursor ADD COLUMN readiness_lag_guard_armed INTEGER NOT NULL DEFAULT 0;
