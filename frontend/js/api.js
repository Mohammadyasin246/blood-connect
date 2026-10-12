/**
 * BloodConnect — Centralized Frontend API Client
 */

const API_BASE = '/api';

const API = {
  getToken() {
    return localStorage.getItem('bc_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('bc_token', token);
    } else {
      localStorage.removeItem('bc_token');
    }
  },

  getUser() {
    try {
      const u = localStorage.getItem('bc_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem('bc_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('bc_user');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  },

  post(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  patch(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  },

  put(endpoint, body = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  // Auth Endpoints
  auth: {
    login(credentials) {
      return API.post('/auth/login', credentials);
    },
    adminLogin(credentials) {
      return API.post('/auth/admin-login', credentials);
    },
    register(userData) {
      return API.post('/auth/register', userData);
    },
    getMe() {
      return API.get('/auth/me');
    },
    logout() {
      API.setToken(null);
      API.setUser(null);
      localStorage.removeItem('bc_donor');
    }
  },

  // Donors Endpoints
  donors: {
    search(params) {
      return API.get('/donors/search', params);
    },
    getAll() {
      return API.get('/donors');
    },
    toggleAvailability(availability) {
      return API.patch('/donors/availability', { availability });
    },
    updateProfile(data) {
      return API.put('/donors/profile', data);
    },
    getDashboardStats() {
      return API.get('/donors/dashboard-stats');
    }
  },

  // Blood Requests Endpoints
  requests: {
    create(data) {
      return API.post('/requests', data);
    },
    getAll(params = {}) {
      return API.get('/requests', params);
    },
    getById(id) {
      return API.get(`/requests/${id}`);
    },
    accept(id) {
      return API.post(`/requests/${id}/accept`);
    },
    decline(id) {
      return API.post(`/requests/${id}/decline`);
    },
    complete(id, data = {}) {
      return API.post(`/requests/${id}/complete`, data);
    }
  },

  // Donations Endpoints
  donations: {
    getHistory() {
      return API.get('/donations');
    },
    getCertificate(certId) {
      return API.get(`/donations/certificate/${certId}`);
    }
  },

  // Admin Endpoints
  admin: {
    getStats() {
      return API.get('/admin/stats');
    },
    getUsers(params = {}) {
      return API.get('/admin/users', params);
    },
    toggleUserStatus(id) {
      return API.patch(`/admin/users/${id}/status`);
    },
    toggleDonorVerification(id) {
      return API.patch(`/admin/donors/${id}/verify`);
    },
    getHospitals() {
      return API.get('/admin/hospitals');
    },
    addHospital(data) {
      return API.post('/admin/hospitals', data);
    }
  },

  // Notifications Endpoints
  notifications: {
    getAll() {
      return API.get('/notifications');
    },
    markRead(id) {
      return API.patch(`/notifications/${id}/read`);
    },
    markAllRead() {
      return API.post('/notifications/mark-all-read');
    }
  }
};

window.API = API;
