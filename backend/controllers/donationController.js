const db = require('../config/db');
const { isSupabaseConfigured } = require('../config/supabase');
const SupabaseService = require('../services/supabaseService');

// GET /api/donations
async function getDonations(req, res) {
  try {
    const userId = req.user.user_id;
    const role = req.user.role;

    if (isSupabaseConfigured()) {
      if (role === 'donor') {
        const donor = await SupabaseService.findDonorByUserId(userId);
        if (!donor) {
          return res.json({ success: true, count: 0, donations: [] });
        }
        const donations = await SupabaseService.getDonations(donor.donor_id);
        return res.json({
          success: true,
          count: donations.length,
          donations
        });
      } else {
        const donations = await SupabaseService.getDonations(null);
        return res.json({
          success: true,
          count: donations.length,
          donations
        });
      }
    }

    let donations = [];

    if (role === 'donor') {
      const donor = db.prepare('SELECT donor_id FROM donors WHERE user_id = ?').get(userId);
      if (!donor) {
        return res.json({ success: true, count: 0, donations: [] });
      }

      donations = db.prepare(`
        SELECT 
          d.*,
          u.name as donor_name,
          dn.blood_group
        FROM donations d
        JOIN donors dn ON d.donor_id = dn.donor_id
        JOIN users u ON dn.user_id = u.user_id
        WHERE d.donor_id = ?
        ORDER BY d.donation_date DESC
      `).all(donor.donor_id);
    } else {
      donations = db.prepare(`
        SELECT 
          d.*,
          u.name as donor_name,
          u.email as donor_email,
          dn.blood_group
        FROM donations d
        JOIN donors dn ON d.donor_id = dn.donor_id
        JOIN users u ON dn.user_id = u.user_id
        ORDER BY d.donation_date DESC
      `).all();
    }

    return res.json({
      success: true,
      count: donations.length,
      donations
    });
  } catch (err) {
    console.error('Fetch donations error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch donations.' });
  }
}

// GET /api/donations/certificate/:certId
async function getCertificate(req, res) {
  try {
    const certId = req.params.certId;

    if (isSupabaseConfigured()) {
      const cert = await SupabaseService.getCertificate(certId);
      if (!cert) {
        return res.status(404).json({ success: false, message: 'Certificate not found.' });
      }
      return res.json({
        success: true,
        certificate: cert
      });
    }

    const record = db.prepare(`
      SELECT 
        d.*,
        u.name as donor_name,
        u.email as donor_email,
        u.phone as donor_phone,
        dn.blood_group as donor_blood_group,
        dn.city as donor_city
      FROM donations d
      JOIN donors dn ON d.donor_id = dn.donor_id
      JOIN users u ON dn.user_id = u.user_id
      WHERE d.certificate_id = ?
    `).get(certId);

    if (!record) {
      return res.status(404).json({ success: false, message: 'Certificate not found.' });
    }

    return res.json({
      success: true,
      certificate: {
        certificate_id: record.certificate_id,
        donor_name: record.donor_name,
        blood_group: record.donor_blood_group,
        units: record.units,
        hospital_name: record.hospital_name,
        donation_date: record.donation_date,
        issued_by: 'National Blood Transfusion Council & BloodConnect India',
        verification_status: 'Official Verified Record'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to retrieve certificate.' });
  }
}

module.exports = {
  getDonations,
  getCertificate
};
