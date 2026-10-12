const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// Database path
const dbDir = path.resolve(__dirname, '../../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'bloodconnect.db');

// Initialize SQLite connection
const db = new Database(dbPath, {
  // verbose: process.env.NODE_ENV === 'development' ? console.log : null
});

// Enable Foreign Keys & WAL mode for performance and reliability
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize Tables
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      user_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT CHECK(role IN ('donor', 'recipient', 'admin', 'hospital')) NOT NULL DEFAULT 'donor',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS donors (
      donor_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      blood_group TEXT CHECK(blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')) NOT NULL,
      gender TEXT DEFAULT 'other',
      date_of_birth TEXT,
      city TEXT NOT NULL,
      area TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      last_donation_date TEXT,
      availability INTEGER DEFAULT 1,
      total_donations INTEGER DEFAULT 0,
      is_verified INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS hospitals (
      hospital_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      area TEXT NOT NULL,
      address TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      phone TEXT NOT NULL,
      emergency_contact TEXT,
      blood_bank_available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS blood_requests (
      request_id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL,
      patient_name TEXT NOT NULL,
      blood_group TEXT CHECK(blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')) NOT NULL,
      units_required INTEGER NOT NULL DEFAULT 1,
      hospital TEXT NOT NULL,
      city TEXT NOT NULL,
      area TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      required_date TEXT NOT NULL,
      urgency TEXT CHECK(urgency IN ('normal', 'urgent', 'emergency')) NOT NULL DEFAULT 'normal',
      status TEXT CHECK(status IN ('open', 'matched', 'in_progress', 'completed', 'cancelled')) NOT NULL DEFAULT 'open',
      additional_notes TEXT,
      accepted_by_donor_id INTEGER,
      target_donor_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (requester_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (accepted_by_donor_id) REFERENCES donors(donor_id) ON DELETE SET NULL,
      FOREIGN KEY (target_donor_id) REFERENCES donors(donor_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS donations (
      donation_id INTEGER PRIMARY KEY AUTOINCREMENT,
      donor_id INTEGER NOT NULL,
      request_id INTEGER,
      hospital_name TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      units INTEGER NOT NULL DEFAULT 1,
      donation_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('scheduled', 'completed', 'verified', 'cancelled')) NOT NULL DEFAULT 'completed',
      certificate_id TEXT UNIQUE,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (donor_id) REFERENCES donors(donor_id) ON DELETE CASCADE,
      FOREIGN KEY (request_id) REFERENCES blood_requests(request_id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      request_id INTEGER,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT CHECK(type IN ('request', 'acceptance', 'emergency', 'system')) NOT NULL DEFAULT 'request',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      FOREIGN KEY (request_id) REFERENCES blood_requests(request_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_donors_bg ON donors(blood_group);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON blood_requests(status);
    CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
  `);

  // Migration: ensure target_donor_id column exists if table was created previously
  try {
    db.exec('ALTER TABLE blood_requests ADD COLUMN target_donor_id INTEGER REFERENCES donors(donor_id) ON DELETE SET NULL');
  } catch (_) {
    // Column already exists
  }

  seedInitialData();
}

// Seed initial rich data if empty
function seedInitialData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return; // Already seeded

  console.log('Seeding initial realistic data for BloodConnect...');

  const salt = bcrypt.genSaltSync(10);
  const hashPass = (p) => bcrypt.hashSync(p, salt);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertDonor = db.prepare(`
    INSERT INTO donors (user_id, blood_group, gender, date_of_birth, city, area, latitude, longitude, last_donation_date, availability, total_donations, is_verified)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertHospital = db.prepare(`
    INSERT INTO hospitals (name, city, area, address, latitude, longitude, phone, emergency_contact, blood_bank_available)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertRequest = db.prepare(`
    INSERT INTO blood_requests (requester_id, patient_name, blood_group, units_required, hospital, city, area, latitude, longitude, required_date, urgency, status, additional_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertDonation = db.prepare(`
    INSERT INTO donations (donor_id, request_id, hospital_name, blood_group, units, donation_date, status, certificate_id, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertNotification = db.prepare(`
    INSERT INTO notifications (user_id, request_id, title, message, type, is_read)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Run in single transaction
  const seedTransaction = db.transaction(() => {
    // 1. Admin
    const adminId = insertUser.run('Dr. Arvind Verma', 'admin@bloodconnect.org', '+91 94400 12345', hashPass('admin123'), 'admin').lastInsertRowid;

    // 2. Hospital Accounts
    const apolloUserId = insertUser.run('Apollo Hospitals Blood Bank', 'apollo@bloodconnect.org', '+91 40 2360 7777', hashPass('hospital123'), 'hospital').lastInsertRowid;

    // 3. Recipients
    const priyaId = insertUser.run('Priya Patel', 'priya@gmail.com', '+91 98765 43210', hashPass('recipient123'), 'recipient').lastInsertRowid;
    const arjunId = insertUser.run('Arjun Nair', 'arjun@gmail.com', '+91 98765 43211', hashPass('recipient123'), 'recipient').lastInsertRowid;
    const deepaId = insertUser.run('Deepa Sharma', 'deepa@gmail.com', '+91 98765 43212', hashPass('recipient123'), 'recipient').lastInsertRowid;

    // 4. Donors (Hyderabad realistic coordinates near Lingampally 17.4938, 78.3188)
    const rahulUserId = insertUser.run('Rahul Sharma', 'rahul@gmail.com', '+91 91234 56780', hashPass('donor123'), 'donor').lastInsertRowid;
    const rahulDonorId = insertDonor.run(rahulUserId, 'O+', 'male', '1998-04-12', 'Hyderabad', 'Lingampally', 17.4938, 78.3188, '2026-05-15', 1, 5, 1).lastInsertRowid;

    const rameshUserId = insertUser.run('Ramesh Kumar', 'ramesh@gmail.com', '+91 91234 56781', hashPass('donor123'), 'donor').lastInsertRowid;
    const rameshDonorId = insertDonor.run(rameshUserId, 'O+', 'male', '1996-08-20', 'Hyderabad', 'Chandanagar', 17.4900, 78.3300, '2026-04-10', 1, 3, 1).lastInsertRowid;

    const sureshUserId = insertUser.run('Suresh Reddy', 'suresh@gmail.com', '+91 91234 56782', hashPass('donor123'), 'donor').lastInsertRowid;
    const sureshDonorId = insertDonor.run(sureshUserId, 'O+', 'male', '1995-11-05', 'Hyderabad', 'Miyapur', 17.4965, 78.3614, '2026-03-22', 1, 4, 1).lastInsertRowid;

    const ananyaUserId = insertUser.run('Ananya Iyer', 'ananya@gmail.com', '+91 91234 56783', hashPass('donor123'), 'donor').lastInsertRowid;
    const ananyaDonorId = insertDonor.run(ananyaUserId, 'A+', 'female', '2000-02-14', 'Hyderabad', 'Gachibowli', 17.4401, 78.3489, '2026-06-01', 1, 2, 1).lastInsertRowid;

    const vikramUserId = insertUser.run('Vikram Malhotra', 'vikram@gmail.com', '+91 91234 56784', hashPass('donor123'), 'donor').lastInsertRowid;
    const vikramDonorId = insertDonor.run(vikramUserId, 'B+', 'male', '1994-09-18', 'Hyderabad', 'Hitec City', 17.4474, 78.3762, '2026-01-10', 1, 6, 1).lastInsertRowid;

    const snehaUserId = insertUser.run('Sneha Rao', 'sneha@gmail.com', '+91 91234 56785', hashPass('donor123'), 'donor').lastInsertRowid;
    const snehaDonorId = insertDonor.run(snehaUserId, 'AB+', 'female', '1999-07-25', 'Hyderabad', 'Kondapur', 17.4699, 78.3578, '2026-05-20', 1, 1, 1).lastInsertRowid;

    const deepakUserId = insertUser.run('Deepak Patel', 'deepak@gmail.com', '+91 91234 56786', hashPass('donor123'), 'donor').lastInsertRowid;
    const deepakDonorId = insertDonor.run(deepakUserId, 'O-', 'male', '1997-03-30', 'Hyderabad', 'Kukatpally', 17.4947, 78.3996, '2026-02-18', 1, 8, 1).lastInsertRowid;

    const kavitaUserId = insertUser.run('Kavita Menon', 'kavita@gmail.com', '+91 91234 56787', hashPass('donor123'), 'donor').lastInsertRowid;
    const kavitaDonorId = insertDonor.run(kavitaUserId, 'A-', 'female', '2001-10-12', 'Hyderabad', 'Banjara Hills', 17.4156, 78.4352, '2026-06-15', 1, 2, 1).lastInsertRowid;

    // 5. Hospitals
    insertHospital.run('Citizens Specialty Hospital', 'Hyderabad', 'Lingampally', 'Near Nallagandla Bypass, Lingampally, Hyderabad', 17.4950, 78.3175, '+91 40 6719 1919', '108', 1);
    insertHospital.run('Apollo Hospitals', 'Hyderabad', 'Jubilee Hills', 'Road No 72, Opp. Bharatiya Vidya Bhavan, Jubilee Hills', 17.4255, 78.4124, '+91 40 2360 7777', '1066', 1);
    insertHospital.run('Continental Hospitals', 'Hyderabad', 'Gachibowli', 'Plot No 3, Road No 2, IT & Financial District, Nanakramguda', 17.4243, 78.3448, '+91 40 6700 0000', '108', 1);
    insertHospital.run('Care Hospitals', 'Hyderabad', 'Banjara Hills', 'Road No 1, Banjara Hills, Hyderabad', 17.4122, 78.4419, '+91 40 6165 6565', '108', 1);
    insertHospital.run('KIMS Hospitals', 'Hyderabad', 'Secunderabad', '1-8-31/1, Minister Road, Krishna Nagar Colony, Begumpet', 17.4372, 78.4921, '+91 40 4488 5000', '108', 1);

    // 6. Blood Requests
    // Request 1: Emergency O+ at Citizens Hospital Lingampally (Right next to Rahul & Ramesh!)
    const req1Id = insertRequest.run(
      priyaId,
      'Rajesh Patel',
      'O+',
      2,
      'Citizens Specialty Hospital, Lingampally',
      'Hyderabad',
      'Lingampally',
      17.4950,
      78.3175,
      '2026-10-08',
      'emergency',
      'open',
      'ICU Cardiac Surgery patient urgently needs 2 units of O+ blood.'
    ).lastInsertRowid;

    // Request 2: Urgent B+ at Continental Hospitals Gachibowli
    const req2Id = insertRequest.run(
      arjunId,
      'Meera Nair',
      'B+',
      1,
      'Continental Hospitals, Gachibowli',
      'Hyderabad',
      'Gachibowli',
      17.4243,
      78.3448,
      '2026-10-09',
      'urgent',
      'open',
      'Dengue patient with declining platelet & RBC count.'
    ).lastInsertRowid;

    // Request 3: Normal A+ at Apollo Hospitals Jubilee Hills
    const req3Id = insertRequest.run(
      deepaId,
      'Sunil Sharma',
      'A+',
      2,
      'Apollo Hospitals, Jubilee Hills',
      'Hyderabad',
      'Jubilee Hills',
      17.4255,
      78.4124,
      '2026-10-12',
      'normal',
      'matched',
      'Scheduled knee replacement surgery.'
    ).lastInsertRowid;

    // 7. Donations history for Rahul
    insertDonation.run(rahulDonorId, null, 'ABC Blood Bank, Lingampally', 'O+', 1, '2026-05-15', 'completed', 'BC-CERT-2026-9081', 'Voluntary regular blood donation camp.');
    insertDonation.run(rahulDonorId, null, 'XYZ Hospital, Kukatpally', 'O+', 1, '2026-01-12', 'completed', 'BC-CERT-2026-4421', 'Emergency replacement donation.');
    insertDonation.run(rahulDonorId, null, 'Citizens Specialty Hospital', 'O+', 1, '2025-09-05', 'completed', 'BC-CERT-2025-1193', 'Red Cross donation drive.');

    // Donations for Ramesh
    insertDonation.run(rameshDonorId, null, 'Care Hospital Blood Bank', 'O+', 1, '2026-04-10', 'completed', 'BC-CERT-2026-3829', 'Voluntary replacement donation.');

    // 8. Notifications for Rahul (Donor O+)
    insertNotification.run(
      rahulUserId,
      req1Id,
      '🚨 EMERGENCY BLOOD REQUEST NEARBY',
      'Rajesh Patel urgently needs 2 units of O+ blood at Citizens Specialty Hospital, Lingampally (~0.5 km away).',
      'emergency',
      0
    );

    insertNotification.run(
      rahulUserId,
      null,
      '🩸 Eligibility Update',
      'You are fully eligible to donate blood! Your last donation was on 15 May 2026 (>90 days safe interval).',
      'system',
      1
    );

    // Notification for Priya (Recipient)
    insertNotification.run(
      priyaId,
      req1Id,
      '✅ Blood Request Published',
      'Your emergency request for 2 units of O+ blood has been broadcasted to nearby verified donors within 10 km.',
      'system',
      0
    );
  });

  seedTransaction();
  console.log('Seeding completed successfully!');
}

// Execute initial schema
initializeDatabase();

module.exports = db;
