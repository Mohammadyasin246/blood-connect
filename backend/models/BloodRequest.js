const db = require('../config/db');

const BloodRequest = {
  findById(id) {
    return db.prepare('SELECT * FROM blood_requests WHERE request_id = ?').get(id);
  },

  getAll(filter = {}) {
    let sql = 'SELECT * FROM blood_requests WHERE 1=1';
    const params = [];

    if (filter.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter.blood_group) {
      sql += ' AND blood_group = ?';
      params.push(filter.blood_group);
    }
    sql += ' ORDER BY created_at DESC';
    return db.prepare(sql).all(...params);
  },

  updateStatus(id, status, acceptedByDonorId = null) {
    if (acceptedByDonorId) {
      return db.prepare('UPDATE blood_requests SET status = ?, accepted_by_donor_id = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?').run(status, acceptedByDonorId, id);
    }
    return db.prepare('UPDATE blood_requests SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE request_id = ?').run(status, id);
  }
};

module.exports = BloodRequest;
