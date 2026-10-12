# ⚡ Supabase Backend Integration Guide — BloodConnect

This document explains how to set up, configure, and operate the **Supabase PostgreSQL & Auth** backend for **BloodConnect**.

---

## 🏗️ Architecture Overview

BloodConnect features a **hybrid cloud-ready architecture**. The Node.js Express backend and Flutter mobile client interface directly with Supabase:

```text
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│        Web Application          │       │      Flutter Mobile App         │
│   (HTML5 + Vanilla CSS + JS)    │       │     (Android / iOS / Web)       │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 └───────────────────┬─────────────────────┘
                                     │
                                     ▼
                      ┌─────────────────────────────┐
                      │    Node.js Express Server   │
                      │  (REST API + Matching Engine│
                      │    + JWT / Supabase Client) │
                      └──────────────┬──────────────┘
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           │                                                   │
  (When SUPABASE_URL configured)                     (Fallback Mode)
           │                                                   │
           ▼                                                   ▼
┌────────────────────────────────────┐             ┌────────────────────────┐
│     ⚡ Supabase Cloud Platform      │             │   💾 Local SQLite DB   │
│                                    │             │  (bloodconnect.db)     │
│  • PostgreSQL 15+ Relational DB    │             └────────────────────────┘
│  • Row-Level Security (RLS)        │
│  • Stored Functions (Haversine)    │
│  • Supabase Realtime Engine        │
│  • Full Schema (Users, Donors,     │
│    Requests, Donations, Alerts)    │
└────────────────────────────────────┘
```

---

## 🚀 5-Minute Setup Instructions

### Step 1: Create a Supabase Project

1. Visit [supabase.com](https://supabase.com) and sign in (or sign up for free).
2. Click **New Project**.
3. Choose an Organization, enter a project name (e.g. `bloodconnect-db`), set a strong database password, and pick a region close to you (e.g. `ap-south-1` Mumbai).
4. Wait ~1-2 minutes for your database to provision.

---

### Step 2: Run the Database Schema

1. In your Supabase Dashboard, click on the **SQL Editor** tab (the `>_` icon on the left sidebar).
2. Click **New query**.
3. Open the file in this repository:
   👉 [`database/supabase_schema.sql`](file:///d:/BloodConnect/database/supabase_schema.sql)
4. Copy the entire file content, paste it into the Supabase SQL Editor, and click **Run** (or `Ctrl+Enter`).
5. You should see:
   ```text
   Success. No rows returned.
   ```
   This creates:
   - `public.users` table
   - `public.donors` table
   - `public.hospitals` table
   - `public.blood_requests` table
   - `public.donations` table
   - `public.notifications` table
   - `public.haversine_distance()` PL/pgSQL function
   - `view_active_donors` & `view_request_summary` views
   - Row Level Security (RLS) policies
   - All demo seed data (Rahul Sharma, Ramesh Kumar, Priya Patel, Dr. Arvind Verma, Apollo Hospitals, etc.)

---

### Step 3: Copy Your API Keys into `.env`

1. In your Supabase Dashboard, go to **Project Settings** (gear icon) ➔ **API**.
2. Find the following values:
   - **Project URL** (e.g. `https://xyzcompany.supabase.co`)
   - **Project API Keys** ➔ `anon` `public`
   - **Project API Keys** ➔ `service_role` `secret`
3. Open your local `.env` file in the root folder [`d:/BloodConnect/.env`](file:///d:/BloodConnect/.env):
   ```env
   PORT=5000
   JWT_SECRET=bloodconnect_super_secret_jwt_key_2026
   SPECIAL_ADMIN_KEY=ADMIN@SECURE#2026

   # Paste your Supabase credentials here:
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

### Step 4: Verify the Connection

Run the built-in Supabase verification CLI tool:

```bash
npm run supabase:setup
```

Expected Output:
```text
========================================================
🩸 BloodConnect — Supabase Database Setup & Verification
========================================================

📡 Connecting to Supabase at: https://your-project-id.supabase.co
🔍 Checking database tables...
✅ Connection to Supabase PostgreSQL database verified!
📊 Current Supabase Data:
   - Users:          11
   - Donors:         6
   - Blood Requests: 3
   - Hospitals:      5

✅ Supabase is already initialized and populated with data.

🎉 Supabase backend is ready for BloodConnect!
========================================================
```

---

### Step 5: Start BloodConnect with Supabase

Start or restart the server:

```bash
npm start
```

The server banner will display:
```text
====================================================
🩸 BloodConnect Server is running on port 5000
🗄️  Active Database: ⚡ Supabase (PostgreSQL)
🔗 Local Web App: http://localhost:5000
📊 Admin Panel:   http://localhost:5000/#admin
🩺 API Health:    http://localhost:5000/api/health
⚡ Supabase API:  http://localhost:5000/api/supabase-status
====================================================
```

You can also check the live Supabase status in your browser:
- [http://localhost:5000/api/supabase-status](http://localhost:5000/api/supabase-status)

---

## 🗄️ Database Tables & Schema Reference

| Table | Description | Primary Key | Key Foreign Keys |
| :--- | :--- | :--- | :--- |
| `users` | Accounts, roles (`donor`, `recipient`, `admin`, `hospital`), and auth hashes | `user_id` | — |
| `donors` | Blood group, geo-coordinates, availability flag, 90-day safe window | `donor_id` | `user_id` ➔ `users.user_id` |
| `hospitals` | Registered emergency facilities and blood banks with coordinates | `hospital_id` | — |
| `blood_requests` | Urgent and emergency requests created by recipients | `request_id` | `requester_id` ➔ `users.user_id`, `accepted_by_donor_id` ➔ `donors.donor_id` |
| `donations` | Historical donation records and certificates | `donation_id` | `donor_id` ➔ `donors.donor_id`, `request_id` ➔ `blood_requests.request_id` |
| `notifications` | In-app alerts dispatched to matching donors | `notification_id` | `user_id` ➔ `users.user_id` |

---

## 🔐 Test Accounts & Credentials

Pre-seeded test accounts for testing login through the standard authentication modal:

| Persona | Role | Email | Password | Details |
| :--- | :--- | :--- | :--- | :--- |
| **Rahul Sharma** | 🩸 Donor | `rahul@gmail.com` | `donor123` | O+ Donor, Lingampally |
| **Ramesh Kumar** | 🩸 Donor | `ramesh@gmail.com` | `donor123` | O+ Donor, Chandanagar |
| **Priya Patel** | 🧑 Recipient | `priya@gmail.com` | `recipient123` | Requester |
| **Dr. Arvind Verma** | 🛡️ Admin | `admin@bloodconnect.org` | `admin123` | Central Control Hub |
| **Apollo Hospitals** | 🏥 Hospital | `apollo@bloodconnect.org` | `hospital123` | Blood Bank |

---

## 🎓 Viva Questions & Technical Explanations

1. **Why Supabase over traditional MySQL or MongoDB?**
   - Supabase provides a managed **PostgreSQL** instance with native JSONB, ACID compliance, Row Level Security (RLS), and Realtime WebSocket notifications.
2. **How does Haversine Distance work in PostgreSQL?**
   - Defined via a custom `PL/pgSQL` function `public.haversine_distance(lat1, lon1, lat2, lon2)` using standard spherical trigonometric formulas:
     $$d = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
3. **What is Row Level Security (RLS)?**
   - PostgreSQL RLS enforces security at the database engine level. Even if an unauthorized client makes a query, PostgreSQL automatically filters records that the user has no permissions to view or update.
