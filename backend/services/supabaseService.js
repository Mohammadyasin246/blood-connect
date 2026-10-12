const { supabaseAdmin, supabaseClient } = require('../config/supabase');

function getClient() {
  const client = supabaseAdmin || supabaseClient;
  if (!client) {
    throw new Error('Supabase client is not configured. Check your SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  }
  return client;
}

const SupabaseService = {
  // ==========================================
  // USERS & AUTHENTICATION
  // ==========================================
  async findUserByEmail(email) {
    const client = getClient();
    const { data, error } = await client
      .from('users')
      .select('*')
      .ilike('email', email.trim().toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found" in PostgREST
      console.error('Supabase findUserByEmail error:', error);
      throw error;
    }
    return data || null;
  },

  async findUserByIdentifier(identifier) {
    const client = getClient();
    const clean = identifier.trim().toLowerCase();

    // Try email first
    const { data: userByEmail } = await client
      .from('users')
      .select('*')
      .ilike('email', clean)
      .single();

    if (userByEmail) return userByEmail;

    // Try phone
    const { data: userByPhone } = await client
      .from('users')
      .select('*')
      .eq('phone', identifier.trim())
      .single();

    return userByPhone || null;
  },

  async findUserById(userId) {
    const client = getClient();
    const { data, error } = await client
      .from('users')
      .select('user_id, name, email, phone, role, is_active, created_at')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async createUser({ name, email, phone, password_hash, role = 'donor' }) {
    const client = getClient();
    const { data, error } = await client
      .from('users')
      .insert({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password_hash,
        role: role || 'donor',
        is_active: true
      })
      .select('user_id, name, email, phone, role, created_at')
      .single();

    if (error) {
      console.error('Supabase createUser error:', error);
      throw error;
    }
    return data;
  },

  async toggleUserStatus(userId, isActive) {
    const client = getClient();
    const { data, error } = await client
      .from('users')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('user_id, is_active')
      .single();

    if (error) throw error;
    return data;
  },

  async getUsers(role = null, search = '') {
    const client = getClient();
    let query = client
      .from('users')
      .select(`
        user_id,
        name,
        email,
        phone,
        role,
        is_active,
        created_at,
        donors (
          blood_group,
          city,
          area,
          availability,
          is_verified,
          total_donations
        )
      `)
      .order('created_at', { ascending: false });

    if (role && role !== 'ALL') {
      query = query.eq('role', role);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Flatten donor array into single properties for backward compatibility
    return (data || []).map(u => {
      const donor = Array.isArray(u.donors) && u.donors.length > 0 ? u.donors[0] : null;
      return {
        user_id: u.user_id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        is_active: u.is_active ? 1 : 0,
        created_at: u.created_at,
        blood_group: donor ? donor.blood_group : null,
        city: donor ? donor.city : null,
        area: donor ? donor.area : null,
        availability: donor ? (donor.availability ? 1 : 0) : null,
        is_verified: donor ? (donor.is_verified ? 1 : 0) : null,
        total_donations: donor ? donor.total_donations : 0
      };
    });
  },

  // ==========================================
  // DONORS
  // ==========================================
  async findDonorByUserId(userId) {
    const client = getClient();
    const { data, error } = await client
      .from('donors')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async findDonorById(donorId) {
    const client = getClient();
    const { data, error } = await client
      .from('donors')
      .select('*')
      .eq('donor_id', donorId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  async createDonor(donorData) {
    const client = getClient();
    const { data, error } = await client
      .from('donors')
      .insert({
        user_id: donorData.user_id,
        blood_group: donorData.blood_group,
        gender: donorData.gender || 'other',
        date_of_birth: donorData.date_of_birth || null,
        city: donorData.city || 'Hyderabad',
        area: donorData.area || 'Lingampally',
        latitude: parseFloat(donorData.latitude) || 17.4938,
        longitude: parseFloat(donorData.longitude) || 78.3188,
        last_donation_date: donorData.last_donation_date || null,
        availability: donorData.availability !== undefined ? Boolean(donorData.availability) : true,
        total_donations: donorData.total_donations || 0,
        is_verified: donorData.is_verified !== undefined ? Boolean(donorData.is_verified) : true
      })
      .select('*')
      .single();

    if (error) {
      console.error('Supabase createDonor error:', error);
      throw error;
    }
    return data;
  },

  async getAllDonors(requireAvailableOnly = false) {
    const client = getClient();
    let query = client
      .from('donors')
      .select(`
        donor_id,
        user_id,
        blood_group,
        gender,
        date_of_birth,
        city,
        area,
        latitude,
        longitude,
        last_donation_date,
        availability,
        total_donations,
        is_verified,
        created_at,
        users!inner (
          name,
          email,
          phone,
          is_active
        )
      `)
      .eq('users.is_active', true)
      .eq('is_verified', true)
      .order('created_at', { ascending: false });

    if (requireAvailableOnly) {
      query = query.eq('availability', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(d => ({
      donor_id: d.donor_id,
      user_id: d.user_id,
      name: d.users?.name || 'Anonymous',
      email: d.users?.email || '',
      phone: d.users?.phone || '',
      blood_group: d.blood_group,
      gender: d.gender,
      city: d.city,
      area: d.area,
      latitude: d.latitude,
      longitude: d.longitude,
      last_donation_date: d.last_donation_date,
      availability: d.availability ? 1 : 0,
      total_donations: d.total_donations,
      is_verified: d.is_verified ? 1 : 0,
      created_at: d.created_at
    }));
  },

  async updateDonorAvailability(donorId, availability) {
    const client = getClient();
    const { data, error } = await client
      .from('donors')
      .update({
        availability: Boolean(availability),
        updated_at: new Date().toISOString()
      })
      .eq('donor_id', donorId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async updateDonorProfile(donorId, updates) {
    const client = getClient();
    const payload = { ...updates, updated_at: new Date().toISOString() };
    const { data, error } = await client
      .from('donors')
      .update(payload)
      .eq('donor_id', donorId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async toggleDonorVerification(donorId, isVerified) {
    const client = getClient();
    const { data, error } = await client
      .from('donors')
      .update({
        is_verified: Boolean(isVerified),
        updated_at: new Date().toISOString()
      })
      .eq('donor_id', donorId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  // ==========================================
  // BLOOD REQUESTS
  // ==========================================
  async createRequest(reqData) {
    const client = getClient();
    const { data, error } = await client
      .from('blood_requests')
      .insert({
        requester_id: reqData.requester_id,
        patient_name: reqData.patient_name.trim(),
        blood_group: reqData.blood_group,
        units_required: parseInt(reqData.units_required, 10) || 1,
        hospital: reqData.hospital.trim(),
        city: reqData.city || 'Hyderabad',
        area: reqData.area || 'Lingampally',
        latitude: parseFloat(reqData.latitude) || 17.4938,
        longitude: parseFloat(reqData.longitude) || 78.3188,
        required_date: reqData.required_date,
        urgency: reqData.urgency || 'normal',
        status: 'open',
        additional_notes: reqData.additional_notes || null,
        target_donor_id: reqData.target_donor_id ? parseInt(reqData.target_donor_id, 10) : null
      })
      .select('*')
      .single();

    if (error) {
      console.error('Supabase createRequest error:', error);
      throw error;
    }
    return data;
  },

  async getAllRequests(filters = {}) {
    const client = getClient();
    let query = client
      .from('blood_requests')
      .select(`
        *,
        requester:users!blood_requests_requester_id_fkey(name, email, phone),
        accepted_donor:donors!blood_requests_accepted_by_donor_id_fkey(
          donor_id,
          user_id,
          blood_group,
          users(name, phone)
        )
      `)
      .order('created_at', { ascending: false });

    if (filters.requester_id) {
      query = query.eq('requester_id', filters.requester_id);
    }
    if (filters.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }
    if (filters.blood_group && filters.blood_group !== 'ALL') {
      query = query.eq('blood_group', filters.blood_group);
    }
    if (filters.urgency && filters.urgency !== 'ALL') {
      query = query.eq('urgency', filters.urgency);
    }
    if (filters.city) {
      query = query.ilike('city', filters.city);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(r => ({
      ...r,
      requester_name: r.requester?.name || 'Anonymous',
      requester_phone: r.requester?.phone || '',
      requester_email: r.requester?.email || '',
      accepted_donor_user_id: r.accepted_donor?.user_id || null,
      accepted_donor_name: r.accepted_donor?.users?.name || null,
      accepted_donor_phone: r.accepted_donor?.users?.phone || null
    }));
  },

  async getRequestById(requestId) {
    const client = getClient();
    const { data, error } = await client
      .from('blood_requests')
      .select(`
        *,
        requester:users!blood_requests_requester_id_fkey(name, email, phone),
        accepted_donor:donors!blood_requests_accepted_by_donor_id_fkey(
          donor_id,
          user_id,
          blood_group,
          users(name, phone)
        )
      `)
      .eq('request_id', requestId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      ...data,
      requester_name: data.requester?.name || 'Anonymous',
      requester_phone: data.requester?.phone || '',
      requester_email: data.requester?.email || '',
      accepted_donor_user_id: data.accepted_donor?.user_id || null,
      accepted_donor_name: data.accepted_donor?.users?.name || null,
      accepted_donor_phone: data.accepted_donor?.users?.phone || null
    };
  },

  async acceptRequest(requestId, donorId) {
    const client = getClient();
    const { data, error } = await client
      .from('blood_requests')
      .update({
        status: 'matched',
        accepted_by_donor_id: donorId,
        updated_at: new Date().toISOString()
      })
      .eq('request_id', requestId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async declineRequest(requestId) {
    const client = getClient();
    const { data, error } = await client
      .from('blood_requests')
      .update({
        status: 'open',
        accepted_by_donor_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('request_id', requestId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async completeRequest(requestId, donorId, units, certId, notes, hospitalName, bloodGroup) {
    const client = getClient();

    // 1. Update request to completed
    const { data: updatedRequest, error: reqErr } = await client
      .from('blood_requests')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('request_id', requestId)
      .select('*')
      .single();

    if (reqErr) throw reqErr;

    // 2. Insert donation history record
    const { error: donErr } = await client
      .from('donations')
      .insert({
        donor_id: donorId,
        request_id: requestId,
        hospital_name: hospitalName,
        blood_group: bloodGroup,
        units: units || 1,
        donation_date: new Date().toISOString().split('T')[0],
        status: 'completed',
        certificate_id: certId,
        notes: notes || 'Completed successfully'
      });

    if (donErr) throw donErr;

    // 3. Update donor total donations and last donation date
    const { data: donor } = await client
      .from('donors')
      .select('total_donations')
      .eq('donor_id', donorId)
      .single();

    const newTotal = (donor ? donor.total_donations : 0) + 1;
    await client
      .from('donors')
      .update({
        total_donations: newTotal,
        last_donation_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      })
      .eq('donor_id', donorId);

    return updatedRequest;
  },

  // ==========================================
  // DONATIONS & CERTIFICATES
  // ==========================================
  async getDonations(donorId = null) {
    const client = getClient();
    let query = client
      .from('donations')
      .select(`
        *,
        donors!inner (
          blood_group,
          users!inner (name, email)
        )
      `)
      .order('donation_date', { ascending: false });

    if (donorId) {
      query = query.eq('donor_id', donorId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(d => ({
      donation_id: d.donation_id,
      donor_id: d.donor_id,
      request_id: d.request_id,
      hospital_name: d.hospital_name,
      blood_group: d.blood_group,
      units: d.units,
      donation_date: d.donation_date,
      status: d.status,
      certificate_id: d.certificate_id,
      notes: d.notes,
      created_at: d.created_at,
      donor_name: d.donors?.users?.name || 'Anonymous Donor',
      donor_email: d.donors?.users?.email || ''
    }));
  },

  async getCertificate(certId) {
    const client = getClient();
    const { data, error } = await client
      .from('donations')
      .select(`
        *,
        donors!inner (
          blood_group,
          city,
          users!inner (name, email, phone)
        )
      `)
      .eq('certificate_id', certId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return null;

    return {
      certificate_id: data.certificate_id,
      donor_name: data.donors?.users?.name || 'Anonymous',
      blood_group: data.donors?.blood_group || data.blood_group,
      units: data.units,
      hospital_name: data.hospital_name,
      donation_date: data.donation_date,
      donor_city: data.donors?.city || 'Hyderabad',
      issued_by: 'National Blood Transfusion Council & BloodConnect India',
      verification_status: 'Official Verified Record'
    };
  },

  // ==========================================
  // NOTIFICATIONS
  // ==========================================
  async getNotifications(userId) {
    const client = getClient();
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) throw error;
    return data || [];
  },

  async getUnreadNotificationCount(userId) {
    const client = getClient();
    const { count, error } = await client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) return 0;
    return count || 0;
  },

  async markNotificationAsRead(notificationId, userId) {
    const client = getClient();
    const { data, error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('notification_id', notificationId)
      .eq('user_id', userId)
      .select('*');

    if (error) throw error;
    return data;
  },

  async markAllNotificationsAsRead(userId) {
    const client = getClient();
    const { data, error } = await client
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .select('*');

    if (error) throw error;
    return data;
  },

  async createNotification({ userId, requestId = null, title, message, type = 'request' }) {
    const client = getClient();
    const { data, error } = await client
      .from('notifications')
      .insert({
        user_id: userId,
        request_id: requestId,
        title,
        message,
        type: type || 'request',
        is_read: false
      })
      .select('*')
      .single();

    if (error) {
      console.error('Supabase createNotification error:', error);
      return { success: false, error: error.message };
    }
    return { success: true, notification: data };
  },

  // ==========================================
  // HOSPITALS
  // ==========================================
  async getAllHospitals() {
    const client = getClient();
    const { data, error } = await client
      .from('hospitals')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createHospital(hospitalData) {
    const client = getClient();
    const { data, error } = await client
      .from('hospitals')
      .insert({
        name: hospitalData.name.trim(),
        city: hospitalData.city.trim(),
        area: hospitalData.area || hospitalData.city,
        address: hospitalData.address.trim(),
        latitude: parseFloat(hospitalData.latitude) || 17.4938,
        longitude: parseFloat(hospitalData.longitude) || 78.3188,
        phone: hospitalData.phone.trim(),
        emergency_contact: hospitalData.emergency_contact || '108',
        blood_bank_available: hospitalData.blood_bank_available !== undefined ? Boolean(hospitalData.blood_bank_available) : true
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  // ==========================================
  // ADMIN DASHBOARD STATS
  // ==========================================
  async getDashboardStats() {
    const client = getClient();

    const [
      usersCountRes,
      donorsCountRes,
      activeRequestsRes,
      completedRequestsRes,
      donationsRes,
      donorsListRes,
      requestsListRes
    ] = await Promise.all([
      client.from('users').select('*', { count: 'exact', head: true }),
      client.from('donors').select('*', { count: 'exact', head: true }),
      client.from('blood_requests').select('*', { count: 'exact', head: true }).in('status', ['open', 'matched', 'in_progress']),
      client.from('blood_requests').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      client.from('donations').select('units'),
      client.from('donors').select('blood_group, donor_id, user_id, city, area, created_at, users(name, email, phone)').order('created_at', { ascending: false }).limit(5),
      client.from('blood_requests').select('*, users(name)').order('created_at', { ascending: false }).limit(5)
    ]);

    const totalDonationsCount = donationsRes.data ? donationsRes.data.length : 0;
    const totalUnitsCollected = (donationsRes.data || []).reduce((acc, curr) => acc + (curr.units || 1), 0);

    // Group donors by blood group
    const { data: allDonorsBg } = await client.from('donors').select('blood_group');
    const bgMap = {};
    (allDonorsBg || []).forEach(d => {
      bgMap[d.blood_group] = (bgMap[d.blood_group] || 0) + 1;
    });
    const bloodGroupDistribution = Object.keys(bgMap).map(bg => ({
      blood_group: bg,
      count: bgMap[bg]
    }));

    // Group requests by urgency
    const { data: allReqsUrgency } = await client.from('blood_requests').select('urgency');
    const urgencyMap = {};
    (allReqsUrgency || []).forEach(r => {
      urgencyMap[r.urgency] = (urgencyMap[r.urgency] || 0) + 1;
    });
    const urgencyBreakdown = Object.keys(urgencyMap).map(u => ({
      urgency: u,
      count: urgencyMap[u]
    }));

    const recentDonors = (donorsListRes.data || []).map(d => ({
      ...d,
      name: d.users?.name,
      email: d.users?.email,
      phone: d.users?.phone
    }));

    const recentRequests = (requestsListRes.data || []).map(r => ({
      ...r,
      requester_name: r.users?.name
    }));

    return {
      stats: {
        total_users: usersCountRes.count || 0,
        total_donors: donorsCountRes.count || 0,
        active_requests: activeRequestsRes.count || 0,
        completed_requests: completedRequestsRes.count || 0,
        total_donations_count: totalDonationsCount,
        total_units_collected: totalUnitsCollected
      },
      blood_group_distribution: bloodGroupDistribution,
      urgency_breakdown: urgencyBreakdown,
      recent_requests: recentRequests,
      recent_donors: recentDonors
    };
  }
};

module.exports = SupabaseService;
