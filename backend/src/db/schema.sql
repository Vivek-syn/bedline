-- ============================================================
-- Hospital Bed Management System — PostgreSQL Schema
-- Run this once against your database to create all tables.
--   psql -U postgres -d hospital_db -f schema.sql
-- ============================================================

-- Clean slate (safe to re-run while developing)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS admissions CASCADE;
DROP TABLE IF EXISTS beds CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS wards CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ------------------------------------------------------------
-- USERS: every person who can log in — staff AND patients.
-- The "role" column is how we decide what they're allowed to do.
-- ------------------------------------------------------------
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(160) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','doctor','nurse','receptionist','patient')),
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- PATIENTS: extra medical/admin info, linked 1-to-1 with a
-- "patient" user account. Not every patient needs a login,
-- but in this system every patient DOES get one so they can
-- check their own status.
-- ------------------------------------------------------------
CREATE TABLE patients (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name              VARCHAR(120) NOT NULL,
    age               INTEGER,
    gender            VARCHAR(20),
    contact           VARCHAR(30),
    admission_status  VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (admission_status IN ('pending','admitted','discharged')),
    assigned_doctor_id INTEGER REFERENCES users(id),
    -- Billing gate: reception must flip this to TRUE before a doctor
    -- or nurse is allowed to discharge the patient. Admin bypasses it.
    dues_cleared      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- WARDS -> ROOMS -> BEDS: the physical hierarchy of the hospital.
-- ------------------------------------------------------------
CREATE TABLE wards (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(80) NOT NULL,
    floor INTEGER,
    type  VARCHAR(40) -- e.g. ICU, General, Private, Maternity
);

CREATE TABLE rooms (
    id          SERIAL PRIMARY KEY,
    ward_id     INTEGER REFERENCES wards(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    capacity    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE beds (
    id         SERIAL PRIMARY KEY,
    room_id    INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    bed_number VARCHAR(20) NOT NULL,
    status     VARCHAR(20) NOT NULL DEFAULT 'vacant'
                 CHECK (status IN ('vacant','occupied','reserved','maintenance'))
);

-- ------------------------------------------------------------
-- ADMISSIONS: the record that ties a patient to a bed for a
-- period of time. This is the "who is where" table.
-- ------------------------------------------------------------
CREATE TABLE admissions (
    id            SERIAL PRIMARY KEY,
    patient_id    INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    bed_id        INTEGER REFERENCES beds(id),
    doctor_id     INTEGER REFERENCES users(id),
    admitted_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    discharged_at TIMESTAMP,
    status        VARCHAR(20) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','discharged')),
    -- Who MADE this assignment: 'doctor' | 'nurse' | 'admin'.
    -- This is the whole basis of the "nurse can't supersede a
    -- doctor's decision" rule — a nurse is blocked from de-assigning
    -- or changing a bed whose active admission was assigned_by_role
    -- 'doctor' or 'admin'.
    assigned_by_role VARCHAR(20) NOT NULL DEFAULT 'doctor'
                    CHECK (assigned_by_role IN ('doctor','nurse','admin'))
);

-- ------------------------------------------------------------
-- MEDICAL RECORDS: the clinical record for a patient. Only a
-- doctor (or admin) can ADD an entry — typically done at
-- admission time. Doctors, nurses, and admin can all READ them.
-- ------------------------------------------------------------
CREATE TABLE medical_records (
    id         SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id  INTEGER REFERENCES users(id),
    content    TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- REMARKS: shorter, more frequent notes a doctor leaves on a
-- patient's chart (e.g. "responding well to antibiotics").
-- Kept as its own table (rather than a single column) so a
-- history of remarks over time is preserved.
-- ------------------------------------------------------------
CREATE TABLE remarks (
    id         SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id  INTEGER REFERENCES users(id),
    remark     TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- AUDIT LOGS: who did what, and when. Good practice for any
-- healthcare system, and useful for debugging while you build.
-- ------------------------------------------------------------
CREATE TABLE audit_logs (
    id        SERIAL PRIMARY KEY,
    user_id   INTEGER REFERENCES users(id),
    action    VARCHAR(80) NOT NULL,
    entity    VARCHAR(40),
    entity_id INTEGER,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- SEED DATA — a small starter dataset so you have something
-- to log in with and click around immediately.
-- Password for every seeded user is:  password123
-- (hash generated with bcrypt, 10 rounds)
-- ------------------------------------------------------------
INSERT INTO users (name, email, password_hash, role) VALUES
('Ava Admin',     'admin@hospital.com',     '$2b$10$.l1OIe..BY0.z84wTP.xzOuQkmjM9PEAiBxOWmyhlAM7anLR.0vwW', 'admin'),
('Dr. Ray Chen',  'doctor@hospital.com',    '$2b$10$.l1OIe..BY0.z84wTP.xzOuQkmjM9PEAiBxOWmyhlAM7anLR.0vwW', 'doctor'),
('Nina Nurse',    'nurse@hospital.com',     '$2b$10$.l1OIe..BY0.z84wTP.xzOuQkmjM9PEAiBxOWmyhlAM7anLR.0vwW', 'nurse'),
('Rita Reception','reception@hospital.com', '$2b$10$.l1OIe..BY0.z84wTP.xzOuQkmjM9PEAiBxOWmyhlAM7anLR.0vwW', 'receptionist'),
('John Patient',  'patient@hospital.com',   '$2b$10$.l1OIe..BY0.z84wTP.xzOuQkmjM9PEAiBxOWmyhlAM7anLR.0vwW', 'patient');

INSERT INTO patients (user_id, name, age, gender, contact, admission_status) VALUES
(5, 'John Patient', 34, 'Male', '9999999999', 'pending');

INSERT INTO wards (name, floor, type) VALUES
('General Ward A', 1, 'General'),
('ICU', 2, 'ICU'),
('Maternity Ward', 3, 'Maternity');

INSERT INTO rooms (ward_id, room_number, capacity) VALUES
(1, '101', 2), (1, '102', 2), (2, '201', 1), (2, '202', 1), (3, '301', 2);

INSERT INTO beds (room_id, bed_number, status) VALUES
(1, '101-A', 'vacant'), (1, '101-B', 'vacant'),
(2, '102-A', 'vacant'), (2, '102-B', 'vacant'),
(3, '201-A', 'vacant'),
(4, '202-A', 'vacant'),
(5, '301-A', 'vacant'), (5, '301-B', 'vacant');
