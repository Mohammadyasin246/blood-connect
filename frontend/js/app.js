/**
 * BloodConnect — Master Web Application Coordinator
 */

const App = {
  currentUser: null,
  currentDonor: null,
  activeView: 'welcome',

  async init() {
    this.setupSplashScreen();
    this.setupEventListeners();
    await this.restoreSession();
    this.setupNavigation();

    // Check URL hash for direct deep links e.g. /#admin, /#search, /#donor
    const hash = window.location.hash.replace('#', '');
    if (hash === 'admin' && (!this.currentUser || this.currentUser.role !== 'admin')) {
      this.switchView('welcome');
      this.openModal('modal-admin-login');
      this.showToast('🛡️ Administrator authentication required.', 'info');
    } else if (hash && document.getElementById(`view-${hash}`)) {
      this.switchView(hash);
    } else {
      this.switchView(this.currentUser ? (this.currentUser.role === 'admin' ? 'admin' : this.currentUser.role === 'donor' ? 'donor' : 'recipient') : 'welcome');
    }

    // Start background notification check
    this.checkNotifications();
    setInterval(() => this.checkNotifications(), 15000);
  },

  setupSplashScreen() {
    const splash = document.getElementById('splash-screen');
    const skipBtn = document.getElementById('btn-skip-splash');

    const dismissSplash = () => {
      if (splash) {
        splash.classList.add('hidden');
        setTimeout(() => splash.remove(), 700);
      }
    };

    if (skipBtn) {
      skipBtn.addEventListener('click', dismissSplash);
    }

    // Auto dismiss after 2.5 seconds
    setTimeout(dismissSplash, 2500);
  },

  async restoreSession() {
    const token = API.getToken();
    if (!token) {
      this.updateNavbarUserUI(null);
      return;
    }

    try {
      const data = await API.auth.getMe();
      if (data && data.user) {
        this.currentUser = data.user;
        this.currentDonor = data.donor || null;
        API.setUser(data.user);
        this.updateNavbarUserUI(data.user);
      }
    } catch (err) {
      console.warn('Session expired or invalid, clearing local session.');
      API.auth.logout();
      this.currentUser = null;
      this.currentDonor = null;
      this.updateNavbarUserUI(null);
    }
  },

  updateNavbarUserUI(user) {
    const userMenu = document.getElementById('nav-user-menu');
    const loginBtn = document.getElementById('nav-login-btn');
    const registerBtn = document.getElementById('nav-register-btn');
    const donorNavLink = document.getElementById('nav-link-donor');
    const recipientNavLink = document.getElementById('nav-link-recipient');
    const adminNavLink = document.getElementById('nav-link-admin');

    if (user) {
      if (userMenu) userMenu.style.display = 'flex';
      if (loginBtn) loginBtn.style.display = 'none';
      if (registerBtn) registerBtn.style.display = 'none';

      document.getElementById('nav-user-name').textContent = user.name.split(' ')[0];
      document.getElementById('nav-user-role').textContent = user.role;
      document.getElementById('nav-user-avatar').textContent = user.name.charAt(0);

      if (donorNavLink) donorNavLink.style.display = (user.role === 'donor' || user.role === 'admin') ? 'flex' : 'none';
      if (recipientNavLink) recipientNavLink.style.display = (user.role === 'recipient' || user.role === 'admin') ? 'flex' : 'none';
      if (adminNavLink) adminNavLink.style.display = user.role === 'admin' ? 'flex' : 'none';
    } else {
      if (userMenu) userMenu.style.display = 'none';
      if (loginBtn) loginBtn.style.display = 'inline-flex';
      if (registerBtn) registerBtn.style.display = 'inline-flex';
      if (donorNavLink) donorNavLink.style.display = 'none';
      if (recipientNavLink) recipientNavLink.style.display = 'none';
      if (adminNavLink) adminNavLink.style.display = 'none';
    }
  },

  setupNavigation() {
    document.querySelectorAll('[data-view-target]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-view-target');
        this.switchView(target);
      });
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) this.switchView(hash);
    });
  },

  switchView(viewName) {
    // SECURITY GUARD: Admin view requires active admin session
    if (viewName === 'admin' && (!this.currentUser || this.currentUser.role !== 'admin')) {
      this.showToast('🛡️ Administrator authentication required. Please log in.', 'error');
      this.openModal('modal-admin-login');
      const fallback = (this.activeView && this.activeView !== 'admin') ? this.activeView : 'welcome';
      window.location.hash = fallback;
      if (this.activeView !== fallback) {
        this.switchView(fallback);
      }
      return;
    }

    this.activeView = viewName;
    window.location.hash = viewName;

    // Hide all view containers
    document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));

    // Update active nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      if (link.getAttribute('data-view-target') === viewName) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Show selected view
    const targetEl = document.getElementById(`view-${viewName}`);
    if (targetEl) {
      targetEl.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Trigger view-specific loads
    if (viewName === 'donor') {
      this.loadDonorDashboard();
    } else if (viewName === 'recipient') {
      this.loadRecipientDashboard();
    } else if (viewName === 'search') {
      if (window.MapManager && typeof window.MapManager.invalidateSize === 'function') {
        window.MapManager.invalidateSize();
      }
      this.loadDonorSearch();
    } else if (viewName === 'admin') {
      this.loadAdminDashboard();
    } else if (viewName === 'history') {
      this.loadDonationHistory();
    }
  },

  setupEventListeners() {
    // Modal openers
    document.getElementById('nav-login-btn')?.addEventListener('click', () => this.openModal('modal-login'));
    document.getElementById('nav-register-btn')?.addEventListener('click', () => this.openModal('modal-register'));
    document.getElementById('hero-login-btn')?.addEventListener('click', () => this.openModal('modal-login'));
    document.getElementById('hero-register-btn')?.addEventListener('click', () => this.openModal('modal-register'));
    document.getElementById('hero-emergency-btn')?.addEventListener('click', () => {
      this.openModal('modal-request-blood');
      const urgencySelect = document.getElementById('req-urgency');
      if (urgencySelect) urgencySelect.value = 'emergency';
    });

    document.getElementById('nav-btn-admin-special')?.addEventListener('click', () => {
      if (this.currentUser && this.currentUser.role === 'admin') {
        this.switchView('admin');
      } else {
        this.openModal('modal-admin-login');
      }
    });

    // Autofill master admin credentials
    document.getElementById('btn-autofill-admin-credentials')?.addEventListener('click', () => {
      document.getElementById('admin-login-email').value = 'admin@bloodconnect.org';
      document.getElementById('admin-login-key').value = 'ADMIN@SECURE#2026';
      this.showToast('Special administrator credentials autofilled.', 'info');
    });

    // Admin login form submit
    const adminLoginForm = document.getElementById('form-admin-login');
    if (adminLoginForm) {
      adminLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-login-email').value;
        const adminKey = document.getElementById('admin-login-key').value;

        try {
          this.showToast('Verifying special clearance...', 'info');
          const res = await API.auth.adminLogin({ email, adminKey });
          API.setToken(res.token);
          API.setUser(res.user);
          this.currentUser = res.user;
          this.currentDonor = null;

          this.updateNavbarUserUI(res.user);
          this.closeModal('modal-admin-login');
          this.showToast('Security Clearance Verified. Welcome, Dr. Verma.', 'success');
          this.switchView('admin');
        } catch (err) {
          this.showToast(err.message || 'Invalid administrator security key.', 'error');
        }
      });
    }

    // Close buttons for modals
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) modal.classList.remove('active');
      });
    });

    // Close modal on click outside
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });

    // Notification Drawer
    document.getElementById('btn-notif-bell')?.addEventListener('click', () => {
      const drawer = document.getElementById('notification-drawer');
      drawer?.classList.toggle('active');
    });

    document.getElementById('btn-close-drawer')?.addEventListener('click', () => {
      document.getElementById('notification-drawer')?.classList.remove('active');
    });

    document.getElementById('btn-mark-all-read')?.addEventListener('click', async () => {
      try {
        await API.notifications.markAllRead();
        this.checkNotifications();
        this.showToast('All notifications marked as read', 'success');
      } catch (err) {
        this.showToast('Failed to update notifications', 'error');
      }
    });

    // Logout button
    document.getElementById('nav-logout-btn')?.addEventListener('click', () => {
      API.auth.logout();
      this.currentUser = null;
      this.currentDonor = null;
      document.querySelectorAll('.btn-persona').forEach(b => b.classList.remove('active'));
      this.updateNavbarUserUI(null);
      this.showToast('You have been logged out.', 'info');
      this.switchView('welcome');
    });

    // Auth forms
    this.setupAuthForms();

    // Donor availability switch
    const donorSwitch = document.getElementById('donor-availability-switch');
    if (donorSwitch) {
      donorSwitch.addEventListener('change', async (e) => {
        try {
          const res = await API.donors.toggleAvailability(e.target.checked);
          this.showToast(res.message, 'success');
          this.updateAvailabilityBadge(e.target.checked);
        } catch (err) {
          this.showToast(err.message || 'Failed to update availability', 'error');
          e.target.checked = !e.target.checked;
        }
      });
    }

    // Blood Request form submit
    const createReqForm = document.getElementById('form-create-blood-request');
    if (createReqForm) {
      createReqForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCreateBloodRequest(createReqForm);
      });
    }

    // Search form submit
    const searchForm = document.getElementById('form-donor-search');
    if (searchForm) {
      searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleDonorSearch();
      });
    }

    // Donor Profile Update form submit
    const donorProfileForm = document.getElementById('form-donor-profile');
    if (donorProfileForm) {
      donorProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleUpdateDonorProfile();
      });
    }
  },

  setupAuthForms() {
    // Role switch in register form
    const roleRadios = document.querySelectorAll('input[name="reg-role"]');
    roleRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const donorFields = document.getElementById('register-donor-fields');
        if (donorFields) {
          donorFields.style.display = e.target.value === 'donor' ? 'block' : 'none';
        }
      });
    });

    // Login Form Submit
    const loginForm = document.getElementById('form-login');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
          const res = await API.auth.login({ email, password });
          API.setToken(res.token);
          API.setUser(res.user);
          this.currentUser = res.user;
          this.currentDonor = res.donor || null;

          this.updateNavbarUserUI(res.user);
          this.closeModal('modal-login');
          this.showToast(`Welcome back, ${res.user.name}!`, 'success');

          if (res.user.role === 'admin') this.switchView('admin');
          else if (res.user.role === 'donor') this.switchView('donor');
          else this.switchView('recipient');
        } catch (err) {
          this.showToast(err.message || 'Login failed. Please verify credentials.', 'error');
        }
      });
    }

    // Register Form Submit
    const regForm = document.getElementById('form-register');
    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const role = document.querySelector('input[name="reg-role"]:checked')?.value || 'donor';
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const phone = document.getElementById('reg-phone').value;
        const password = document.getElementById('reg-password').value;

        const payload = { role, name, email, phone, password };

        if (role === 'donor') {
          payload.blood_group = document.getElementById('reg-blood-group').value;
          payload.gender = document.getElementById('reg-gender').value;
          payload.date_of_birth = document.getElementById('reg-dob').value;
          payload.city = document.getElementById('reg-city').value;
          payload.area = document.getElementById('reg-area').value;
          payload.latitude = document.getElementById('reg-latitude').value;
          payload.longitude = document.getElementById('reg-longitude').value;
          payload.last_donation_date = document.getElementById('reg-last-donation').value;
        }

        try {
          const res = await API.auth.register(payload);
          API.setToken(res.token);
          API.setUser(res.user);
          this.currentUser = res.user;
          this.currentDonor = res.donor || null;

          this.updateNavbarUserUI(res.user);
          this.closeModal('modal-register');
          this.showToast('Registration complete! Welcome to BloodConnect.', 'success');

          if (role === 'donor') this.switchView('donor');
          else if (role === 'admin') this.switchView('admin');
          else this.switchView('recipient');
        } catch (err) {
          this.showToast(err.message || 'Registration failed.', 'error');
        }
      });
    }
  },

  async checkNotifications() {
    if (!this.currentUser) return;
    try {
      const data = await API.notifications.getAll();
      const unreadCount = data.unread_count || 0;
      const badge = document.getElementById('notif-badge-count');
      if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'flex' : 'none';
      }

      const listContainer = document.getElementById('drawer-notifications-list');
      if (listContainer) {
        if (data.notifications.length === 0) {
          listContainer.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748b;">No notifications yet.</div>';
          return;
        }

        listContainer.innerHTML = data.notifications.map(n => `
          <div class="notif-card ${n.is_read ? '' : 'unread'}" data-id="${n.notification_id}">
            <div class="notif-title">${n.title}</div>
            <div class="notif-msg">${n.message}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
              <span class="notif-time">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              ${n.request_id ? `<button class="btn btn-outline-danger btn-sm" onclick="App.viewRequestFromNotif(${n.request_id})">View Request</button>` : ''}
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  },

  async viewRequestFromNotif(requestId) {
    document.getElementById('notification-drawer')?.classList.remove('active');
    this.switchView('donor');
  },

  // Donor Dashboard Logic
  async loadDonorDashboard() {
    if (!this.currentUser) {
      this.showToast('Please log in as a donor to view this dashboard.', 'info');
      this.openModal('modal-login');
      return;
    }

    try {
      const data = await API.donors.getDashboardStats();
      const donor = data.donor;
      const stats = data.stats;

      document.getElementById('donor-name-greeting').textContent = `Welcome, ${this.currentUser.name} 👋`;
      document.getElementById('donor-blood-group-badge').textContent = donor.blood_group;

      // Pre-fill profile update modal inputs
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
      };
      setVal('donor-profile-blood-group', donor.blood_group);
      setVal('donor-profile-gender', donor.gender || 'other');
      setVal('donor-profile-city', donor.city || 'Hyderabad');
      setVal('donor-profile-area', donor.area || 'Lingampally');
      setVal('donor-profile-lat', donor.latitude || '17.4938');
      setVal('donor-profile-lon', donor.longitude || '78.3188');
      setVal('donor-profile-last-donation', donor.last_donation_date || '');

      const toggle = document.getElementById('donor-availability-switch');
      if (toggle) toggle.checked = stats.is_available;
      this.updateAvailabilityBadge(stats.is_available);

      // Safe Donation Eligibility Meter
      const elig = donor.medical_eligibility;
      const meterEl = document.getElementById('donor-eligibility-meter');
      if (meterEl) {
        if (elig.isEligible) {
          meterEl.innerHTML = `
            <span style="color:#10b981; font-weight:700;">🟢 Eligible to Donate Blood</span>
            <div style="font-size:12px; color:#94a3b8;">Last donated: ${donor.last_donation_date || 'None'} (${elig.daysSince} days ago). Safe interval is 90 days.</div>
          `;
        } else {
          meterEl.innerHTML = `
            <span style="color:#f59e0b; font-weight:700;">⏳ Safe Recovery Period: ${elig.daysRemaining} days remaining</span>
            <div style="font-size:12px; color:#94a3b8;">Last donated: ${donor.last_donation_date}. Eligible again in ${elig.daysRemaining} days.</div>
          `;
        }
      }

      // Stats counters
      document.getElementById('donor-total-donations').textContent = stats.total_donations;
      document.getElementById('donor-nearby-count').textContent = stats.nearby_requests_count;

      // Nearby requests feed
      const feed = document.getElementById('donor-nearby-requests-feed');
      if (feed) {
        if (data.nearby_requests.length === 0) {
          feed.innerHTML = `
            <div class="glass-card" style="text-align:center; padding:3rem; color:#94a3b8;">
              <div style="font-size:2rem; margin-bottom:0.5rem;">🎉</div>
              <h3>No Emergency Requests Right Now</h3>
              <p style="font-size:0.9rem; margin-top:0.25rem;">You are on standby! We will notify you instantly when someone near you needs ${donor.blood_group} blood.</p>
            </div>
          `;
          return;
        }

        feed.innerHTML = data.nearby_requests.map(req => {
          const isDirect = Boolean(req.is_direct_request || (req.target_donor_id && req.target_donor_id === donor.donor_id));
          return `
          <div class="request-card ${req.urgency === 'emergency' ? 'emergency-card' : ''}" style="${isDirect ? 'border: 2px solid #ef4444; background: rgba(239, 68, 68, 0.05); box-shadow: 0 4px 20px rgba(239, 68, 68, 0.15);' : ''}">
            <div class="request-card-info">
              <div class="blood-badge ${req.urgency === 'emergency' ? 'pulse' : ''}">${req.blood_group}</div>
              <div class="request-details">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <h4>${req.patient_name}</h4>
                  ${isDirect ? `
                    <span class="status-pill" style="background:#ef4444; color:#fff; font-weight:800; font-size:11px; letter-spacing:0.5px; box-shadow:0 0 10px rgba(239,68,68,0.5);">
                      🎯 DIRECT REQUEST FOR YOU
                    </span>
                  ` : ''}
                  <span class="status-pill urgency-${req.urgency}">${req.urgency.toUpperCase()}</span>
                  ${req.status === 'matched' ? `
                    <span class="status-pill" style="background:#10b981; color:#fff; font-weight:700;">✅ ACCEPTED BY YOU</span>
                  ` : ''}
                </div>
                <div class="request-meta">
                  <span class="meta-item">🏥 ${req.hospital}</span>
                  <span class="meta-item">💉 ${req.units_required} Unit(s)</span>
                  <span class="meta-item distance-tag">📍 ${req.distance_km} km away</span>
                  ${req.required_date ? `<span class="meta-item">📅 Needed: ${req.required_date}</span>` : ''}
                </div>
                ${isDirect ? `
                  <div style="font-size:12px; color:#f87171; font-weight:600; margin-top:4px;">
                    🎯 The recipient specifically chose and requested you for blood donation!
                  </div>
                ` : ''}
                ${req.additional_notes ? `<div style="font-size:12px; color:#94a3b8; margin-top:4px;">“${req.additional_notes}”</div>` : ''}
                ${req.status === 'matched' && req.requester_phone ? `
                  <div style="margin-top:8px; padding:6px 10px; background:rgba(16,185,129,0.1); border-radius:6px; color:#10b981; font-size:13px; display:flex; align-items:center; gap:8px;">
                    <span>📞 Recipient Contact: <b>${req.requester_phone}</b></span>
                    <a href="tel:${req.requester_phone}" class="btn btn-emerald btn-sm" style="padding:2px 8px; font-size:11px;">Call Recipient 📱</a>
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="request-actions">
              ${req.status === 'matched' && req.accepted_by_donor_id === donor.donor_id ? `
                <button class="btn btn-emerald btn-sm" onclick="App.completeDonation(${req.request_id})">Mark Completed ✅</button>
              ` : `
                <button class="btn btn-primary btn-sm" onclick="App.acceptBloodRequest(${req.request_id})">ACCEPT 🩸</button>
                <button class="btn btn-secondary btn-sm" onclick="App.declineBloodRequest(${req.request_id})">Decline</button>
              `}
            </div>
          </div>
        `;}).join('');
      }
    } catch (err) {
      this.showToast('Failed to load donor dashboard.', 'error');
    }
  },

  updateAvailabilityBadge(isAvail) {
    const badge = document.getElementById('donor-availability-badge');
    if (badge) {
      if (isAvail) {
        badge.className = 'status-pill available';
        badge.innerHTML = '<span class="status-dot"></span> Available to Donate';
      } else {
        badge.className = 'status-pill busy';
        badge.innerHTML = '<span class="status-dot"></span> Unavailable';
      }
    }
  },

  async acceptBloodRequest(requestId) {
    try {
      this.showToast('Processing request acceptance...', 'info');
      const res = await API.requests.accept(requestId);
      this.showToast(res.message, 'success');
      this.loadDonorDashboard();
      this.checkNotifications();
    } catch (err) {
      this.showToast(err.message || 'Failed to accept request.', 'error');
    }
  },

  async declineBloodRequest(requestId) {
    try {
      await API.requests.decline(requestId);
      this.showToast('Request dismissed.', 'info');
      this.loadDonorDashboard();
    } catch (err) {
      this.showToast('Failed to dismiss request.', 'error');
    }
  },

  async completeDonation(requestId) {
    try {
      const res = await API.requests.complete(requestId, { units: 1, notes: 'Voluntary life-saving donation.' });
      this.showToast(res.message, 'success');
      this.loadDonorDashboard();
      this.viewCertificate(res.certificate_id);
    } catch (err) {
      this.showToast('Failed to mark donation completed.', 'error');
    }
  },

  async handleUpdateDonorProfile() {
    if (!this.currentUser) return;

    const blood_group = document.getElementById('donor-profile-blood-group')?.value;
    const gender = document.getElementById('donor-profile-gender')?.value;
    const city = document.getElementById('donor-profile-city')?.value;
    const area = document.getElementById('donor-profile-area')?.value;
    const latStr = document.getElementById('donor-profile-lat')?.value;
    const lonStr = document.getElementById('donor-profile-lon')?.value;
    const last_donation_date = document.getElementById('donor-profile-last-donation')?.value;

    const payload = {
      blood_group,
      gender,
      city,
      area,
      latitude: latStr ? parseFloat(latStr) : undefined,
      longitude: lonStr ? parseFloat(lonStr) : undefined,
      last_donation_date: last_donation_date || null
    };

    try {
      this.showToast('Saving profile updates...', 'info');
      const res = await API.donors.updateProfile(payload);
      this.currentDonor = res.donor;
      this.closeModal('modal-donor-profile');
      this.showToast('Profile and coordinates updated successfully!', 'success');
      this.loadDonorDashboard();
    } catch (err) {
      this.showToast(err.message || 'Failed to update profile.', 'error');
    }
  },

  // Recipient Dashboard
  async loadRecipientDashboard() {
    try {
      const data = await API.requests.getAll({ my_requests: 'true' });
      const feed = document.getElementById('recipient-requests-feed');
      if (feed) {
        if (data.requests.length === 0) {
          feed.innerHTML = `
            <div class="glass-card" style="text-align:center; padding:3rem; color:#94a3b8;">
              <h3>No Active Blood Requests</h3>
              <p style="font-size:0.9rem; margin-top:0.5rem; margin-bottom:1.5rem;">Need blood for surgery or emergency transfusion? Create a request to match verified donors instantly.</p>
              <button class="btn btn-primary" onclick="App.openModal('modal-request-blood')">🚨 Create Blood Request</button>
            </div>
          `;
          return;
        }

        feed.innerHTML = data.requests.map(req => `
          <div class="request-card">
            <div class="request-card-info">
              <div class="blood-badge">${req.blood_group}</div>
              <div class="request-details">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                  <h4>${req.patient_name}</h4>
                  ${req.target_donor_id ? `
                    <span class="status-pill" style="background:rgba(239,68,68,0.15); color:#f87171; border:1px solid rgba(239,68,68,0.4); font-size:11px;">
                      🎯 Direct Donor Request
                    </span>
                  ` : ''}
                  <span class="status-pill urgency-${req.urgency}">${req.urgency.toUpperCase()}</span>
                  <span class="status-pill" style="background:rgba(255,255,255,0.08);">${req.status.toUpperCase()}</span>
                </div>
                <div class="request-meta">
                  <span>🏥 ${req.hospital}</span>
                  <span>💉 ${req.units_required} Unit(s)</span>
                  <span>📅 Required: ${req.required_date}</span>
                </div>
                ${req.accepted_donor_name ? `
                  <div style="margin-top:8px; padding:8px 12px; background:rgba(16,185,129,0.12); border-left:3px solid #10b981; border-radius:6px; color:#10b981;">
                    <div style="font-weight:700; font-size:13px;">✅ Matched Donor: ${req.accepted_donor_name}</div>
                    <div style="font-size:12px; margin-top:4px; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                      <span>📞 Donor Phone: <b>${req.accepted_donor_phone || 'Available'}</b></span>
                      ${req.accepted_donor_phone ? `
                        <a href="tel:${req.accepted_donor_phone}" class="btn btn-emerald btn-sm" style="padding:2px 8px; font-size:11px;">Call Donor 📱</a>
                      ` : ''}
                    </div>
                  </div>
                ` : `
                  <div style="margin-top:6px; color:#f59e0b; font-size:12px;">
                    ${req.target_donor_id ? '⏳ Direct request sent to donor. Waiting for donor to review & accept in their dashboard...' : '🔍 Algorithm broadcasting to active donors in vicinity...'}
                  </div>
                `}
              </div>
            </div>
            <div class="request-actions">
              ${req.status === 'matched' ? `
                <button class="btn btn-emerald btn-sm" onclick="App.completeDonation(${req.request_id})">Confirm Donation Completed</button>
              ` : `
                <button class="btn btn-secondary btn-sm" onclick="App.searchDonorsForReq('${req.blood_group}', ${req.latitude}, ${req.longitude})">Find Donors</button>
              `}
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.warn('Recipient dashboard error:', err);
    }
  },

  searchDonorsForReq(bloodGroup, lat, lon) {
    const bgSelect = document.getElementById('search-blood-group');
    if (bgSelect) bgSelect.value = bloodGroup;
    const latInput = document.getElementById('search-lat');
    const lonInput = document.getElementById('search-lon');
    if (latInput && lat) latInput.value = lat;
    if (lonInput && lon) lonInput.value = lon;
    this.switchView('search');
    this.handleDonorSearch(lat, lon);
  },

  // Create Blood Request
  async handleCreateBloodRequest(form) {
    const contactName = document.getElementById('req-contact-name')?.value;
    const contactPhone = document.getElementById('req-contact-phone')?.value;

    if (!this.currentUser && !contactPhone) {
      this.showToast('Please provide your mobile number so the donor can contact you.', 'info');
      document.getElementById('req-contact-phone')?.focus();
      return;
    }

    const targetDonorId = document.getElementById('req-target-donor-id')?.value || null;

    const payload = {
      patient_name: document.getElementById('req-patient-name').value,
      blood_group: document.getElementById('req-blood-group').value,
      units_required: document.getElementById('req-units').value,
      hospital: document.getElementById('req-hospital').value,
      city: document.getElementById('req-city').value,
      area: document.getElementById('req-area').value,
      latitude: document.getElementById('req-latitude').value || '17.4938',
      longitude: document.getElementById('req-longitude').value || '78.3188',
      required_date: document.getElementById('req-date').value,
      urgency: document.getElementById('req-urgency').value,
      additional_notes: document.getElementById('req-notes').value,
      target_donor_id: targetDonorId,
      contact_name: contactName,
      contact_phone: contactPhone
    };

    try {
      this.showToast(targetDonorId ? 'Sending direct request to donor...' : 'Publishing request & calculating nearest donors...', 'info');
      const res = await API.requests.create(payload);

      // If server returned auto-auth credentials for guest recipient, log them in seamlessly
      if (res.token && res.user && !this.currentUser) {
        this.setSession(res.token, res.user);
      }

      this.closeModal('modal-request-blood');
      form.reset();
      this.clearTargetDonor();

      this.showToast(targetDonorId 
        ? 'Direct request sent to donor account!' 
        : `Request created! Notified ${res.matched_donors_count} compatible donors nearby.`, 'success');

      // Switch to recipient view to track it
      if (this.currentUser) {
        this.switchView('recipient');
      }
    } catch (err) {
      this.showToast(err.message || 'Failed to create blood request.', 'error');
    }
  },

  // Donor Search & Map
  async loadDonorSearch() {
    const lat = parseFloat(document.getElementById('search-lat')?.value || '17.4938');
    const lon = parseFloat(document.getElementById('search-lon')?.value || '78.3188');
    await this.handleDonorSearch(lat, lon);
  },

  async handleDonorSearch(overrideLat = null, overrideLon = null) {
    const blood_group = document.getElementById('search-blood-group')?.value || 'ALL';
    const radius = document.getElementById('search-radius')?.value || '15';
    const available_only = document.getElementById('search-avail-only')?.checked ? 'true' : 'false';

    const lat = overrideLat || parseFloat(document.getElementById('search-lat')?.value || '17.4938');
    const lon = overrideLon || parseFloat(document.getElementById('search-lon')?.value || '78.3188');

    try {
      const data = await API.donors.search({
        blood_group,
        radius,
        available_only,
        latitude: lat,
        longitude: lon
      });

      const hospitalsData = await API.admin.getHospitals();
      const hospitals = hospitalsData.hospitals || [];

      // Render Map Markers
      if (window.MapManager) {
        MapManager.renderDonorsAndHospitals(data.donors, hospitals, lat, lon, parseFloat(radius));
      }

      // Render Results List
      const listContainer = document.getElementById('donor-search-results');
      if (listContainer) {
        if (data.donors.length === 0) {
          listContainer.innerHTML = `
            <div class="glass-card" style="text-align:center; padding:2rem; color:#94a3b8;">
              <h4>No matching donors found within ${radius} km</h4>
              <p style="font-size:0.85rem; margin-top:0.25rem;">Try increasing the search radius or selecting compatible blood groups.</p>
            </div>
          `;
          return;
        }

        listContainer.innerHTML = data.donors.map(d => `
          <div class="donor-result-card">
            <div class="donor-card-top">
              <div class="donor-profile-summary">
                <div class="blood-badge sm">${d.blood_group}</div>
                <div>
                  <div class="donor-name-title">${d.name}</div>
                  <div class="donor-location-sub">📍 ${d.area || d.city} • <span style="color:#10b981; font-weight:bold;">${d.distance_km} km away</span></div>
                </div>
              </div>
              <span class="status-pill ${d.availability ? 'available' : 'busy'}">
                ${d.availability ? '🟢 Available' : '🔴 Busy'}
              </span>
            </div>
            <div class="donor-card-stats">
              <span>💉 ${d.total_donations} donations</span>
              <span>🔒 ${d.phone_masked}</span>
              ${d.match_type === 'compatible' ? '<span style="color:#f59e0b; font-size:11px;">⚠️ Medically Compatible</span>' : ''}
            </div>
            <button class="btn btn-primary btn-sm" style="width:100%; margin-top:6px;" onclick="App.requestSpecificDonor(${d.donor_id}, '${d.name.replace(/'/g, "\\'")}', '${d.blood_group}', '${(d.area || d.city).replace(/'/g, "\\'")}')">
              🎯 Request Blood from ${d.name.split(' ')[0]}
            </button>
          </div>
        `).join('');
      }
    } catch (err) {
      console.error('Search failure:', err);
    }
  },

  requestSpecificDonor(donorId, donorName, bloodGroup, area = '') {
    const targetIdInput = document.getElementById('req-target-donor-id');
    if (targetIdInput) targetIdInput.value = donorId;

    const banner = document.getElementById('req-target-donor-banner');
    if (banner) {
      banner.style.display = 'block';
      document.getElementById('req-target-donor-name').textContent = donorName;
      document.getElementById('req-target-donor-info').textContent = `• ${bloodGroup} Donor • ${area || 'Nearby'}`;
    }

    const submitBtn = document.getElementById('req-submit-btn');
    if (submitBtn) {
      submitBtn.innerHTML = `🎯 Send Direct Request to ${donorName.split(' ')[0]} &rarr;`;
      submitBtn.className = 'btn btn-primary';
    }

    const bgSelect = document.getElementById('req-blood-group');
    if (bgSelect) bgSelect.value = bloodGroup;

    this.openModal('modal-request-blood');
    this.showToast(`Targeting ${donorName} (${bloodGroup}) for blood request`, 'info');
  },

  clearTargetDonor() {
    const targetIdInput = document.getElementById('req-target-donor-id');
    if (targetIdInput) targetIdInput.value = '';

    const banner = document.getElementById('req-target-donor-banner');
    if (banner) banner.style.display = 'none';

    const submitBtn = document.getElementById('req-submit-btn');
    if (submitBtn) {
      submitBtn.innerHTML = `🚨 Broadcast Blood Request`;
      submitBtn.className = 'btn btn-emergency-pulse';
    }
  },

  // Donation History & Certificates
  async loadDonationHistory() {
    if (!this.currentUser) return;
    try {
      const data = await API.donations.getHistory();
      const list = document.getElementById('donation-history-list');
      if (list) {
        if (data.donations.length === 0) {
          list.innerHTML = '<div style="text-align:center; padding:3rem; color:#94a3b8;">No donations recorded yet.</div>';
          return;
        }

        list.innerHTML = data.donations.map(d => `
          <div class="glass-card" style="margin-bottom:1rem; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <h4 style="font-size:1.1rem;">${d.hospital_name}</h4>
              <div style="font-size:0.85rem; color:#94a3b8;">
                Date: ${d.donation_date} • Units: ${d.units} (${d.blood_group})
              </div>
              <div style="font-size:0.75rem; color:#10b981; margin-top:2px;">Certificate ID: ${d.certificate_id}</div>
            </div>
            <button class="btn btn-outline-danger btn-sm" onclick="App.viewCertificate('${d.certificate_id}')">
              📜 View Certificate
            </button>
          </div>
        `).join('');
      }
    } catch (err) {
      this.showToast('Failed to load donation history.', 'error');
    }
  },

  async viewCertificate(certId) {
    try {
      const data = await API.donations.getCertificate(certId);
      const cert = data.certificate;

      const certModalContent = document.getElementById('certificate-render-area');
      if (certModalContent) {
        certModalContent.innerHTML = `
          <div class="cert-paper">
            <div class="cert-watermark">🩸</div>
            <div class="cert-badge-ribbon">🎖️</div>
            <h2 class="cert-heading">Certificate of Appreciation</h2>
            <p style="font-size:0.95rem; color:#64748b; margin-top:4px;">NATIONAL BLOOD TRANSFUSION INITIATIVE</p>
            <p style="margin-top:1.5rem; font-size:1.1rem; color:#334155;">This is proudly awarded to</p>
            <div class="cert-donor-name">${cert.donor_name}</div>
            <p style="font-size:1.05rem; line-height:1.6; max-width:500px; margin:0 auto; color:#475569;">
              for voluntarily donating <b>${cert.units} unit(s) of ${cert.blood_group} blood</b> at <b>${cert.hospital_name}</b> on <b>${cert.donation_date}</b>.
              Your noble contribution has directly helped preserve human life.
            </p>
            <div style="margin-top:2rem; display:flex; justify-content:space-between; align-items:flex-end; border-top:1px solid #e2e8f0; padding-top:1.5rem; font-size:0.8rem; color:#64748b;">
              <div style="text-align:left;">
                <b>Certificate ID:</b><br>${cert.certificate_id}
              </div>
              <div>
                <span style="display:inline-block; border-bottom:1px solid #475569; width:120px; height:20px;"></span><br>
                Medical Officer Seal
              </div>
              <div style="text-align:right;">
                <b>Verification:</b><br><span style="color:#059669;">Verified Authentic</span>
              </div>
            </div>
          </div>
        `;
        this.openModal('modal-certificate');
      }
    } catch (err) {
      this.showToast('Failed to retrieve certificate details.', 'error');
    }
  },

  // Admin Dashboard Logic
  async loadAdminDashboard() {
    if (!this.currentUser || this.currentUser.role !== 'admin') {
      this.showToast('🛡️ Access restricted: Administrator login required.', 'error');
      this.openModal('modal-admin-login');
      this.switchView('welcome');
      return;
    }

    try {
      const statsData = await API.admin.getStats();
      const s = statsData.stats;

      document.getElementById('admin-stat-users').textContent = s.total_users;
      document.getElementById('admin-stat-donors').textContent = s.total_donors;
      document.getElementById('admin-stat-active-reqs').textContent = s.active_requests;
      document.getElementById('admin-stat-completed-reqs').textContent = s.completed_requests;

      // Users table
      const usersData = await API.admin.getUsers();
      const usersBody = document.getElementById('admin-users-table-body');
      if (usersBody) {
        usersBody.innerHTML = usersData.users.map(u => `
          <tr>
            <td>#${u.user_id}</td>
            <td><b>${u.name}</b></td>
            <td><span class="user-role-badge">${u.role}</span></td>
            <td>${u.email}</td>
            <td>${u.blood_group || '—'}</td>
            <td>
              <span class="status-pill ${u.is_active ? 'available' : 'busy'}">
                ${u.is_active ? 'Active' : 'Disabled'}
              </span>
            </td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="App.toggleUserStatus(${u.user_id})">Toggle</button>
            </td>
          </tr>
        `).join('');
      }

      // Blood Inventory distribution bar chart
      const chartContainer = document.getElementById('admin-blood-distribution');
      if (chartContainer && statsData.blood_group_distribution) {
        chartContainer.innerHTML = statsData.blood_group_distribution.map(bg => `
          <div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:2px;">
              <b>Group ${bg.blood_group}</b>
              <span>${bg.count} donors</span>
            </div>
            <div style="background:rgba(255,255,255,0.08); height:8px; border-radius:4px; overflow:hidden;">
              <div style="background:#e11d48; height:100%; width:${Math.min(100, bg.count * 15)}%;"></div>
            </div>
          </div>
        `).join('');
      }
    } catch (err) {
      console.warn('Admin load error:', err);
    }
  },

  async toggleUserStatus(userId) {
    try {
      const res = await API.admin.toggleUserStatus(userId);
      this.showToast(res.message, 'success');
      this.loadAdminDashboard();
    } catch (err) {
      this.showToast('Failed to toggle status.', 'error');
    }
  },

  // Modal helpers
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      if (modalId === 'modal-request-blood') {
        const guestFields = document.getElementById('req-guest-contact-fields');
        if (guestFields) {
          guestFields.style.display = this.currentUser ? 'none' : 'block';
        }
      }
      modal.classList.add('active');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '🩸';
    toast.innerHTML = `<span>${icon}</span><span style="font-size:13px;">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

window.App = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
