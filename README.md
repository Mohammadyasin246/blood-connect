# 🩸 BloodConnect — A Smart Blood Donor & Recipient Connection System

> **A B.Tech CSE Full-Stack Capstone Project**  
> Built with Node.js, Express.js, SQLite/MySQL, Leaflet.js, and Vanilla CSS Glassmorphism.

---

## 🌟 Executive Summary & Problem Statement

Timely access to safe blood transfusions is one of the most time-critical challenges in emergency healthcare. Traditional systems depend on static phone registries or manual hospital inquiries, leading to fatal delays during cardiac surgeries, trauma accidents, and intensive care emergencies.

**BloodConnect** solves this by establishing a decentralized, intelligent connection system featuring:
1. **Automated Proximity Matching** using the spherical **Haversine Formula** ($d = 2R \arcsin(\dots)$) to identify the nearest eligible donors.
2. **Medical Safety Verification** enforcing a mandatory **90-Day Safe Donation Interval** and strict **ABO/Rh Transfusion Compatibility**.
3. **Privacy-Preserving Contact Mediation** that masks donors' personal phone numbers by default.
4. **Real-time Alert Dispatch & 1-Tap Acceptance** to minimize hospital response times.
5. **Centralized Admin Control & Verification** with live telemetry, donor approval, and blood inventory tracking.

---

## 🏗️ System Architecture

```text
                 ┌─────────────────────────────────┐
                 │       BloodConnect Web App      │
                 │   (HTML5 + Vanilla CSS + JS)    │
                 └────────────────┬────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ↓                       ↓                       ↓
     Donor Portal          Recipient Portal          Admin Panel
     (Dashboard,           (Emergency Request,       (Users, Donors,
     Availability,         Nearby Donor Search,      Telemetry,
     Accept/Decline)       Live Tracking)            Analytics)
          │                       │                       │
          └───────────────────────┼───────────────────────┘
                                  ↓
                 ┌─────────────────────────────────┐
                 │       RESTful API Server        │
                 │      (Node.js + Express.js)     │
                 └────────────────┬────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ↓                       ↓                       ↓
     SQLite / MySQL       Matching Engine          Geospatial Engine
     Relational DB       (ABO/Rh Matrix &          (Leaflet Map &
    (Normalized 3NF)      90-Day Safe Window)      Haversine Spherical)
```

---

## 🔑 Quick Start & Running Locally

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)

### 2. Setup & Installation

Clone or open the project folder in your terminal:

```bash
# Navigate to the project root
cd d:/BloodConnect

# Install dependencies (already included in node_modules)
npm install

# Start the application server
npm start
```

### 3. Open in Browser
Open your browser and navigate to:
- **Web Application:** [http://localhost:5000](http://localhost:5000)
- **Admin Direct Shortcut:** [http://localhost:5000/#admin](http://localhost:5000/#admin)
- **API Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

## 🎭 Test Accounts & Credentials (For Evaluation)

The application includes pre-seeded test accounts for each role so you can log in through the standard login portal:

| Persona | Role | Email | Password | Coordinates / Area | Blood Group |
|---|---|---|---|---|---|
| **Rahul Sharma** | 🩸 Donor | `rahul@gmail.com` | `donor123` | Lingampally, Hyderabad | **O+** |
| **Ramesh Kumar** | 🩸 Donor | `ramesh@gmail.com` | `donor123` | Chandanagar (1.5 km away) | **O+** |
| **Priya Patel** | 🧑 Recipient | `priya@gmail.com` | `recipient123` | Lingampally / Gachibowli | *Requester* |
| **Dr. Arvind Verma** | 🛡️ Admin | `admin@bloodconnect.org` | `admin123` | Central Control Hub | *Administrator* |
| **Apollo Hospitals** | 🏥 Hospital | `apollo@bloodconnect.org` | `hospital123` | Jubilee Hills, Hyderabad | *Blood Bank* |

---

## 🧠 Core CSE Algorithms & Viva Explanations

### 1. Haversine Great-Circle Distance Formula

The **Haversine formula** determines the shortest distance between two points on the surface of a sphere given their longitudes and latitudes.

$$\Delta\phi = \text{toRad}(\text{lat}_2 - \text{lat}_1)$$
$$\Delta\lambda = \text{toRad}(\text{lon}_2 - \text{lon}_1)$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\text{lat}_1) \cdot \cos(\text{lat}_2) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$
$$d = R \cdot c \quad \text{where } R = 6,371 \text{ km}$$

> **Interactive Viva Engine:** Navigate to the **"🧠 CSE Algorithm & Viva"** tab in the app to view the live, step-by-step mathematical breakdown with custom coordinates!

---

### 2. ABO / Rh Blood Transfusion Compatibility Matrix

Implemented in `backend/services/matchingService.js`:

| Recipient Blood Group | Compatible Donor Blood Groups (Packed Red Cells) |
|---|---|
| **O-** | **O-** only |
| **O+** | **O+**, **O-** |
| **A-** | **A-**, **O-** |
| **A+** | **A+**, **A-**, **O+**, **O-** |
| **B-** | **B-**, **O-** |
| **B+** | **B+**, **B-**, **O+**, **O-** |
| **AB-** | **AB-**, **A-**, **B-**, **O-** |
| **AB+** (Universal Recipient) | **All 8 Blood Groups** (O-, O+, A-, A+, B-, B+, AB-, AB+) |

---

## 🗄️ Database Architecture & Schema

The database design adheres to 3rd Normal Form (3NF) and includes constraints, indexes, foreign keys, and views.

- **MySQL Schema:** See [`database/schema.sql`](database/schema.sql)
- **Local SQLite Engine:** Stored in [`database/bloodconnect.db`](database/bloodconnect.db)

### Entity Relationship Diagram:

```text
USERS (user_id PK, name, email, phone, password_hash, role)
  │
  ├── 1:1 ──► DONORS (donor_id PK, user_id FK, blood_group, lat, lon, availability, last_donation_date)
  │             │
  │             └── 1:N ──► DONATIONS (donation_id PK, donor_id FK, certificate_id)
  │
  └── 1:N ──► BLOOD_REQUESTS (request_id PK, requester_id FK, blood_group, urgency, status)
                │
                ├── 1:N ──► NOTIFICATIONS (notification_id PK, user_id FK, request_id FK)
                └── 1:N ──► DONATIONS (donation_id PK, request_id FK)
```

---

## 🔌 API Endpoint Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/auth/register` | Register new Donor, Recipient, or Hospital | No |
| `POST` | `/api/auth/login` | Authenticate user & issue JWT | No |
| `GET` | `/api/auth/me` | Fetch active user & donor profile | Yes (JWT) |
| `GET` | `/api/donors/search` | Search donors with Haversine radius filter | No |
| `PATCH`| `/api/donors/availability` | Toggle donor availability (Available/Busy) | Yes (Donor) |
| `GET` | `/api/donors/dashboard-stats`| Get donor nearby requests & safe days meter | Yes (Donor) |
| `POST` | `/api/requests` | Create emergency blood request & broadcast alerts | Yes |
| `GET` | `/api/requests` | List all open blood requests | No |
| `POST` | `/api/requests/:id/accept` | Donor accepts blood request | Yes (Donor) |
| `POST` | `/api/requests/:id/complete`| Confirm donation and generate Certificate ID | Yes |
| `GET` | `/api/donations` | Fetch donation history | Yes |
| `GET` | `/api/donations/certificate/:id` | View official verifiable certificate | No |
| `GET` | `/api/notifications` | Get real-time alerts & unread counter | Yes |
| `GET` | `/api/admin/stats` | System telemetry & blood inventory | No / Admin |
| `PATCH`| `/api/admin/users/:id/status`| Activate or disable a user account | Yes (Admin) |

---

## 📁 Repository Structure

```text
BloodConnect/
│
├── frontend/
│   ├── index.html            # Main SPA with all screens & modals
│   ├── css/
│   │   └── styles.css        # Premium Crimson Glassmorphic Design System
│   ├── js/
│   │   ├── api.js            # Centralized API fetch wrapper & JWT storage
│   │   ├── map.js            # Leaflet.js interactive maps & markers
│   │   ├── viva.js           # Haversine step-by-step calculator engine
│   │   └── app.js            # Master application state coordinator
│   ├── login/                # Route alias
│   ├── register/             # Route alias
│   ├── donor/                # Route alias
│   ├── recipient/            # Route alias
│   ├── requests/             # Route alias
│   └── profile/              # Route alias
│
├── backend/
│   ├── config/
│   │   └── db.js             # SQLite automated setup & realistic seed loader
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── donorController.js
│   │   ├── requestController.js
│   │   ├── donationController.js
│   │   ├── adminController.js
│   │   └── notificationController.js
│   ├── middleware/
│   │   └── auth.js           # JWT authentication & role-based authorization
│   ├── models/
│   │   ├── User.js
│   │   ├── Donor.js
│   │   ├── BloodRequest.js
│   │   └── Donation.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── donorRoutes.js
│   │   ├── requestRoutes.js
│   │   ├── donationRoutes.js
│   │   ├── adminRoutes.js
│   │   └── notificationRoutes.js
│   ├── services/
│   │   ├── matchingService.js # Haversine formula & compatibility matrix
│   │   └── notificationService.js
│   └── server.js             # Express application entry point
│
├── database/
│   ├── schema.sql            # Full MySQL 8.0 schema for production
│   └── bloodconnect.db       # Instant zero-config SQLite database
│
├── admin/
│   ├── index.html            # Admin redirect portal
│   ├── dashboard/
│   ├── users/
│   ├── donors/
│   └── requests/
│
├── package.json
└── README.md
```

---

## 🎓 Academic Viva Questions & Answers

1. **Q: Why use the Haversine formula instead of Euclidean distance?**  
   *A:* Earth is a sphere (oblate spheroid). Euclidean distance $(d = \sqrt{\Delta x^2 + \Delta y^2})$ assumes a flat plane, resulting in distortion over geographic distances. The Haversine formula uses spherical trigonometry to compute the great-circle distance accurately.

2. **Q: How does BloodConnect maintain donor privacy?**  
   *A:* The system masks phone numbers by default (`912****780`) and mediates connection through authenticated requests. Only when a request is accepted by the donor are coordination details securely shared.

3. **Q: What happens if an O+ patient needs blood but no O+ donor is available?**  
   *A:* The matching algorithm falls back to medically compatible donors (e.g. O- universal donors) within the selected geographic radius.

4. **Q: How is medical safety enforced?**  
   *A:* The system calculates $D = \text{CurrentDate} - \text{LastDonationDate}$. If $D < 90\text{ days}$, the donor is flagged as in recovery, preventing premature re-donation.

---

## 📄 License
This project is open-source and built for educational and life-saving humanitarian purposes.
