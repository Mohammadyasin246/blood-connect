require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

// Ensure DB is initialized
require('./config/db');

// Supabase integration
const { isSupabaseConfigured, testSupabaseConnection } = require('./config/supabase');

// Import routes
const authRoutes = require('./routes/authRoutes');
const donorRoutes = require('./routes/donorRoutes');
const requestRoutes = require('./routes/requestRoutes');
const donationRoutes = require('./routes/donationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const fs = require('fs');

// Serve frontend static files
const frontendDir = path.resolve(__dirname, '../frontend');
app.use(express.static(frontendDir));

// Serve Flutter Application build
const flutterDir = path.resolve(__dirname, '../bloodconnect_app/build/web');
if (fs.existsSync(flutterDir)) {
  app.use('/app', express.static(flutterDir));
  app.use('/flutter', express.static(flutterDir));
}

// Serve Mobile Release APK directly for download
const getApkPath = () => {
  const rootApk = path.resolve(__dirname, '../bloodconnect-release.apk');
  const buildApk = path.resolve(__dirname, '../bloodconnect_app/build/app/outputs/flutter-apk/app-release.apk');
  if (fs.existsSync(rootApk)) return rootApk;
  if (fs.existsSync(buildApk)) return buildApk;
  return null;
};

app.get(['/download/apk', '/bloodconnect.apk', '/download'], (req, res) => {
  const apkPath = getApkPath();
  if (apkPath) {
    return res.download(apkPath, 'BloodConnect-v1.0.apk');
  }
  return res.status(404).send('APK is currently building or not found. Please try again shortly.');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/donors', donorRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    app: 'BloodConnect API',
    version: '1.0.0',
    database: isSupabaseConfigured() ? 'Supabase (PostgreSQL)' : 'SQLite',
    supabase_configured: isSupabaseConfigured(),
    timestamp: new Date().toISOString()
  });
});

// Supabase Status check endpoint
app.get('/api/supabase-status', async (req, res) => {
  const configured = isSupabaseConfigured();
  if (!configured) {
    return res.json({
      configured: false,
      message: 'Supabase credentials (SUPABASE_URL, SUPABASE_ANON_KEY) are not set in .env. Running on local SQLite database.',
      help: 'To use Supabase, provide SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.'
    });
  }

  const testResult = await testSupabaseConnection();
  return res.json({
    configured: true,
    connected: testResult.success,
    url: process.env.SUPABASE_URL,
    details: testResult
  });
});

// Admin shortcut route
app.get('/admin', (req, res) => {
  res.redirect('/#admin');
});

// Fallback to index.html for Single Page App routing
app.use((req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  const dbEngine = isSupabaseConfigured() ? '⚡ Supabase (PostgreSQL)' : '💾 SQLite (Local)';
  console.log(`====================================================`);
  console.log(`🩸 BloodConnect Server is running on port ${PORT}`);
  console.log(`🗄️  Active Database: ${dbEngine}`);
  console.log(`🔗 Local Web App: http://localhost:${PORT}`);
  console.log(`📊 Admin Panel:   http://localhost:${PORT}/#admin`);
  console.log(`🩺 API Health:    http://localhost:${PORT}/api/health`);
  console.log(`⚡ Supabase API:  http://localhost:${PORT}/api/supabase-status`);
  console.log(`====================================================`);
});

module.exports = app;
