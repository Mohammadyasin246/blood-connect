const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { isSupabaseConfigured } = require('../config/supabase');
const SupabaseService = require('../services/supabaseService');
const { matchDonorsForRequest } = require('../services/matchingService');
const { notifyMatchingDonors, createNotification } = require('../services/notificationService');
const { JWT_SECRET } = require('../middleware/auth');

// POST /api/requests
async function createRequest(req, res) {
  try {
    let requesterId = req.user ? req.user.user_id : null;
    let autoAuthToken = null;
    let autoAuthUser = null;
    const {
      patient_name,
      blood_group,
      units_required = 1,
      hospital,
      city = 'Hyderabad',
      area = 'Lingampally',
      latitude,
      longitude,
      required_date,
      urgency = 'normal',
      additional_notes,
      target_donor_id
    } = req.body;

    if (!patient_name || !blood_group || !hospital || !required_date) {
      return res.status(400).json({
        success: false,
        message: 'Patient name, blood group, hospital, and required date are mandatory.'
      });
    }

    const lat = latitude ? parseFloat(latitude) : 17.4938;
    const lon = longitude ? parseFloat(longitude) : 78.3188;
    const parsedTargetDonorId = target_donor_id ? parseInt(target_donor_id, 10) : null;

    if (!requesterId) {
      const contactName = (req.body.contact_name || req.body.patient_name || 'Emergency Recipient').trim();
      const contactPhone = (req.body.contact_phone || '+91 98765 00000').trim();
      const contactEmail = (req.body.contact_email || `recipient_${Date.now()}@bloodconnect.org`).toLowerCase().trim();

      if (isSupabaseConfigured()) {
        let existingUser = await SupabaseService.findUserByEmail(contactEmail);
        if (!existingUser) {
          const salt = bcrypt.genSaltSync(10);
          const passHash = bcrypt.hashSync('recipient123', salt);
          existingUser = await SupabaseService.createUser({
            name: contactName,
            email: contactEmail,
            phone: contactPhone,
            password_hash: passHash,
            role: 'recipient'
          });
        }
        requesterId = existingUser.user_id;
        autoAuthUser = existingUser;
        autoAuthToken = jwt.sign({ user_id: existingUser.user_id, role: 'recipient', email: existingUser.email }, JWT_SECRET, { expiresIn: '7d' });
      } else {
        let existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(contactEmail);
        if (!existingUser) {
          const salt = bcrypt.genSaltSync(10);
          const passHash = bcrypt.hashSync('recipient123', salt);
          const info = db.prepare(`
            INSERT INTO users (name, email, phone, password_hash, role)
            VALUES (?, ?, ?, ?, 'recipient')
          `).run(contactName, contactEmail, contactPhone, passHash);
          existingUser = db.prepare('SELECT * FROM users WHERE user_id = ?').get(info.lastInsertRowid);
        }
        requesterId = existingUser.user_id;
        autoAuthUser = existingUser;
        autoAuthToken = jwt.sign({ user_id: existingUser.user_id, role: 'recipient', email: existingUser.email }, JWT_SECRET, { expiresIn: '7d' });
      }
    }

    if (isSupabaseConfigured()) {
      const request = await SupabaseService.createRequest({
        requester_id: requesterId,
        patient_name,
        blood_group,
        units_required,
        hospital,
        city,
        area,
        latitude: lat,
        longitude: lon,
        required_date,
        urgency,
        additional_notes,
        target_donor_id: parsedTargetDonorId
      });

      // If targeted to a specific donor, send direct notification to that donor immediately
      if (parsedTargetDonorId) {
        const targetDonor = await SupabaseService.findDonorById(parsedTargetDonorId);
        const requesterDisplayName = (req.user && req.user.name) || autoAuthUser?.name || req.body.contact_name || patient_name || 'A recipient';
        if (targetDonor) {
          await createNotification({
            userId: targetDonor.user_id,
            requestId: request.request_id,
            title: `🎯 Direct Blood Request: ${blood_group} Needed!`,
            message: `${requesterDisplayName} specifically requested you for ${patient_name} needing ${units_required} unit(s) of ${blood_group} blood at ${hospital}. Please accept to connect!`,
            type: 'emergency'
          });
        }
      }

      // Match donors using all active verified donors from Supabase
      const allDonors = await SupabaseService.getAllDonors(false);
      const matchedDonors = matchDonorsForRequest(allDonors, request, 25, false);

      // Notify matching donors (excluding target donor who already received direct alert)
      const otherDonors = parsedTargetDonorId ? matchedDonors.filter(d => d.donor_id !== parsedTargetDonorId) : matchedDonors;
      await notifyMatchingDonors(request, otherDonors);

      // Create confirmation notification for requester
      await createNotification({
        userId: requesterId,
        requestId: request.request_id,
        title: parsedTargetDonorId ? 'Direct Request Sent to Donor' : 'Blood Request Published Successfully',
        message: parsedTargetDonorId 
          ? `Your direct request for ${units_required} unit(s) of ${blood_group} blood has been sent directly to the selected donor.`
          : `Your request for ${units_required} unit(s) of ${blood_group} blood has been broadcast to ${matchedDonors.length} matching donors nearby.`,
        type: 'system'
      });

      return res.status(201).json({
        success: true,
        message: parsedTargetDonorId 
          ? 'Direct request sent to donor account!'
          : 'Blood request created and broadcasted to matching donors on Supabase.',
        request,
        matched_donors_count: matchedDonors.length,
        nearest_donors: matchedDonors.slice(0, 5)
      });
    }

    // SQLite Fallback
    const stmt = db.prepare(`
      INSERT INTO blood_requests (
        requester_id, patient_name, blood_group, units_required,
        hospital, city, area, latitude, longitude,
        required_date, urgency, status, additional_notes, target_donor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)
    `);

    const result = stmt.run(
      requesterId,
      patient_name.trim(),
      blood_group,
      parseInt(units_required, 10) || 1,
      hospital.trim(),
      city,
      area,
      lat,
      lon,
      required_date,
      urgency,
      additional_notes || null,
      parsedTargetDonorId
    );

    const requestId = result.lastInsertRowid;
    const request = db.prepare('SELECT * FROM blood_requests WHERE request_id = ?').get(requestId);

    if (parsedTargetDonorId) {
      const targetDonor = db.prepare('SELECT * FROM donors WHERE donor_id = ?').get(parsedTargetDonorId);
      const requesterDisplayName = (req.user && req.user.name) || autoAuthUser?.name || req.body.contact_name || patient_name || 'A recipient';
      if (targetDonor) {
        await createNotification({
          userId: targetDonor.user_id,
          requestId: requestId,
          title: `🎯 Direct Blood Request: ${blood_group} Needed!`,
          message: `${requesterDisplayName} specifically requested you for ${patient_name} needing ${units_required} unit(s) of ${blood_group} blood at ${hospital}. Please accept to connect!`,
          type: 'emergency'
        });
      }
    }

    const matchedDonors = matchDonorsForRequest(db, request, 25, false);
    const otherDonors = parsedTargetDonorId ? matchedDonors.filter(d => d.donor_id !== parsedTargetDonorId) : matchedDonors;
    await notifyMatchingDonors(request, otherDonors);

    await createNotification({
      userId: requesterId,
      requestId: requestId,
      title: parsedTargetDonorId ? 'Direct Request Sent to Donor' : 'Blood Request Published Successfully',
      message: parsedTargetDonorId 
        ? `Your direct request for ${units_required} unit(s) of ${blood_group} blood has been sent directly to the selected donor.`
        : `Your request for ${units_required} unit(s) of ${blood_group} blood has been broadcast to ${matchedDonors.length} matching donors nearby.`,
      type: 'system'
    });

    return res.status(201).json({
      success: true,
      message: parsedTargetDonorId 
        ? 'Direct request sent to donor account!'
        : 'Blood request created and broadcasted to matching donors.',
      request,
      matched_donors_count: matchedDonors.length,
      nearest_donors: matchedDonors.slice(0, 5),
      token: autoAuthToken,
      user: autoAuthUser
    });
  } catch (err) {
    console.error('Create request error:', err);
    return res.status(500).json({ success: false, message: 'Failed to create blood request.' });
  }
}

// GET /api/requests
async function getAllRequests(req, res) {
  try {
    const { status, blood_group, urgency, city, my_requests } = req.query;

    if (isSupabaseConfigured()) {
      const filters = {};
      if (my_requests === 'true' && req.user) filters.requester_id = req.user.user_id;
      if (status && status !== 'ALL') filters.status = status;
      if (blood_group && blood_group !== 'ALL') filters.blood_group = blood_group.trim().replace(/\s+/g, '+');
      if (urgency && urgency !== 'ALL') filters.urgency = urgency;
      if (city) filters.city = city;

      const requests = await SupabaseService.getAllRequests(filters);
      return res.json({
        success: true,
        count: requests.length,
        requests
      });
    }

    let query = `
      SELECT 
        r.*,
        u.name as requester_name,
        u.phone as requester_phone,
        u.email as requester_email,
        d.user_id as accepted_donor_user_id,
        du.name as accepted_donor_name,
        du.phone as accepted_donor_phone
      FROM blood_requests r
      JOIN users u ON r.requester_id = u.user_id
      LEFT JOIN donors d ON r.accepted_by_donor_id = d.donor_id
      LEFT JOIN users du ON d.user_id = du.user_id
      WHERE 1=1
    `;

    const params = [];

    if (my_requests === 'true' && req.user) {
      query += ` AND r.requester_id = ?`;
      params.push(req.user.user_id);
    }

    if (status && status !== 'ALL') {
      query += ` AND r.status = ?`;
      params.push(status);
    }

    const normalizedBg = (blood_group || '').trim().replace(/\s+/g, '+');
    if (normalizedBg && normalizedBg !== 'ALL') {
      query += ` AND r.blood_group = ?`;
      params.push(normalizedBg);
    }

    if (urgency && urgency !== 'ALL') {
      query += ` AND r.urgency = ?`;
      params.push(urgency);
    }

    if (city) {
      query += ` AND LOWER(r.city) = LOWER(?)`;
      params.push(city);
    }

    query += ` ORDER BY CASE WHEN r.urgency = 'emergency' THEN 1 WHEN r.urgency = 'urgent' THEN 2 ELSE 3 END, r.created_at DESC`;

    const requests = db.prepare(query).all(...params);

    return res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (err) {
    console.error('Fetch requests error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch blood requests.' });
  }
}

// GET /api/requests/:id
async function getRequestById(req, res) {
  try {
    const requestId = req.params.id;

    if (isSupabaseConfigured()) {
      const request = await SupabaseService.getRequestById(requestId);
      if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

      const allDonors = await SupabaseService.getAllDonors(false);
      const matchedDonors = matchDonorsForRequest(allDonors, request, 30, false);

      return res.json({
        success: true,
        request,
        matched_donors: matchedDonors
      });
    }

    const request = db.prepare(`
      SELECT 
        r.*,
        u.name as requester_name,
        u.phone as requester_phone,
        u.email as requester_email,
        d.user_id as accepted_donor_user_id,
        du.name as accepted_donor_name,
        du.phone as accepted_donor_phone
      FROM blood_requests r
      JOIN users u ON r.requester_id = u.user_id
      LEFT JOIN donors d ON r.accepted_by_donor_id = d.donor_id
      LEFT JOIN users du ON d.user_id = du.user_id
      WHERE r.request_id = ?
    `).get(requestId);

    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const matchedDonors = matchDonorsForRequest(db, request, 30, false);

    return res.json({
      success: true,
      request,
      matched_donors: matchedDonors
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch request details.' });
  }
}

// POST /api/requests/:id/accept
async function acceptRequest(req, res) {
  try {
    const requestId = req.params.id;
    const userId = req.user.user_id;

    if (isSupabaseConfigured()) {
      const donor = await SupabaseService.findDonorByUserId(userId);
      if (!donor) {
        return res.status(403).json({ success: false, message: 'Only registered donors can accept blood requests.' });
      }

      const request = await SupabaseService.getRequestById(requestId);
      if (!request) {
        return res.status(404).json({ success: false, message: 'Blood request not found.' });
      }

      if (request.status === 'completed' || request.status === 'cancelled') {
        return res.status(400).json({ success: false, message: `Cannot accept request with status: ${request.status}` });
      }

      const updated = await SupabaseService.acceptRequest(requestId, donor.donor_id);

      await createNotification({
        userId: request.requester_id,
        requestId: requestId,
        title: '🩸 Donor Accepted Your Request!',
        message: `${req.user.name} (${donor.blood_group}) has accepted your blood request for ${request.patient_name} at ${request.hospital}.`,
        type: 'acceptance'
      });

      await createNotification({
        userId: userId,
        requestId: requestId,
        title: '✅ Request Accepted',
        message: `You accepted blood request for ${request.patient_name} at ${request.hospital}. The hospital coordination team will assist you.`,
        type: 'system'
      });

      return res.json({
        success: true,
        message: 'You have successfully accepted the blood request! Thank you for saving a life.',
        request: updated
      });
    }

    const donor = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(userId);
    if (!donor) {
      return res.status(403).json({ success: false, message: 'Only registered donors can accept blood requests.' });
    }

    const request = db.prepare('SELECT * FROM blood_requests WHERE request_id = ?').get(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Blood request not found.' });
    }

    if (request.status === 'completed' || request.status === 'cancelled') {
      return res.status(400).json({ success: false, message: `Cannot accept request with status: ${request.status}` });
    }

    const acceptTx = db.transaction(() => {
      db.prepare(`
        UPDATE blood_requests 
        SET status = 'matched', accepted_by_donor_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE request_id = ?
      `).run(donor.donor_id, requestId);

      createNotification({
        userId: request.requester_id,
        requestId: requestId,
        title: '🩸 Donor Accepted Your Request!',
        message: `${req.user.name} (${donor.blood_group}) has accepted your blood request for ${request.patient_name} at ${request.hospital}.`,
        type: 'acceptance'
      });

      createNotification({
        userId: userId,
        requestId: requestId,
        title: '✅ Request Accepted',
        message: `You accepted blood request for ${request.patient_name} at ${request.hospital}. The hospital coordination team will assist you.`,
        type: 'system'
      });
    });

    acceptTx();

    const updated = db.prepare('SELECT * FROM blood_requests WHERE request_id = ?').get(requestId);

    return res.json({
      success: true,
      message: 'You have successfully accepted the blood request! Thank you for saving a life.',
      request: updated
    });
  } catch (err) {
    console.error('Accept request error:', err);
    return res.status(500).json({ success: false, message: 'Failed to accept blood request.' });
  }
}

// POST /api/requests/:id/decline
async function declineRequest(req, res) {
  try {
    const requestId = req.params.id;
    const userId = req.user.user_id;

    if (isSupabaseConfigured()) {
      const donor = await SupabaseService.findDonorByUserId(userId);
      const request = await SupabaseService.getRequestById(requestId);

      if (donor && request && request.accepted_by_donor_id === donor.donor_id) {
        await SupabaseService.declineRequest(requestId);
        await createNotification({
          userId: request.requester_id,
          requestId: requestId,
          title: 'Donor Unavailable',
          message: `The assigned donor is currently unavailable. Your request for ${request.blood_group} blood has been re-opened to other donors.`,
          type: 'request'
        });
      }

      return res.json({
        success: true,
        message: 'Request dismissed / declined successfully on Supabase.'
      });
    }

    const donor = db.prepare('SELECT * FROM donors WHERE user_id = ?').get(userId);
    const request = db.prepare('SELECT * FROM blood_requests WHERE request_id = ?').get(requestId);

    if (donor && request && request.accepted_by_donor_id === donor.donor_id) {
      db.prepare(`
        UPDATE blood_requests
        SET status = 'open', accepted_by_donor_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE request_id = ?
      `).run(requestId);

      createNotification({
        userId: request.requester_id,
        requestId: requestId,
        title: 'Donor Unavailable',
        message: `The assigned donor is currently unavailable. Your request for ${request.blood_group} blood has been re-opened to other donors.`,
        type: 'request'
      });
    }

    return res.json({
      success: true,
      message: 'Request dismissed / declined successfully.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to decline request.' });
  }
}

// POST /api/requests/:id/complete
async function completeRequest(req, res) {
  try {
    const requestId = req.params.id;
    const { donor_id, units = 1, notes } = req.body;
    const certId = `BC-CERT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    if (isSupabaseConfigured()) {
      const request = await SupabaseService.getRequestById(requestId);
      if (!request) return res.status(404).json({ success: false, message: 'Request not found.' });

      const assignedDonorId = donor_id || request.accepted_by_donor_id;
      if (!assignedDonorId) {
        return res.status(400).json({ success: false, message: 'No donor associated with this request.' });
      }

      await SupabaseService.completeRequest(
        requestId,
        assignedDonorId,
        units,
        certId,
        notes,
        request.hospital,
        request.blood_group
      );

      const donorRecord = await SupabaseService.findDonorById(assignedDonorId);
      if (donorRecord) {
        await createNotification({
          userId: donorRecord.user_id,
          requestId: requestId,
          title: '🎉 Donation Verified & Certificate Ready!',
          message: `Your donation of ${units} unit(s) at ${request.hospital} has been verified! Certificate ID: ${certId}. You are a true lifesaver!`,
          type: 'system'
        });
      }

      return res.json({
        success: true,
        message: 'Donation marked as completed and verified on Supabase.',
        certificate_id: certId
      });
    }

    const request = db.prepare('SELECT * FROM blood_requests WHERE request_id = ?').get(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const assignedDonorId = donor_id || request.accepted_by_donor_id;
    if (!assignedDonorId) {
      return res.status(400).json({ success: false, message: 'No donor associated with this request.' });
    }

    const completeTx = db.transaction(() => {
      db.prepare(`UPDATE blood_requests SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE request_id = ?`).run(requestId);

      db.prepare(`
        INSERT INTO donations (donor_id, request_id, hospital_name, blood_group, units, donation_date, status, certificate_id, notes)
        VALUES (?, ?, ?, ?, ?, DATE('now'), 'completed', ?, ?)
      `).run(assignedDonorId, requestId, request.hospital, request.blood_group, units, certId, notes || 'Completed successfully');

      db.prepare(`
        UPDATE donors 
        SET total_donations = total_donations + 1,
            last_donation_date = DATE('now'),
            updated_at = CURRENT_TIMESTAMP
        WHERE donor_id = ?
      `).run(assignedDonorId);

      const donorUser = db.prepare('SELECT user_id FROM donors WHERE donor_id = ?').get(assignedDonorId);
      if (donorUser) {
        createNotification({
          userId: donorUser.user_id,
          requestId: requestId,
          title: '🎉 Donation Verified & Certificate Ready!',
          message: `Your donation of ${units} unit(s) at ${request.hospital} has been verified! Certificate ID: ${certId}. You are a true lifesaver!`,
          type: 'system'
        });
      }
    });

    completeTx();

    return res.json({
      success: true,
      message: 'Donation marked as completed and verified.',
      certificate_id: certId
    });
  } catch (err) {
    console.error('Complete request error:', err);
    return res.status(500).json({ success: false, message: 'Failed to complete blood donation.' });
  }
}

module.exports = {
  createRequest,
  getAllRequests,
  getRequestById,
  acceptRequest,
  declineRequest,
  completeRequest
};
