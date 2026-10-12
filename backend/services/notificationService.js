/**
 * Notification Service
 * Manages database notifications and simulated push alerts
 * Supports both Supabase PostgreSQL and SQLite fallback
 */

const db = require('../config/db');
const { isSupabaseConfigured } = require('../config/supabase');
const SupabaseService = require('./supabaseService');

async function createNotification({ userId, requestId = null, title, message, type = 'request' }) {
  if (isSupabaseConfigured()) {
    try {
      return await SupabaseService.createNotification({ userId, requestId, title, message, type });
    } catch (err) {
      console.error('Supabase createNotification error:', err);
      return { success: false, error: err.message };
    }
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, request_id, title, message, type, is_read)
      VALUES (?, ?, ?, ?, ?, 0)
    `);
    const info = stmt.run(userId, requestId, title, message, type);
    return { notification_id: info.lastInsertRowid, success: true };
  } catch (err) {
    console.error('Failed to create notification:', err);
    return { success: false, error: err.message };
  }
}

async function notifyMatchingDonors(request, matchedDonors) {
  const urgencyPrefix = request.urgency === 'emergency' ? '🚨 EMERGENCY' : request.urgency === 'urgent' ? '⚠️ URGENT' : '🩸';
  
  for (const donor of matchedDonors) {
    const message = `${urgencyPrefix} Blood Request: ${request.patient_name || 'Patient'} needs ${request.units_required} unit(s) of ${request.blood_group} blood at ${request.hospital} (${donor.distance_km} km away).`;
    
    await createNotification({
      userId: donor.user_id,
      requestId: request.request_id,
      title: `${urgencyPrefix} Blood Needed Nearby (${donor.blood_group})`,
      message: message,
      type: request.urgency === 'emergency' ? 'emergency' : 'request'
    });
  }
}

module.exports = {
  createNotification,
  notifyMatchingDonors
};
