const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { isSupabaseConfigured } = require('../config/supabase');
const SupabaseService = require('../services/supabaseService');

const JWT_SECRET = process.env.JWT_SECRET || 'bloodconnect_super_secret_jwt_key_2026';

async function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (isSupabaseConfigured()) {
      const user = await SupabaseService.findUserById(decoded.user_id);
      if (!user || !user.is_active) {
        return res.status(403).json({ success: false, message: 'Account is deactivated or does not exist.' });
      }

      if (user.role === 'donor') {
        const donor = await SupabaseService.findDonorByUserId(user.user_id);
        req.donor = donor || null;
      }

      req.user = user;
      return next();
    }

    // SQLite Fallback
    const user = db.prepare('SELECT user_id, name, email, phone, role, is_active FROM users WHERE user_id = ?').get(decoded.user_id);
    
    if (!user || user.is_active === 0) {
      return res.status(403).json({ success: false, message: 'Account is deactivated or does not exist.' });
    }

    // Attach donor profile if role is donor
    if (user.role === 'donor') {
      const donor = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(user.user_id);
      req.donor = donor || null;
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

async function optionalAuthenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (isSupabaseConfigured()) {
      const user = await SupabaseService.findUserById(decoded.user_id);
      if (user && user.is_active) {
        if (user.role === 'donor') {
          req.donor = await SupabaseService.findDonorByUserId(user.user_id);
        }
        req.user = user;
      }
      return next();
    }

    const user = db.prepare('SELECT user_id, name, email, phone, role, is_active FROM users WHERE user_id = ?').get(decoded.user_id);
    if (user && user.is_active !== 0) {
      if (user.role === 'donor') {
        req.donor = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(user.user_id);
      }
      req.user = user;
    }
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: `Access forbidden for role: ${req.user.role}` });
    }
    next();
  };
}

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  JWT_SECRET
};
