const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { isSupabaseConfigured } = require('../config/supabase');
const SupabaseService = require('../services/supabaseService');
const { JWT_SECRET } = require('../middleware/auth');
const { checkMedicalEligibility } = require('../services/matchingService');

function generateToken(user) {
  return jwt.sign(
    { user_id: user.user_id, role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register
async function register(req, res) {
  try {
    const {
      name,
      email,
      phone,
      password,
      role = 'donor',
      // Donor specific fields:
      blood_group,
      gender = 'other',
      date_of_birth,
      city = 'Hyderabad',
      area = 'Lingampally',
      latitude,
      longitude,
      last_donation_date = null
    } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, phone, and password are required.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password, salt);

    const lat = latitude ? parseFloat(latitude) : 17.4938;
    const lon = longitude ? parseFloat(longitude) : 78.3188;

    // === Supabase Implementation ===
    if (isSupabaseConfigured()) {
      const existing = await SupabaseService.findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
      }

      const user = await SupabaseService.createUser({
        name,
        email,
        phone,
        password_hash,
        role
      });

      let donor = null;
      if (role === 'donor') {
        if (!blood_group) {
          return res.status(400).json({ success: false, message: 'Blood group is required for donor registration.' });
        }
        donor = await SupabaseService.createDonor({
          user_id: user.user_id,
          blood_group,
          gender,
          date_of_birth: date_of_birth || null,
          city,
          area,
          latitude: lat,
          longitude: lon,
          last_donation_date: last_donation_date || null
        });
      }

      const token = generateToken(user);
      return res.status(201).json({
        success: true,
        message: 'Account registered successfully on Supabase.',
        token,
        user,
        donor
      });
    }

    // === SQLite Fallback ===
    const existing = db.prepare('SELECT user_id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    let newUserId;
    let newDonorId = null;

    const registerTx = db.transaction(() => {
      const userStmt = db.prepare(`
        INSERT INTO users (name, email, phone, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `);
      const userRes = userStmt.run(name.trim(), email.toLowerCase().trim(), phone.trim(), password_hash, role);
      newUserId = userRes.lastInsertRowid;

      if (role === 'donor') {
        if (!blood_group) {
          throw new Error('Blood group is required for donor registration.');
        }

        const donorStmt = db.prepare(`
          INSERT INTO donors (user_id, blood_group, gender, date_of_birth, city, area, latitude, longitude, last_donation_date, availability, total_donations, is_verified)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 1)
        `);
        const donorRes = donorStmt.run(
          newUserId,
          blood_group,
          gender,
          date_of_birth || null,
          city,
          area,
          lat,
          lon,
          last_donation_date || null
        );
        newDonorId = donorRes.lastInsertRowid;
      }
    });

    registerTx();

    const user = db.prepare('SELECT user_id, name, email, phone, role, created_at FROM users WHERE user_id = ?').get(newUserId);
    const donor = role === 'donor' ? db.prepare('SELECT * FROM donors WHERE donor_id = ?').get(newDonorId) : null;
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user,
      donor
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Server error during registration.' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { loginId, email, phone, password } = req.body;
    const identifier = (loginId || email || phone || '').toLowerCase().trim();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/Phone and password are required.' });
    }

    let user = null;

    // === Supabase Implementation ===
    if (isSupabaseConfigured()) {
      user = await SupabaseService.findUserByIdentifier(identifier);
    } else {
      user = db.prepare(`
        SELECT * FROM users 
        WHERE LOWER(email) = ? OR phone = ?
      `).get(identifier, identifier);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.is_active === 0 || user.is_active === false) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    let donor = null;
    if (user.role === 'donor') {
      if (isSupabaseConfigured()) {
        donor = await SupabaseService.findDonorByUserId(user.user_id);
      } else {
        donor = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(user.user_id);
      }
      if (donor) {
        donor.medical_eligibility = checkMedicalEligibility(donor.last_donation_date);
      }
    }

    const token = generateToken(user);
    const safeUser = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      created_at: user.created_at
    };

    return res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: safeUser,
      donor
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
}

// POST /api/auth/admin-login
async function adminLogin(req, res) {
  try {
    const { email, password, adminKey } = req.body;
    const identifier = (email || '').toLowerCase().trim();

    const SPECIAL_ADMIN_KEY = process.env.SPECIAL_ADMIN_KEY || 'ADMIN@SECURE#2026';
    const SPECIAL_ADMIN_EMAIL = 'admin@bloodconnect.org';

    let user = null;
    if (isSupabaseConfigured()) {
      const adminCandidate = await SupabaseService.findUserByEmail(identifier || SPECIAL_ADMIN_EMAIL);
      if (adminCandidate && adminCandidate.role === 'admin') {
        user = adminCandidate;
      }
    } else {
      user = db.prepare(`SELECT * FROM users WHERE (LOWER(email) = ? OR LOWER(email) = ?) AND role = 'admin'`).get(identifier, SPECIAL_ADMIN_EMAIL);
    }

    if (!user) {
      return res.status(403).json({ success: false, message: 'Access denied: Unauthorized administrator account.' });
    }

    let isAuthorized = false;

    if (adminKey && adminKey === SPECIAL_ADMIN_KEY) {
      isAuthorized = true;
    } else if (password && (password === 'ADMIN@SECURE#2026' || bcrypt.compareSync(password, user.password_hash))) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid Admin credentials or security key. Special clearance required.' 
      });
    }

    const token = generateToken(user);
    return res.json({
      success: true,
      message: 'Administrator authorization successful. Welcome, Dr. Verma.',
      token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: 'admin'
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during admin authentication.' });
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  try {
    const user = req.user;
    let donor = req.donor || null;

    if (donor) {
      donor.medical_eligibility = checkMedicalEligibility(donor.last_donation_date);
    }

    let unreadCount = 0;
    if (isSupabaseConfigured()) {
      unreadCount = await SupabaseService.getUnreadNotificationCount(user.user_id);
    } else {
      unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(user.user_id).count;
    }

    return res.json({
      success: true,
      user,
      donor,
      unreadNotificationsCount: unreadCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving user profile.' });
  }
}

module.exports = {
  register,
  login,
  adminLogin,
  getMe
};
