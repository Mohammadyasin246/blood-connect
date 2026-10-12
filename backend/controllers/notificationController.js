const db = require('../config/db');
const { isSupabaseConfigured } = require('../config/supabase');
const SupabaseService = require('../services/supabaseService');

// GET /api/notifications
async function getNotifications(req, res) {
  try {
    const userId = req.user.user_id;

    if (isSupabaseConfigured()) {
      const [notifications, unreadCount] = await Promise.all([
        SupabaseService.getNotifications(userId),
        SupabaseService.getUnreadNotificationCount(userId)
      ]);
      return res.json({
        success: true,
        unread_count: unreadCount,
        notifications
      });
    }

    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 25
    `).all(userId);

    const unreadCount = db.prepare(`
      SELECT COUNT(*) as count FROM notifications
      WHERE user_id = ? AND is_read = 0
    `).get(userId).count;

    return res.json({
      success: true,
      unread_count: unreadCount,
      notifications
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
}

// PATCH /api/notifications/:id/read
async function markAsRead(req, res) {
  try {
    const notificationId = req.params.id;
    const userId = req.user.user_id;

    if (isSupabaseConfigured()) {
      await SupabaseService.markNotificationAsRead(notificationId, userId);
      return res.json({ success: true, message: 'Notification marked as read.' });
    }

    db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE notification_id = ? AND user_id = ?
    `).run(notificationId, userId);

    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
}

// POST /api/notifications/mark-all-read
async function markAllAsRead(req, res) {
  try {
    const userId = req.user.user_id;

    if (isSupabaseConfigured()) {
      await SupabaseService.markAllNotificationsAsRead(userId);
      return res.json({ success: true, message: 'All notifications marked as read.' });
    }

    db.prepare(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ?
    `).run(userId);

    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead
};
