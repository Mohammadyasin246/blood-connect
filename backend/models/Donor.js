const db = require('../config/db');

const Donor = {
  findByUserId(userId) {
    return db.prepare('SELECT * FROM donors WHERE user_id = ?').get(userId);
  },

  findById(donorId) {
    return db.prepare('SELECT * FROM donors WHERE donor_id = ?').get(donorId);
  },

  create(donorData) {
    const stmt = db.prepare(`
      INSERT INTO donors (user_id, blood_group, gender, date_of_birth, city, area, latitude, longitude, last_donation_date, availability, total_donations, is_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      donorData.user_id,
      donorData.blood_group,
      donorData.gender || 'other',
      donorData.date_of_birth || null,
      donorData.city,
      donorData.area,
      donorData.latitude,
      donorData.longitude,
      donorData.last_donation_date || null,
      donorData.availability !== undefined ? donorData.availability : 1,
      donorData.total_donations || 0,
      donorData.is_verified !== undefined ? donorData.is_verified : 1
    );
    return res.lastInsertRowid;
  },

  updateAvailability(donorId, availability) {
    return db.prepare('UPDATE donors SET availability = ?, updated_at = CURRENT_TIMESTAMP WHERE donor_id = ?').run(availability ? 1 : 0, donorId);
  },

  getAllVerified() {
    return db.prepare(`
      SELECT d.*, u.name, u.email, u.phone 
      FROM donors d 
      JOIN users u ON d.user_id = u.user_id 
      WHERE u.is_active = 1 AND d.is_verified = 1
    `).all();
  }
};

module.exports = Donor;
