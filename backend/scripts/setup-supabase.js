/**
 * BloodConnect — Supabase Initialization and Migration Verification Script
 * Run with: npm run supabase:setup
 */

require('dotenv').config();
const { supabaseAdmin, supabaseClient, isSupabaseConfigured } = require('../config/supabase');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('========================================================');
  console.log('🩸 BloodConnect — Supabase Database Setup & Verification');
  console.log('========================================================\n');

  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase is not configured in your environment.');
    console.log('\nPlease set the following variables in your .env file:');
    console.log('  SUPABASE_URL=https://your-project.supabase.co');
    console.log('  SUPABASE_ANON_KEY=eyJhbGciOi...');
    console.log('  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (optional but recommended for backend)');
    console.log('\nRefer to SUPABASE_SETUP.md for full instructions.\n');
    process.exit(1);
  }

  const client = supabaseAdmin || supabaseClient;
  console.log(`📡 Connecting to Supabase at: ${process.env.SUPABASE_URL}`);

  try {
    // 1. Verify connection to 'users' table
    console.log('🔍 Checking database tables...');
    const { data: users, error: userErr } = await client.from('users').select('user_id, email').limit(5);

    if (userErr) {
      console.error('⚠️ Could not query "users" table from Supabase:', userErr.message);
      console.log('\n💡 Have you executed the SQL schema in Supabase yet?');
      console.log('👉 Steps to run the schema:');
      console.log('   1. Open your Supabase Dashboard: https://supabase.com/dashboard');
      console.log('   2. Go to the "SQL Editor" tab on the left navigation.');
      console.log('   3. Open the file "database/supabase_schema.sql" in this project.');
      console.log('   4. Paste its content into the SQL Editor and click "Run".\n');
      process.exit(1);
    }

    console.log('✅ Connection to Supabase PostgreSQL database verified!');

    // 2. Check table count
    const [
      usersCount,
      donorsCount,
      requestsCount,
      hospitalsCount
    ] = await Promise.all([
      client.from('users').select('*', { count: 'exact', head: true }),
      client.from('donors').select('*', { count: 'exact', head: true }),
      client.from('blood_requests').select('*', { count: 'exact', head: true }),
      client.from('hospitals').select('*', { count: 'exact', head: true })
    ]);

    console.log(`📊 Current Supabase Data:`);
    console.log(`   - Users:          ${usersCount.count || 0}`);
    console.log(`   - Donors:         ${donorsCount.count || 0}`);
    console.log(`   - Blood Requests: ${requestsCount.count || 0}`);
    console.log(`   - Hospitals:      ${hospitalsCount.count || 0}`);

    if ((usersCount.count || 0) === 0) {
      console.log('\n🌱 Supabase tables exist but are currently empty.');
      console.log('Seeding initial demo personas to Supabase...');

      const salt = bcrypt.genSaltSync(10);
      const hashPass = (p) => bcrypt.hashSync(p, salt);

      // 1. Admin
      const { data: adminUser } = await client.from('users').insert({
        name: 'Dr. Arvind Verma',
        email: 'admin@bloodconnect.org',
        phone: '+91 94400 12345',
        password_hash: hashPass('admin123'),
        role: 'admin'
      }).select().single();

      // 2. Hospital
      await client.from('users').insert({
        name: 'Apollo Hospitals Blood Bank',
        email: 'apollo@bloodconnect.org',
        phone: '+91 40 2360 7777',
        password_hash: hashPass('hospital123'),
        role: 'hospital'
      });

      // 3. Recipient
      const { data: priyaUser } = await client.from('users').insert({
        name: 'Priya Patel',
        email: 'priya@gmail.com',
        phone: '+91 98765 43210',
        password_hash: hashPass('recipient123'),
        role: 'recipient'
      }).select().single();

      // 4. Donors
      const { data: rahulUser } = await client.from('users').insert({
        name: 'Rahul Sharma',
        email: 'rahul@gmail.com',
        phone: '+91 91234 56780',
        password_hash: hashPass('donor123'),
        role: 'donor'
      }).select().single();

      if (rahulUser) {
        await client.from('donors').insert({
          user_id: rahulUser.user_id,
          blood_group: 'O+',
          gender: 'male',
          date_of_birth: '1998-04-12',
          city: 'Hyderabad',
          area: 'Lingampally',
          latitude: 17.4938,
          longitude: 78.3188,
          last_donation_date: '2026-05-15',
          availability: true,
          total_donations: 5,
          is_verified: true
        });
      }

      const { data: rameshUser } = await client.from('users').insert({
        name: 'Ramesh Kumar',
        email: 'ramesh@gmail.com',
        phone: '+91 91234 56781',
        password_hash: hashPass('donor123'),
        role: 'donor'
      }).select().single();

      if (rameshUser) {
        await client.from('donors').insert({
          user_id: rameshUser.user_id,
          blood_group: 'O+',
          gender: 'male',
          date_of_birth: '1996-08-20',
          city: 'Hyderabad',
          area: 'Chandanagar',
          latitude: 17.4900,
          longitude: 78.3300,
          last_donation_date: '2026-04-10',
          availability: true,
          total_donations: 3,
          is_verified: true
        });
      }

      // 5. Hospitals
      await client.from('hospitals').insert([
        {
          name: 'Apollo Hospitals',
          city: 'Hyderabad',
          area: 'Jubilee Hills',
          address: 'Road No 72, Film Nagar, Jubilee Hills',
          latitude: 17.4265,
          longitude: 78.4124,
          phone: '+91 40 2360 7777',
          emergency_contact: '1066',
          blood_bank_available: true
        },
        {
          name: 'Citizens Specialty Hospital',
          city: 'Hyderabad',
          area: 'Nallagandla',
          address: 'Near Lingampally Station, Nallagandla',
          latitude: 17.4721,
          longitude: 78.3075,
          phone: '+91 40 6719 1919',
          emergency_contact: '040-67199999',
          blood_bank_available: true
        }
      ]);

      // 6. Request
      if (priyaUser) {
        await client.from('blood_requests').insert({
          requester_id: priyaUser.user_id,
          patient_name: 'Rajesh Patel',
          blood_group: 'O+',
          units_required: 2,
          hospital: 'Citizens Specialty Hospital, Nallagandla',
          city: 'Hyderabad',
          area: 'Lingampally',
          latitude: 17.4721,
          longitude: 78.3075,
          required_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          urgency: 'emergency',
          status: 'open',
          additional_notes: 'Urgent cardiac bypass requirement.'
        });
      }

      console.log('✅ Demo seed data created successfully in Supabase!');
    } else {
      console.log('\n✅ Supabase is already initialized and populated with data.');
    }

    console.log('\n🎉 Supabase backend is ready for BloodConnect!');
    console.log('========================================================\n');
  } catch (err) {
    console.error('❌ Error during Supabase setup:', err.message);
    process.exit(1);
  }
}

main();
