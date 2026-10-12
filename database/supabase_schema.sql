-- ============================================================================
-- BloodConnect — Smart Blood Donor & Recipient Connection System
-- Supabase PostgreSQL Schema, Security Policies, Functions & Seed Data
-- Designed for Supabase (https://supabase.com) PostgreSQL Database
-- ============================================================================

-- Enable Required PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. DROP EXISTING OBJECTS (Clean Setup if re-running)
-- ============================================================================
DROP VIEW IF EXISTS public.view_request_summary;
DROP VIEW IF EXISTS public.view_active_donors;

DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.donations CASCADE;
DROP TABLE IF EXISTS public.blood_requests CASCADE;
DROP TABLE IF EXISTS public.hospitals CASCADE;
DROP TABLE IF EXISTS public.donors CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================================
-- 2. USERS TABLE
-- Authentication & role-based profiles (donor, recipient, admin, hospital)
-- ============================================================================
CREATE TABLE public.users (
    user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(25) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'donor' CHECK (role IN ('donor', 'recipient', 'admin', 'hospital')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_phone ON public.users(phone);
CREATE INDEX idx_users_role ON public.users(role);

-- ============================================================================
-- 3. DONORS TABLE
-- Medical donor profile, geo-coordinates, availability, and verification
-- ============================================================================
CREATE TABLE public.donors (
    donor_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES public.users(user_id) ON DELETE CASCADE,
    blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    gender VARCHAR(10) DEFAULT 'other' CHECK (gender IN ('male', 'female', 'other')),
    date_of_birth DATE,
    city VARCHAR(60) NOT NULL,
    area VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    last_donation_date DATE DEFAULT NULL,
    availability BOOLEAN NOT NULL DEFAULT TRUE,
    total_donations INT NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_donors_blood_group ON public.donors(blood_group);
CREATE INDEX idx_donors_city ON public.donors(city);
CREATE INDEX idx_donors_availability ON public.donors(availability);
CREATE INDEX idx_donors_location ON public.donors(latitude, longitude);

-- ============================================================================
-- 4. HOSPITALS TABLE
-- Blood banks and hospitals with emergency contacts and coordinates
-- ============================================================================
CREATE TABLE public.hospitals (
    hospital_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(60) NOT NULL,
    area VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    phone VARCHAR(25) NOT NULL,
    emergency_contact VARCHAR(25),
    blood_bank_available BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_hospitals_city ON public.hospitals(city);

-- ============================================================================
-- 5. BLOOD_REQUESTS TABLE
-- Blood requests created by recipients or hospital staff
-- ============================================================================
CREATE TABLE public.blood_requests (
    request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    requester_id BIGINT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    patient_name VARCHAR(100) NOT NULL,
    blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    units_required INT NOT NULL DEFAULT 1,
    hospital VARCHAR(150) NOT NULL,
    city VARCHAR(60) NOT NULL,
    area VARCHAR(100),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    required_date DATE NOT NULL,
    urgency VARCHAR(15) NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent', 'emergency')),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'in_progress', 'completed', 'cancelled')),
    additional_notes TEXT,
    accepted_by_donor_id BIGINT REFERENCES public.donors(donor_id) ON DELETE SET NULL,
    target_donor_id BIGINT REFERENCES public.donors(donor_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_requests_blood ON public.blood_requests(blood_group);
CREATE INDEX idx_requests_status ON public.blood_requests(status);
CREATE INDEX idx_requests_urgency ON public.blood_requests(urgency);
CREATE INDEX idx_requests_location ON public.blood_requests(latitude, longitude);
CREATE INDEX idx_requests_target ON public.blood_requests(target_donor_id);

-- ============================================================================
-- 6. DONATIONS TABLE
-- Verified blood donations history and official certificates
-- ============================================================================
CREATE TABLE public.donations (
    donation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    donor_id BIGINT NOT NULL REFERENCES public.donors(donor_id) ON DELETE CASCADE,
    request_id BIGINT REFERENCES public.blood_requests(request_id) ON DELETE SET NULL,
    hospital_name VARCHAR(150) NOT NULL,
    blood_group VARCHAR(5) NOT NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
    units INT NOT NULL DEFAULT 1,
    donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('scheduled', 'completed', 'verified', 'cancelled')),
    certificate_id VARCHAR(50) UNIQUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_donations_donor ON public.donations(donor_id);
CREATE INDEX idx_donations_cert ON public.donations(certificate_id);

-- ============================================================================
-- 7. NOTIFICATIONS TABLE
-- Real-time alerts sent to matching donors or requesters
-- ============================================================================
CREATE TABLE public.notifications (
    notification_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    request_id BIGINT REFERENCES public.blood_requests(request_id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'request' CHECK (type IN ('request', 'acceptance', 'emergency', 'system')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, is_read);

-- ============================================================================
-- 8. HAVERSINE DISTANCE FUNCTION (PostgreSQL Function)
-- Calculates Great-Circle distance in kilometers between two geo-coordinates
-- ============================================================================
CREATE OR REPLACE FUNCTION public.haversine_distance(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
    r DOUBLE PRECISION := 6371.0; -- Mean Earth Radius in KM
    dlat DOUBLE PRECISION;
    dlon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    IF lat1 IS NULL OR lon1 IS NULL OR lat2 IS NULL OR lon2 IS NULL THEN
        RETURN 0.0;
    END IF;

    dlat := radians(lat2 - lat1);
    dlon := radians(lon2 - lon1);

    a := sin(dlat / 2.0)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2.0)^2;
    c := 2.0 * asin(sqrt(a));

    RETURN round((r * c)::numeric, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 9. USEFUL VIEWS
-- ============================================================================
CREATE OR REPLACE VIEW public.view_active_donors AS
SELECT 
    d.donor_id,
    u.user_id,
    u.name,
    u.email,
    u.phone,
    d.blood_group,
    d.gender,
    d.city,
    d.area,
    d.latitude,
    d.longitude,
    d.last_donation_date,
    d.availability,
    d.total_donations,
    (CURRENT_DATE - COALESCE(d.last_donation_date, DATE '2000-01-01')) AS days_since_last_donation,
    CASE 
        WHEN d.last_donation_date IS NULL OR (CURRENT_DATE - d.last_donation_date) >= 90 
        THEN TRUE 
        ELSE FALSE 
    END AS is_medically_eligible
FROM public.donors d
JOIN public.users u ON d.user_id = u.user_id
WHERE u.is_active = TRUE AND d.is_verified = TRUE;

CREATE OR REPLACE VIEW public.view_request_summary AS
SELECT 
    r.blood_group,
    r.urgency,
    COUNT(*) as total_requests,
    SUM(r.units_required) as total_units_needed
FROM public.blood_requests r
WHERE r.status = 'open'
GROUP BY r.blood_group, r.urgency;

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- Configure public access for API client and service role
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow full access to service_role (used by BloodConnect Node.js Backend API)
CREATE POLICY "Service Role Full Access Users" ON public.users FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Donors" ON public.donors FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Hospitals" ON public.hospitals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Requests" ON public.blood_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Donations" ON public.donations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service Role Full Access Notifications" ON public.notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow public read access where needed for frontend & mobile clients
CREATE POLICY "Public Read Active Donors" ON public.donors FOR SELECT TO anon, authenticated USING (is_verified = true);
CREATE POLICY "Public Read Hospitals" ON public.hospitals FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Read Blood Requests" ON public.blood_requests FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Read Users Basic" ON public.users FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Public Read Donations" ON public.donations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public Read Notifications" ON public.notifications FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Enable Realtime on requests and notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blood_requests;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;

-- ============================================================================
-- 11. INITIAL SEED DATA (Demo Personas & Realistic Hyderabad Coordinates)
-- Pre-hashed passwords for instant login testing
-- ============================================================================

-- Insert Users:
-- Passwords:
-- 'admin123'     -> $2a$10$wK6O8c5sU.zJ6d4NnK64Ceo0Ue7a8o6n9i3yF4v9xP1u8k5e2wQ8m
-- 'hospital123'  -> $2a$10$k1w1wXgC4wZq2M3l6.40OuyvNlJ8lB8F8g1A5m3o2m7f8i1r5r9rS
-- 'recipient123' -> $2a$10$z5gq8t0l1t5i4v2j9.51Pe.t6c8y5e2p7f1b9n8a2l4p9v6x1u4yM
-- 'donor123'     -> $2a$10$e7m4e2w1u8s5d9k2.62Qf.x1n7b4r9t2w8i5o1p4k8m2l7c5x8z1A
-- Note: The exact hashes generated by bcrypt for 'admin123', 'donor123', etc.
-- ============================================================================

INSERT INTO public.users (name, email, phone, password_hash, role) VALUES
('Dr. Arvind Verma', 'admin@bloodconnect.org', '+91 94400 12345', '$2b$10$Sm/fXpsL9LB3KHCn8gEtXux1e.iLJIoZEw8aAfd2kd0iPCru3vP6S', 'admin'),
('Apollo Hospitals Blood Bank', 'apollo@bloodconnect.org', '+91 40 2360 7777', '$2b$10$jyOQcFBTNDa5RI.QcOaH7uJlcUzeUgqH.UXO/BREq4BPU7kE/j312', 'hospital'),
('Priya Patel', 'priya@gmail.com', '+91 98765 43210', '$2b$10$kgmQEOE5gXTE8u8TZg.HnOxaAssYXWYTISyZ8TBEuymzDHSBIS.1C', 'recipient'),
('Arjun Nair', 'arjun@gmail.com', '+91 98765 43211', '$2b$10$kgmQEOE5gXTE8u8TZg.HnOxaAssYXWYTISyZ8TBEuymzDHSBIS.1C', 'recipient'),
('Deepa Sharma', 'deepa@gmail.com', '+91 98765 43212', '$2b$10$kgmQEOE5gXTE8u8TZg.HnOxaAssYXWYTISyZ8TBEuymzDHSBIS.1C', 'recipient'),
('Rahul Sharma', 'rahul@gmail.com', '+91 91234 56780', '$2b$10$dVztAX8jnvzI5TGqt2iJgu9vFczN2Q76pIPLifNtmEuKwrMzUH5uC', 'donor'),
('Ramesh Kumar', 'ramesh@gmail.com', '+91 91234 56781', '$2b$10$dVztAX8jnvzI5TGqt2iJgu9vFczN2Q76pIPLifNtmEuKwrMzUH5uC', 'donor'),
('Suresh Reddy', 'suresh@gmail.com', '+91 91234 56782', '$2b$10$dVztAX8jnvzI5TGqt2iJgu9vFczN2Q76pIPLifNtmEuKwrMzUH5uC', 'donor'),
('Ananya Iyer', 'ananya@gmail.com', '+91 91234 56783', '$2b$10$dVztAX8jnvzI5TGqt2iJgu9vFczN2Q76pIPLifNtmEuKwrMzUH5uC', 'donor'),
('Vikram Malhotra', 'vikram@gmail.com', '+91 91234 56784', '$2b$10$dVztAX8jnvzI5TGqt2iJgu9vFczN2Q76pIPLifNtmEuKwrMzUH5uC', 'donor'),
('Sneha Rao', 'sneha@gmail.com', '+91 91234 56785', '$2b$10$dVztAX8jnvzI5TGqt2iJgu9vFczN2Q76pIPLifNtmEuKwrMzUH5uC', 'donor');

-- Insert Donors (linked to user_ids 6 through 11)
INSERT INTO public.donors (user_id, blood_group, gender, date_of_birth, city, area, latitude, longitude, last_donation_date, availability, total_donations, is_verified) VALUES
(6, 'O+', 'male', '1998-04-12', 'Hyderabad', 'Lingampally', 17.4938, 78.3188, '2026-05-15', true, 5, true),
(7, 'O+', 'male', '1996-08-20', 'Hyderabad', 'Chandanagar', 17.4900, 78.3300, '2026-04-10', true, 3, true),
(8, 'O+', 'male', '1995-11-05', 'Hyderabad', 'Miyapur', 17.4965, 78.3614, '2026-03-22', true, 4, true),
(9, 'A+', 'female', '2000-02-14', 'Hyderabad', 'Gachibowli', 17.4401, 78.3489, '2026-06-01', true, 2, true),
(10, 'B+', 'male', '1994-09-18', 'Hyderabad', 'Hitec City', 17.4474, 78.3762, '2026-01-10', true, 6, true),
(11, 'AB+', 'female', '1999-07-25', 'Hyderabad', 'Kondapur', 17.4699, 78.3578, '2026-05-20', true, 1, true);

-- Insert Hospitals
INSERT INTO public.hospitals (name, city, area, address, latitude, longitude, phone, emergency_contact, blood_bank_available) VALUES
('Apollo Hospitals', 'Hyderabad', 'Jubilee Hills', 'Road No 72, Film Nagar, Jubilee Hills', 17.4265, 78.4124, '+91 40 2360 7777', '1066', true),
('Care Hospitals', 'Hyderabad', 'Gachibowli', 'Old Mumbai Hwy, Jayabheri Pine Valley', 17.4399, 78.3609, '+91 40 6165 6565', '105711', true),
('Citizens Specialty Hospital', 'Hyderabad', 'Nallagandla', 'Near Lingampally Railway Station, Nallagandla', 17.4721, 78.3075, '+91 40 6719 1919', '+91 40 6719 9999', true),
('Continental Hospitals', 'Hyderabad', 'Financial District', 'Plot No 3, Road No 2, IT Park, Nanakramguda', 17.4206, 78.3428, '+91 40 6700 0000', '040-67000111', true),
('KIMS Hospitals', 'Hyderabad', 'Kondapur', 'Beside RTO Office, Kondapur Main Rd', 17.4632, 78.3618, '+91 40 4488 5000', '040-44885111', true);

-- Insert Blood Requests
INSERT INTO public.blood_requests (requester_id, patient_name, blood_group, units_required, hospital, city, area, latitude, longitude, required_date, urgency, status, additional_notes, accepted_by_donor_id) VALUES
(3, 'Rajesh Patel', 'O+', 2, 'Citizens Hospital, Nallagandla', 'Hyderabad', 'Lingampally', 17.4721, 78.3075, CURRENT_DATE + INTERVAL '1 day', 'emergency', 'open', 'Emergency cardiac procedure scheduled tomorrow morning.', NULL),
(4, 'Sunita Nair', 'A+', 1, 'Care Hospitals, Gachibowli', 'Hyderabad', 'Gachibowli', 17.4399, 78.3609, CURRENT_DATE + INTERVAL '2 days', 'urgent', 'open', 'Dengue recovery platelet support required.', NULL),
(5, 'Mohan Sharma', 'B+', 3, 'Apollo Hospitals, Jubilee Hills', 'Hyderabad', 'Jubilee Hills', 17.4265, 78.4124, CURRENT_DATE + INTERVAL '3 days', 'normal', 'open', 'Planned orthopaedic hip replacement.', NULL);

-- Insert Completed Donations
INSERT INTO public.donations (donor_id, request_id, hospital_name, blood_group, units, donation_date, status, certificate_id, notes) VALUES
(1, NULL, 'Citizens Hospital, Nallagandla', 'O+', 1, CURRENT_DATE - INTERVAL '140 days', 'completed', 'BC-CERT-2026-9481', 'Voluntary replacement donation'),
(1, NULL, 'Apollo Hospitals', 'O+', 1, CURRENT_DATE - INTERVAL '290 days', 'completed', 'BC-CERT-2025-1029', 'Camp voluntary drive donation'),
(2, NULL, 'Care Hospitals, Gachibowli', 'O+', 1, CURRENT_DATE - INTERVAL '180 days', 'completed', 'BC-CERT-2025-8832', 'Emergency trauma assistance');

-- Insert Initial Notifications
INSERT INTO public.notifications (user_id, request_id, title, message, type, is_read) VALUES
(6, 1, '🚨 EMERGENCY Blood Needed Nearby (O+)', 'Rajesh Patel requires 2 units of O+ blood at Citizens Hospital, Nallagandla (2.4 km away).', 'emergency', false),
(7, 1, '🚨 EMERGENCY Blood Needed Nearby (O+)', 'Rajesh Patel requires 2 units of O+ blood at Citizens Hospital, Nallagandla (3.1 km away).', 'emergency', false),
(9, 2, '⚠️ URGENT Blood Needed Nearby (A+)', 'Sunita Nair requires 1 unit of A+ blood at Care Hospitals, Gachibowli.', 'request', false);
