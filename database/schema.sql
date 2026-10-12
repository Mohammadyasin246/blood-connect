-- ============================================================================
-- BloodConnect — Smart Blood Donor & Recipient Connection System
-- Database Schema (MySQL 8.0+ Compatible)
-- Designed for B.Tech CSE Full-Stack Project & Production Deployment
-- ============================================================================

DROP DATABASE IF EXISTS bloodconnect;
CREATE DATABASE bloodconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bloodconnect;

-- ----------------------------------------------------------------------------
-- 1. USERS TABLE
-- Core authentication and role-based access management
-- Roles: 'donor', 'recipient', 'admin', 'hospital'
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('donor', 'recipient', 'admin', 'hospital') NOT NULL DEFAULT 'donor',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_email (email),
    INDEX idx_user_role (role)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 2. DONORS TABLE
-- Extended donor medical profile, geo-coordinates, and availability
-- ----------------------------------------------------------------------------
CREATE TABLE donors (
    donor_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    gender ENUM('male', 'female', 'other') DEFAULT 'other',
    date_of_birth DATE,
    city VARCHAR(60) NOT NULL,
    area VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    last_donation_date DATE DEFAULT NULL,
    availability BOOLEAN DEFAULT TRUE,
    total_donations INT DEFAULT 0,
    is_verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_donors_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_donor_blood_group (blood_group),
    INDEX idx_donor_city (city),
    INDEX idx_donor_availability (availability),
    INDEX idx_donor_location (latitude, longitude)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 3. HOSPITALS TABLE
-- Registered blood banks and verified hospital emergency locations
-- ----------------------------------------------------------------------------
CREATE TABLE hospitals (
    hospital_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    city VARCHAR(60) NOT NULL,
    area VARCHAR(100) NOT NULL,
    address VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    emergency_contact VARCHAR(20),
    blood_bank_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_hospital_city (city)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 4. BLOOD_REQUESTS TABLE
-- Blood requests created by recipients or emergency staff
-- Urgency: 'normal', 'urgent', 'emergency'
-- Status: 'open', 'matched', 'in_progress', 'completed', 'cancelled'
-- ----------------------------------------------------------------------------
CREATE TABLE blood_requests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    requester_id INT NOT NULL,
    patient_name VARCHAR(100) NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    units_required INT NOT NULL DEFAULT 1,
    hospital VARCHAR(150) NOT NULL,
    city VARCHAR(60) NOT NULL,
    area VARCHAR(100),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    required_date DATE NOT NULL,
    urgency ENUM('normal', 'urgent', 'emergency') NOT NULL DEFAULT 'normal',
    status ENUM('open', 'matched', 'in_progress', 'completed', 'cancelled') NOT NULL DEFAULT 'open',
    additional_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_requests_user FOREIGN KEY (requester_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_request_blood (blood_group),
    INDEX idx_request_status (status),
    INDEX idx_request_urgency (urgency),
    INDEX idx_request_location (latitude, longitude)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 5. DONATIONS TABLE
-- Records completed blood donations, certificates, and audits
-- ----------------------------------------------------------------------------
CREATE TABLE donations (
    donation_id INT AUTO_INCREMENT PRIMARY KEY,
    donor_id INT NOT NULL,
    request_id INT NULL,
    hospital_name VARCHAR(150) NOT NULL,
    blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,
    units INT NOT NULL DEFAULT 1,
    donation_date DATE NOT NULL,
    status ENUM('scheduled', 'completed', 'verified', 'cancelled') NOT NULL DEFAULT 'completed',
    certificate_id VARCHAR(50) UNIQUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_donations_donor FOREIGN KEY (donor_id) REFERENCES donors(donor_id) ON DELETE CASCADE,
    CONSTRAINT fk_donations_request FOREIGN KEY (request_id) REFERENCES blood_requests(request_id) ON DELETE SET NULL,
    INDEX idx_donation_donor (donor_id),
    INDEX idx_donation_date (donation_date)
) ENGINE=InnoDB;

-- ----------------------------------------------------------------------------
-- 6. NOTIFICATIONS TABLE
-- Real-time alert dispatch to matching nearby donors
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    request_id INT NULL,
    title VARCHAR(120) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('request', 'acceptance', 'emergency', 'system') NOT NULL DEFAULT 'request',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_request FOREIGN KEY (request_id) REFERENCES blood_requests(request_id) ON DELETE CASCADE,
    INDEX idx_notif_user_read (user_id, is_read)
) ENGINE=InnoDB;

-- ============================================================================
-- USEFUL VIEWS FOR CSE DEMONSTRATION & VIVA
-- ============================================================================

-- View: Active Verified Donors with details
CREATE OR REPLACE VIEW view_active_donors AS
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
    DATEDIFF(CURRENT_DATE, IFNULL(d.last_donation_date, '2000-01-01')) AS days_since_last_donation,
    CASE 
        WHEN d.last_donation_date IS NULL OR DATEDIFF(CURRENT_DATE, d.last_donation_date) >= 90 
        THEN TRUE 
        ELSE FALSE 
    END AS is_medically_eligible
FROM donors d
JOIN users u ON d.user_id = u.user_id
WHERE u.is_active = TRUE AND d.is_verified = TRUE;

-- View: Blood Inventory Request Summary
CREATE OR REPLACE VIEW view_request_summary AS
SELECT 
    r.blood_group,
    r.urgency,
    COUNT(*) as total_requests,
    SUM(r.units_required) as total_units_needed
FROM blood_requests r
WHERE r.status = 'open'
GROUP BY r.blood_group, r.urgency;

-- ============================================================================
-- SAMPLE QUERIES FOR VIVA EXPLANATION:
-- 1. Haversine Distance Calculation query in SQL (spherical approximation):
--    SELECT donor_id, name, blood_group,
--    (6371 * acos(cos(radians(17.4938)) * cos(radians(latitude)) * cos(radians(longitude) - radians(78.3188)) + sin(radians(17.4938)) * sin(radians(latitude)))) AS distance_km
--    FROM view_active_donors
--    WHERE blood_group = 'O+' AND availability = 1
--    HAVING distance_km <= 10
--    ORDER BY distance_km ASC;
-- ============================================================================
