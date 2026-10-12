const db = require('../config/db');
const { isSupabaseConfigured } = require('../config/supabase');
const SupabaseService = require('../services/supabaseService');
const { haversineDistance, checkMedicalEligibility, isBloodCompatible } = require('../services/matchingService');

function maskPhoneNumber(phone) {
  if (!phone) return '—';
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length > 6) {
    return clean.slice(0, 3) + '••••' + clean.slice(-3);
  }
  return '••••';
}

// GET /api/donors/search
async function searchDonors(req, res) {
  try {
    const {
      blood_group,
      latitude,
      longitude,
      radius = 15, // km
      available_only = 'false',
      exact_match = 'false'
    } = req.query;

    const lat = latitude ? parseFloat(latitude) : 17.4938; // Default Lingampally
    const lon = longitude ? parseFloat(longitude) : 78.3188;
    const maxRadius = parseFloat(radius);
    const requireAvailable = available_only === 'true' || available_only === '1';
    const requireExact = exact_match === 'true' || exact_match === '1';

    let donors = [];

    if (isSupabaseConfigured()) {
      donors = await SupabaseService.getAllDonors(requireAvailable);
    } else {
      let query = `
        SELECT 
          d.donor_id,
          d.user_id,
          u.name,
          u.phone,
          d.blood_group,
          d.gender,
          d.city,
          d.area,
          d.latitude,
          d.longitude,
          d.last_donation_date,
          d.availability,
          d.total_donations,
          d.is_verified
        FROM donors d
        JOIN users u ON d.user_id = u.user_id
        WHERE u.is_active = 1 AND d.is_verified = 1
      `;
      if (requireAvailable) {
        query += ` AND d.availability = 1`;
      }
      donors = db.prepare(query).all();
    }

    const targetBloodGroup = (blood_group || '').trim().replace(/\s+/g, '+');

    const results = [];
    for (const d of donors) {
      let compatible = true;
      let matchType = 'compatible';

      if (targetBloodGroup && targetBloodGroup !== 'ALL') {
        if (d.blood_group === targetBloodGroup) {
          matchType = 'exact';
        } else if (!requireExact && isBloodCompatible(d.blood_group, targetBloodGroup)) {
          matchType = 'compatible';
        } else {
          compatible = false;
        }
      }

      if (!compatible) continue;

      const distance = haversineDistance(lat, lon, d.latitude, d.longitude);
      if (maxRadius && distance > maxRadius) continue;

      const eligibility = checkMedicalEligibility(d.last_donation_date);

      results.push({
        donor_id: d.donor_id,
        user_id: d.user_id,
        name: d.name,
        phone_masked: maskPhoneNumber(d.phone),
        blood_group: d.blood_group,
        gender: d.gender,
        city: d.city,
        area: d.area,
        latitude: d.latitude,
        longitude: d.longitude,
        availability: d.availability === 1 || d.availability === true,
        total_donations: d.total_donations,
        distance_km: distance,
        match_type: matchType,
        is_eligible: eligibility.isEligible,
        days_since_last_donation: eligibility.daysSince
      });
    }

    results.sort((a, b) => a.distance_km - b.distance_km);

    return res.json({
      success: true,
      total_found: results.length,
      search_center: { latitude: lat, longitude: lon, radius_km: maxRadius },
      donors: results
    });
  } catch (err) {
    console.error('Donor search error:', err);
    return res.status(500).json({ success: false, message: 'Failed to search donors.' });
  }
}

// GET /api/donors/nearby
function getNearbyDonors(req, res) {
  return searchDonors(req, res);
}

// GET /api/donors
async function getAllDonors(req, res) {
  try {
    let donors = [];
    if (isSupabaseConfigured()) {
      donors = await SupabaseService.getAllDonors(false);
    } else {
      donors = db.prepare(`
        SELECT 
          d.donor_id,
          d.user_id,
          u.name,
          u.email,
          u.phone,
          d.blood_group,
          d.gender,
          d.city,
          d.area,
          d.latitude,
          d.longitude,
          d.last_donation_date,
          d.availability,
          d.total_donations,
          d.is_verified,
          d.created_at
        FROM donors d
        JOIN users u ON d.user_id = u.user_id
        ORDER BY d.created_at DESC
      `).all();
    }

    return res.json({
      success: true,
      count: donors.length,
      donors
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch donors.' });
  }
}

// PATCH /api/donors/availability
async function toggleAvailability(req, res) {
  try {
    const userId = req.user.user_id;
    const { availability } = req.body;

    let donor = null;
    if (isSupabaseConfigured()) {
      donor = await SupabaseService.findDonorByUserId(userId);
      if (!donor) return res.status(404).json({ success: false, message: 'Donor profile not found.' });

      const newStatus = availability !== undefined ? Boolean(availability) : !donor.availability;
      await SupabaseService.updateDonorAvailability(donor.donor_id, newStatus);

      return res.json({
        success: true,
        message: `Availability updated to ${newStatus ? 'Available' : 'Unavailable'}.`,
        availability: newStatus
      });
    }

    donor = db.prepare('SELECT donor_id, availability FROM donors WHERE user_id = ?').get(userId);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor profile not found.' });
    }

    const newStatus = availability !== undefined ? (availability ? 1 : 0) : (donor.availability === 1 ? 0 : 1);
    db.prepare('UPDATE donors SET availability = ?, updated_at = CURRENT_TIMESTAMP WHERE donor_id = ?').run(newStatus, donor.donor_id);

    return res.json({
      success: true,
      message: `Availability updated to ${newStatus === 1 ? 'Available' : 'Unavailable'}.`,
      availability: newStatus === 1
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update availability.' });
  }
}

// PUT /api/donors/profile
async function updateDonorProfile(req, res) {
  try {
    const userId = req.user.user_id;
    const { blood_group, city, area, latitude, longitude, last_donation_date, gender } = req.body;

    if (isSupabaseConfigured()) {
      const donor = await SupabaseService.findDonorByUserId(userId);
      if (!donor) return res.status(404).json({ success: false, message: 'Donor profile not found.' });

      const updates = {};
      if (blood_group) updates.blood_group = blood_group;
      if (city) updates.city = city;
      if (area) updates.area = area;
      if (latitude) updates.latitude = parseFloat(latitude);
      if (longitude) updates.longitude = parseFloat(longitude);
      if (last_donation_date !== undefined) updates.last_donation_date = last_donation_date;
      if (gender) updates.gender = gender;

      const updatedDonor = await SupabaseService.updateDonorProfile(donor.donor_id, updates);
      updatedDonor.medical_eligibility = checkMedicalEligibility(updatedDonor.last_donation_date);

      return res.json({
        success: true,
        message: 'Profile updated successfully on Supabase.',
        donor: updatedDonor
      });
    }

    const donor = db.prepare('SELECT donor_id FROM donors WHERE user_id = ?').get(userId);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor profile not found.' });
    }

    const updates = [];
    const params = [];

    if (blood_group) { updates.push('blood_group = ?'); params.push(blood_group); }
    if (city) { updates.push('city = ?'); params.push(city); }
    if (area) { updates.push('area = ?'); params.push(area); }
    if (latitude) { updates.push('latitude = ?'); params.push(parseFloat(latitude)); }
    if (longitude) { updates.push('longitude = ?'); params.push(parseFloat(longitude)); }
    if (last_donation_date !== undefined) { updates.push('last_donation_date = ?'); params.push(last_donation_date); }
    if (gender) { updates.push('gender = ?'); params.push(gender); }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(donor.donor_id);
      db.prepare(`UPDATE donors SET ${updates.join(', ')} WHERE donor_id = ?`).run(...params);
    }

    const updatedDonor = db.prepare('SELECT * FROM donors WHERE donor_id = ?').get(donor.donor_id);
    updatedDonor.medical_eligibility = checkMedicalEligibility(updatedDonor.last_donation_date);

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      donor: updatedDonor
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to update donor profile.' });
  }
}

// GET /api/donors/dashboard-stats
async function getDonorDashboardStats(req, res) {
  try {
    const userId = req.user.user_id;

    if (isSupabaseConfigured()) {
      const donor = await SupabaseService.findDonorByUserId(userId);
      if (!donor) return res.status(404).json({ success: false, message: 'Donor profile not found.' });

      const eligibility = checkMedicalEligibility(donor.last_donation_date);
      const allRequests = await SupabaseService.getAllRequests({});

      const nearbyRequests = [];
      for (const reqItem of allRequests) {
        const isDirect = reqItem.target_donor_id === donor.donor_id;
        const isAccepted = reqItem.accepted_by_donor_id === donor.donor_id;
        const isOpenCompatible = reqItem.status === 'open' && (reqItem.blood_group === donor.blood_group || isBloodCompatible(donor.blood_group, reqItem.blood_group));

        if (isDirect || isAccepted || isOpenCompatible) {
          const dist = haversineDistance(donor.latitude, donor.longitude, reqItem.latitude, reqItem.longitude);
          nearbyRequests.push({
            ...reqItem,
            distance_km: dist,
            is_direct_request: isDirect
          });
        }
      }

      // Prioritize direct requests first, then accepted, then closest distance
      nearbyRequests.sort((a, b) => {
        if (a.is_direct_request && !b.is_direct_request) return -1;
        if (!a.is_direct_request && b.is_direct_request) return 1;
        if (a.accepted_by_donor_id === donor.donor_id && b.accepted_by_donor_id !== donor.donor_id) return -1;
        if (a.accepted_by_donor_id !== donor.donor_id && b.accepted_by_donor_id === donor.donor_id) return 1;
        return a.distance_km - b.distance_km;
      });

      const donations = await SupabaseService.getDonations(donor.donor_id);

      return res.json({
        success: true,
        donor: { ...donor, medical_eligibility: eligibility },
        stats: {
          total_donations: donations.length,
          nearby_requests_count: nearbyRequests.length,
          is_available: Boolean(donor.availability),
          is_medically_eligible: eligibility.isEligible
        },
        nearby_requests: nearbyRequests.slice(0, 15)
      });
    }

    const donor = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(userId);
    if (!donor) {
      return res.status(404).json({ success: false, message: 'Donor profile not found.' });
    }

    const eligibility = checkMedicalEligibility(donor.last_donation_date);

    const candidateRequests = db.prepare(`
      SELECT r.*, u.name as requester_name, u.phone as requester_phone
      FROM blood_requests r
      JOIN users u ON r.requester_id = u.user_id
      WHERE r.status = 'open' 
         OR (r.status = 'matched' AND r.accepted_by_donor_id = ?)
         OR r.target_donor_id = ?
    `).all(donor.donor_id, donor.donor_id);

    const nearbyRequests = [];
    for (const reqItem of candidateRequests) {
      const isDirect = reqItem.target_donor_id === donor.donor_id;
      const isAccepted = reqItem.accepted_by_donor_id === donor.donor_id;
      const isOpenCompatible = reqItem.status === 'open' && (reqItem.blood_group === donor.blood_group || isBloodCompatible(donor.blood_group, reqItem.blood_group));

      if (isDirect || isAccepted || isOpenCompatible) {
        const dist = haversineDistance(donor.latitude, donor.longitude, reqItem.latitude, reqItem.longitude);
        nearbyRequests.push({
          ...reqItem,
          distance_km: dist,
          is_direct_request: isDirect
        });
      }
    }

    nearbyRequests.sort((a, b) => {
      if (a.is_direct_request && !b.is_direct_request) return -1;
      if (!a.is_direct_request && b.is_direct_request) return 1;
      if (a.accepted_by_donor_id === donor.donor_id && b.accepted_by_donor_id !== donor.donor_id) return -1;
      if (a.accepted_by_donor_id !== donor.donor_id && b.accepted_by_donor_id === donor.donor_id) return 1;
      return a.distance_km - b.distance_km;
    });

    const donationCount = db.prepare('SELECT COUNT(*) as count FROM donations WHERE donor_id = ?').get(donor.donor_id).count;

    return res.json({
      success: true,
      donor: { ...donor, medical_eligibility: eligibility },
      stats: {
        total_donations: donationCount,
        nearby_requests_count: nearbyRequests.length,
        is_available: donor.availability === 1,
        is_medically_eligible: eligibility.isEligible
      },
      nearby_requests: nearbyRequests.slice(0, 15)
    });
  } catch (err) {
    console.error('Donor dashboard stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch dashboard stats.' });
  }
}

module.exports = {
  searchDonors,
  getNearbyDonors,
  getAllDonors,
  toggleAvailability,
  updateDonorProfile,
  getDonorDashboardStats
};
