import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 100,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // less than 1% errors
    http_req_duration: ['p(95)<300'], // 95% of requests under 300ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:5000';

export default function () {
  // 1. Health check
  const resHealth = http.get(`${BASE_URL}/api/health`);
  check(resHealth, {
    'Health Check status 200': (r) => r.status === 200,
    'App name is BloodConnect': (r) => r.body.includes('BloodConnect'),
  });

  // 2. Web Frontend Single Page Application
  const resWeb = http.get(`${BASE_URL}/`);
  check(resWeb, {
    'Web Frontend responds with 200': (r) => r.status === 200,
  });

  // 3. Nearby Donor Proximity Query
  const resNearby = http.get(`${BASE_URL}/api/donors/nearby?lat=12.9716&lng=77.5946&radius=25`);
  check(resNearby, {
    'Nearby Donors Query status 200 or 401': (r) => r.status === 200 || r.status === 401 || r.status === 403,
  });

  // 4. Blood Requests Feed
  const resReqs = http.get(`${BASE_URL}/api/requests`);
  check(resReqs, {
    'Requests Feed status 200 or 401': (r) => r.status === 200 || r.status === 401 || r.status === 403,
  });

  sleep(1);
}
