const db = require('../config/db');

const Donation = {
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO donations (donor_id, request_id, hospital_name, blood_group, units, donation_date, status, certificate_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(
      data.donor_id,
      data.request_id || null,
      data.hospital_name,
      data.blood_group,
      data.units || 1,
      data.donation_date,
      data.status || 'completed',
      data.certificate_id,
      data.notes || ''
    );
    return res.lastInsertRowid;
  },

  findByDonorId(donorId) {
    return db.prepare('SELECT * FROM donations WHERE donor_id = ? ORDER BY donation_date DESC').all(donorId);
  },

  findByCertificateId(certId) {
    return db.prepare('SELECT * FROM donations WHERE certificate_id = ?').get(certId);
  }
};

module.exports = Donation;
