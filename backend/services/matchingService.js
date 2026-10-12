/**
 * BloodConnect Matching Engine & Distance Calculator
 * Implements:
 * 1. Haversine Formula for Great Circle Distance on Sphere
 * 2. Medical ABO/Rh Blood Compatibility Matrix
 * 3. 90-Day Safe Donation Eligibility Interval Rule
 * 4. Multi-factor donor ranking
 */

const EARTH_RADIUS_KM = 6371; // WGS84 Mean Earth radius in kilometers

// Recipient blood group -> Compatible donor blood groups
const RECIPIENT_CAN_RECEIVE_FROM = {
  'O-': ['O-'],
  'O+': ['O+', 'O-'],
  'A-': ['A-', 'O-'],
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'AB-': ['AB-', 'A-', 'B-', 'O-'],
  'AB+': ['AB+', 'AB-', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-']
};

// Donor blood group -> Compatible recipient blood groups
const DONOR_CAN_DONATE_TO = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'], // Universal donor
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+'] // Can only donate to AB+
};

/**
 * Converts degree to radian
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates Great-Circle Distance using the Haversine Formula
 * Formula:
 * d = 2 * R * asin( sqrt( sin^2(Δlat/2) + cos(lat1)*cos(lat2)*sin^2(Δlon/2) ) )
 * 
 * @param {number} lat1 Latitude of point 1 in degrees
 * @param {number} lon1 Longitude of point 1 in degrees
 * @param {number} lat2 Latitude of point 2 in degrees
 * @param {number} lon2 Longitude of point 2 in degrees
 * @returns {number} Distance in kilometers (rounded to 1 decimal place)
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) {
    return 0;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 10) / 10;
}

/**
 * Check if donor blood group is compatible with recipient blood group
 */
function isBloodCompatible(donorBloodGroup, recipientBloodGroup) {
  const allowed = RECIPIENT_CAN_RECEIVE_FROM[recipientBloodGroup];
  return allowed ? allowed.includes(donorBloodGroup) : false;
}

/**
 * Check medical eligibility based on 90-day safe donation interval
 */
function checkMedicalEligibility(lastDonationDateStr) {
  if (!lastDonationDateStr) {
    return { isEligible: true, daysSince: 999, daysRemaining: 0 };
  }

  const lastDate = new Date(lastDonationDateStr);
  const today = new Date();
  const diffTime = today.getTime() - lastDate.getTime();
  const daysSince = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const SAFE_INTERVAL_DAYS = 90;
  const isEligible = daysSince >= SAFE_INTERVAL_DAYS;
  const daysRemaining = isEligible ? 0 : SAFE_INTERVAL_DAYS - daysSince;

  return { isEligible, daysSince, daysRemaining };
}

/**
 * Find matching donors for a blood request
 * Filters by compatibility, availability, and geographic radius
 */
function matchDonorsForRequest(dbOrDonors, request, maxRadiusKm = 25, exactOnly = false) {
  let donors = [];
  if (Array.isArray(dbOrDonors)) {
    donors = dbOrDonors;
  } else if (dbOrDonors && typeof dbOrDonors.prepare === 'function') {
    donors = dbOrDonors.prepare(`
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
        d.is_verified
      FROM donors d
      JOIN users u ON d.user_id = u.user_id
      WHERE u.is_active = 1 AND d.is_verified = 1
    `).all();
  }

  const matched = [];

  for (const donor of donors) {
    // 1. Blood compatibility check
    let compatible = false;
    let matchType = 'compatible';

    if (donor.blood_group === request.blood_group) {
      compatible = true;
      matchType = 'exact';
    } else if (!exactOnly && isBloodCompatible(donor.blood_group, request.blood_group)) {
      compatible = true;
      matchType = 'compatible';
    }

    if (!compatible) continue;

    // 2. Calculate distance using Haversine
    const distance = haversineDistance(
      request.latitude,
      request.longitude,
      donor.latitude,
      donor.longitude
    );

    // 3. Filter by radius if specified
    if (maxRadiusKm && distance > maxRadiusKm) continue;

    // 4. Medical eligibility
    const eligibility = checkMedicalEligibility(donor.last_donation_date);

    // 5. Ranking score computation
    // Prioritize: Available (50 pts) + Exact match (30 pts) + Distance proximity (up to 20 pts)
    let score = 0;
    if (donor.availability === 1) score += 50;
    if (matchType === 'exact') score += 30;
    if (eligibility.isEligible) score += 10;
    const distanceBonus = Math.max(0, 20 - distance);
    score += distanceBonus;

    matched.push({
      donor_id: donor.donor_id,
      user_id: donor.user_id,
      name: donor.name,
      // For privacy, mask phone number unless authorized or mediate through app
      phone_masked: donor.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
      blood_group: donor.blood_group,
      gender: donor.gender,
      city: donor.city,
      area: donor.area,
      latitude: donor.latitude,
      longitude: donor.longitude,
      availability: donor.availability === 1,
      total_donations: donor.total_donations,
      distance_km: distance,
      match_type: matchType,
      is_eligible: eligibility.isEligible,
      days_since_last_donation: eligibility.daysSince,
      score: Math.round(score)
    });
  }

  // Sort by score (descending) and distance (ascending)
  matched.sort((a, b) => {
    if (a.availability !== b.availability) return b.availability ? 1 : -1;
    if (a.distance_km !== b.distance_km) return a.distance_km - b.distance_km;
    return b.score - a.score;
  });

  return matched;
}

module.exports = {
  haversineDistance,
  isBloodCompatible,
  checkMedicalEligibility,
  matchDonorsForRequest,
  RECIPIENT_CAN_RECEIVE_FROM,
  DONOR_CAN_DONATE_TO,
  EARTH_RADIUS_KM
};
