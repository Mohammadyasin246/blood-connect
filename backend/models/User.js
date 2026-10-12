const db = require('../config/db');

const User = {
  findById(id) {
    return db.prepare('SELECT user_id, name, email, phone, role, is_active, created_at FROM users WHERE user_id = ?').get(id);
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
  },

  findByPhone(phone) {
    return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  },

  create({ name, email, phone, password_hash, role = 'donor' }) {
    const stmt = db.prepare(`
      INSERT INTO users (name, email, phone, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    const res = stmt.run(name, email.toLowerCase(), phone, password_hash, role);
    return res.lastInsertRowid;
  },

  getAll(role = null) {
    if (role && role !== 'ALL') {
      return db.prepare('SELECT user_id, name, email, phone, role, is_active, created_at FROM users WHERE role = ?').all(role);
    }
    return db.prepare('SELECT user_id, name, email, phone, role, is_active, created_at FROM users').all();
  },

  toggleStatus(id, newStatus) {
    return db.prepare('UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(newStatus, id);
  }
};

module.exports = User;
