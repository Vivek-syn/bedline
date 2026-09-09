-- ============================================================
-- MIGRATION: role-management upgrade
-- Run this ONLY if you already have a database from before this
-- feature (i.e. you don't want to drop and re-run schema.sql
-- from scratch, which would wipe your data).
--
--   psql -U postgres -d hospital_db -f backend/src/db/migrate_role_management.sql
--
-- If you're setting the database up for the FIRST time, ignore
-- this file — schema.sql already includes all of this.
-- ============================================================

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS dues_cleared BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE admissions
  ADD COLUMN IF NOT EXISTS assigned_by_role VARCHAR(20) NOT NULL DEFAULT 'doctor';

-- Add the CHECK constraint separately (ADD COLUMN can't inline
-- a CHECK with IF NOT EXISTS in older Postgres versions safely).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'admissions' AND column_name = 'assigned_by_role'
  ) THEN
    ALTER TABLE admissions
      ADD CONSTRAINT admissions_assigned_by_role_check
      CHECK (assigned_by_role IN ('doctor','nurse','admin'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS medical_records (
    id         SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id  INTEGER REFERENCES users(id),
    content    TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS remarks (
    id         SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id  INTEGER REFERENCES users(id),
    remark     TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
