const db = require('../config/db');
const { isSupabaseConfigured } = require('../config/supabase');
const SupabaseService = require('../services/supabaseService');

// GET /api/admin/stats
async function getDashboardStats(req, res) {
  try {
    if (isSupabaseConfigured()) {
      const stats = await SupabaseService.getDashboardStats();
      return res.json({
        success: true,
        ...stats
      });
    }

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalDonors = db.prepare('SELECT COUNT(*) as count FROM donors').get().count;
    const activeRequests = db.prepare("SELECT COUNT(*) as count FROM blood_requests WHERE status IN ('open', 'matched', 'in_progress')").get().count;
    const completedRequests = db.prepare("SELECT COUNT(*) as count FROM blood_requests WHERE status = 'completed'").get().count;
    const totalDonations = db.prepare('SELECT COUNT(*) as count, IFNULL(SUM(units), 0) as units FROM donations').get();

    // Blood group inventory/donors distribution
    const bloodGroupDistribution = db.prepare(`
      SELECT blood_group, COUNT(*) as count 
      FROM donors 
      GROUP BY blood_group 
      ORDER BY count DESC
    `).all();

    // Requests by urgency
    const urgencyBreakdown = db.prepare(`
      SELECT urgency, COUNT(*) as count 
      FROM blood_requests 
      GROUP BY urgency
    `).all();

    // Recent requests
    const recentRequests = db.prepare(`
      SELECT r.*, u.name as requester_name 
      FROM blood_requests r 
      JOIN users u ON r.requester_id = u.user_id 
      ORDER BY r.created_at DESC 
      LIMIT 5
    `).all();

    // Recent donors
    const recentDonors = db.prepare(`
      SELECT d.*, u.name, u.email, u.phone 
      FROM donors d 
      JOIN users u ON d.user_id = u.user_id 
      ORDER BY d.created_at DESC 
      LIMIT 5
    `).all();

    return res.json({
      success: true,
      stats: {
        total_users: totalUsers,
        total_donors: totalDonors,
        active_requests: activeRequests,
        completed_requests: completedRequests,
        total_donations_count: totalDonations.count,
        total_units_collected: totalDonations.units
      },
      blood_group_distribution: bloodGroupDistribution,
      urgency_breakdown: urgencyBreakdown,
      recent_requests: recentRequests,
      recent_donors: recentDonors
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to retrieve admin dashboard stats.' });
  }
}

// GET /api/admin/users
async function getUsers(req, res) {
  try {
    const { role, search } = req.query;

    if (isSupabaseConfigured()) {
      const users = await SupabaseService.getUsers(role, search || '');
      return res.json({
        success: true,
        count: users.length,
        users
      });
    }

    let query = `
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.is_active,
        u.created_at,
        d.blood_group,
        d.city,
        d.area,
        d.availability,
        d.is_verified,
        d.total_donations
      FROM users u
      LEFT JOIN donors d ON u.user_id = d.user_id
      WHERE 1=1
    `;
    const params = [];

    if (role && role !== 'ALL') {
      query += ` AND u.role = ?`;
      params.push(role);
    }

    if (search) {
      query += ` AND (LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ? OR u.phone LIKE ?)`;
      const term = `%${search.toLowerCase()}%`;
      params.push(term, term, term);
    }

    query += ` ORDER BY u.created_at DESC`;

    const users = db.prepare(query).all(...params);

    return res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
}

// PATCH /api/admin/users/:id/status
async function toggleUserStatus(req, res) {
  try {
    const userId = req.params.id;

    if (isSupabaseConfigured()) {
      const user = await SupabaseService.findUserById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      const newStatus = !user.is_active;
      await SupabaseService.toggleUserStatus(userId, newStatus);

      return res.json({
        success: true,
        message: `User ${newStatus ? 'activated' : 'deactivated'} successfully on Supabase.`,
        is_active: newStatus
      });
    }

    const user = db.prepare('SELECT user_id, is_active FROM users WHERE user_id = ?').get(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const newStatus = user.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(newStatus, userId);

    return res.json({
      success: true,
      message: `User ${newStatus === 1 ? 'activated' : 'deactivated'} successfully.`,
      is_active: newStatus === 1
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
}

// PATCH /api/admin/donors/:id/verify
async function toggleDonorVerification(req, res) {
  try {
    const donorId = req.params.id;

    if (isSupabaseConfigured()) {
      const donor = await SupabaseService.findDonorById(donorId);
      if (!donor) {
        return res.status(404).json({ success: false, message: 'Donor not found.' });
      }

      const newStatus = !donor.is_verified;
      await SupabaseService.toggleDonorVerification(donorId, newStatus);

      return res.json({
        success: true,
        message: `Donor verification set to ${newStatus ? 'Verified' : 'Unverified'} on Supabase.`,
        is_verified: newStatus
      });
    }

    const donor = db.prepare('SELECT donor_id, is_verified FROM donors WHERE donor_id = ?').get(donorId);

    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor not found.' });
    }

    const newStatus = donor.is_verified === 1 ? 0 : 1;
    db.prepare('UPDATE donors SET is_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE donor_id = ?').run(newStatus, donorId);

    return res.json({
      success: true,
      message: `Donor verification set to ${newStatus === 1 ? 'Verified' : 'Unverified'}.`,
      is_verified: newStatus === 1
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update donor verification.' });
  }
}

// GET /api/admin/hospitals
async function getHospitals(req, res) {
  try {
    if (isSupabaseConfigured()) {
      const hospitals = await SupabaseService.getAllHospitals();
      return res.json({ success: true, count: hospitals.length, hospitals });
    }

    const hospitals = db.prepare('SELECT * FROM hospitals ORDER BY name ASC').all();
    return res.json({ success: true, count: hospitals.length, hospitals });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve hospitals.' });
  }
}

// POST /api/admin/hospitals
async function addHospital(req, res) {
  try {
    const { name, city, area, address, latitude, longitude, phone, emergency_contact, blood_bank_available = 1 } = req.body;

    if (!name || !city || !address || !phone) {
      return res.status(400).json({ success: false, message: 'Name, city, address, and phone are required.' });
    }

    if (isSupabaseConfigured()) {
      const hospital = await SupabaseService.createHospital({
        name,
        city,
        area: area || city,
        address,
        latitude: parseFloat(latitude) || 17.4938,
        longitude: parseFloat(longitude) || 78.3188,
        phone,
        emergency_contact: emergency_contact || '108',
        blood_bank_available: blood_bank_available ? 1 : 0
      });
      return res.status(201).json({
        success: true,
        message: 'Hospital added successfully on Supabase.',
        hospital
      });
    }

    const stmt = db.prepare(`
      INSERT INTO hospitals (name, city, area, address, latitude, longitude, phone, emergency_contact, blood_bank_available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name, city, area || city, address,
      parseFloat(latitude) || 17.4938,
      parseFloat(longitude) || 78.3188,
      phone,
      emergency_contact || '108',
      blood_bank_available ? 1 : 0
    );

    const hospital = db.prepare('SELECT * FROM hospitals WHERE hospital_id = ?').get(result.lastInsertRowid);

    return res.status(201).json({
      success: true,
      message: 'Hospital added successfully.',
      hospital
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create hospital record.' });
  }
}

module.exports = {
  getDashboardStats,
  getUsers,
  toggleUserStatus,
  toggleDonorVerification,
  getHospitals,
  addHospital
};
