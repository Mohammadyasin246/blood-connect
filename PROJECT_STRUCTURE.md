# 🩸 BloodConnect - Clean Project Structure & Architecture Guide

BloodConnect is built as an enterprise-grade emergency blood donation and matching platform. It supports both **Cloud Supabase PostgreSQL** and **Local SQLite**, ensuring zero setup friction and seamless cloud scalability.

---

## 📁 Directory Structure Overview

```
BloodConnect/
│
├── 📂 backend/                  # Node.js / Express Server & Business Logic
│   ├── 📂 config/               # Database and cloud client configurations
│   │   ├── db.js                # SQLite engine + automatic schema migrator
│   │   └── supabase.js          # Supabase cloud client & connection test
│   ├── 📂 controllers/          # API route controllers
│   │   ├── adminController.js   # Admin dashboard, stats, user/donor management
│   │   ├── authController.js    # Registration, login, profile, password hashing
│   │   ├── donationController.js# Donation history, records, certificate download
│   │   ├── donorController.js   # Geo-search, radar distance, availability, donor stats
│   │   ├── notificationController.js # Real-time alerts, mark as read, unread count
│   │   └── requestController.js # Blood requests, direct donor targeting, matching
│   ├── 📂 middleware/           # Express middleware
│   │   └── auth.js              # JWT authentication & role-based access control
│   ├── 📂 routes/               # Modular Express API route definitions
│   │   ├── adminRoutes.js       # /api/admin/*
│   │   ├── authRoutes.js        # /api/auth/*
│   │   ├── donationRoutes.js    # /api/donations/*
│   │   ├── donorRoutes.js       # /api/donors/*
│   │   ├── notificationRoutes.js# /api/notifications/*
│   │   └── requestRoutes.js     # /api/requests/*
│   ├── 📂 services/             # Core business logic & data access layer
│   │   ├── notificationService.js # High-priority dispatch & alerting engine
│   │   └── supabaseService.js   # 100% async CRUD for all Supabase cloud tables
│   └── server.js                # Server entry point, static asset hosting & health check
│
├── 📂 frontend/                 # Responsive Modern Single-Page Application (SPA)
│   ├── 📂 css/                  # Modern styling system
│   │   └── styles.css           # Glassmorphism dark theme, badges, modals, animations
│   ├── 📂 js/                   # Frontend client logic
│   │   ├── api.js               # Clean asynchronous fetch wrapper for all endpoints
│   │   ├── app.js               # Main UI router, donor & recipient dashboard, auth state
│   │   └── map.js               # Interactive Leaflet radar map with live donor pins
│   ├── 📂 donor/                # Direct route redirect to /#donor
│   ├── 📂 recipient/            # Direct route redirect to /#recipient
│   ├── 📂 login/                # Direct route redirect to /#login
│   ├── 📂 register/             # Direct route redirect to /#register
│   ├── 📂 profile/              # Direct route redirect to /#profile
│   ├── 📂 requests/             # Direct route redirect to /#requests
│   └── index.html               # Main application interface with clean modals & dashboards
│
├── 📂 database/                 # Database Schemas & Migrations
│   ├── supabase_schema.sql      # Complete Supabase PostgreSQL schema, RLS, functions & seeds
│   ├── schema.sql               # SQLite schema definition
│   └── bloodconnect.db          # Active local SQLite database file
│
├── 📂 bloodconnect_app/         # Cross-Platform Flutter Mobile & Desktop Application
│   ├── 📂 lib/                  # Dart application code (screens, models, services)
│   └── 📂 build/web/            # Pre-compiled Flutter web release build
│
├── 📂 admin/                    # Direct /admin route redirect to /#admin
│   └── index.html               # Clean redirect entry
│
├── 📄 .env                      # Application environment variables & Supabase keys
├── 📄 .env.example              # Template configuration file
├── 📄 SUPABASE_SETUP.md         # Step-by-step instructions for Supabase cloud setup
├── 📄 PROJECT_STRUCTURE.md      # This file: complete architecture & folder guide
└── 📄 README.md                 # Project introduction and full feature list
```

---

## 🗄️ How Every Piece of Data is Handled

| Data Entity | Supabase Table | Local SQLite Table | Handled By | Description |
|---|---|---|---|---|
| **Users** | `public.users` | `users` | `authController` / `supabaseService.users` | Registered donors, recipients, hospitals, and admins with bcrypt-hashed passwords. |
| **Donors** | `public.donors` | `donors` | `donorController` / `supabaseService.donors` | Geo-coordinates (lat/lng), blood group, donation count, last donation date, availability switch. |
| **Blood Requests** | `public.blood_requests` | `blood_requests` | `requestController` / `supabaseService.requests` | Blood requests with patient name, hospital, units, urgency, and `target_donor_id`. |
| **Donations** | `public.donations` | `donations` | `donationController` / `supabaseService.donations` | Historical and completed donation logs with certificates. |
| **Notifications** | `public.notifications` | `notifications` | `notificationController` / `supabaseService.notifications` | Real-time direct alerts sent to donor when requested, and to recipient when accepted. |
| **Hospitals** | `public.hospitals` | `hospitals` | `donorController` / `supabaseService.hospitals` | Verified partner hospitals and 24/7 blood bank centers. |

---

## 🎯 Direct Donor Request Flow

1. **Search or Map View**:
   - A recipient searches for blood donors by blood group and radius, or clicks a donor pin on the interactive radar map.
   - Every donor card and map popup has a **"🎯 Request Blood from [Donor]"** button.

2. **Targeted Modal Pre-fill**:
   - Clicking this button opens the Blood Request Modal with a highlighted banner:
     `🎯 Direct Request for [Donor Name] (Blood Group • Area)`.
   - The hidden `req-target-donor-id` field is set to that specific donor's ID.

3. **Database Dispatch & Notification**:
   - Submitting the form writes `target_donor_id` to the `blood_requests` table.
   - An immediate high-priority notification (`type: 'request'`) is saved to the targeted donor's account.

4. **Donor Account Feed**:
   - When the donor opens their dashboard, the request appears at the **very top** with a red glowing badge:
     `🎯 DIRECT REQUEST FOR YOU`.
   - An alert in their notification bell alerts them immediately.

5. **Acceptance & Contact Exchange**:
   - The donor clicks **"ACCEPT 🩸"**.
   - The request status switches to `'matched'`.
   - The donor dashboard displays the recipient's phone number with a direct call button.
   - The recipient dashboard displays the donor's name and verified phone number with a direct call button.
