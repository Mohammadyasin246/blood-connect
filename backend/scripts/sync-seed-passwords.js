/**
 * Sync real bcrypt password hashes for default demo accounts in Supabase
 */
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');
const bcrypt = require('bcryptjs');

async function syncPasswords() {
  if (!supabaseAdmin) {
    console.error('supabaseAdmin is not configured.');
    process.exit(1);
  }

  const salt = bcrypt.genSaltSync(10);
  const hashPass = (p) => bcrypt.hashSync(p, salt);

  const demoAccounts = [
    { email: 'admin@bloodconnect.org', pass: 'admin123' },
    { email: 'apollo@bloodconnect.org', pass: 'hospital123' },
    { email: 'priya@gmail.com', pass: 'recipient123' },
    { email: 'arjun@gmail.com', pass: 'recipient123' },
    { email: 'deepa@gmail.com', pass: 'recipient123' },
    { email: 'rahul@gmail.com', pass: 'donor123' },
    { email: 'ramesh@gmail.com', pass: 'donor123' },
    { email: 'suresh@gmail.com', pass: 'donor123' },
    { email: 'ananya@gmail.com', pass: 'donor123' },
    { email: 'vikram@gmail.com', pass: 'donor123' },
    { email: 'sneha@gmail.com', pass: 'donor123' }
  ];

  console.log('Syncing real bcrypt password hashes to Supabase users...');
  for (const acc of demoAccounts) {
    const hash = hashPass(acc.pass);
    const { error } = await supabaseAdmin
      .from('users')
      .update({ password_hash: hash })
      .eq('email', acc.email);

    if (error) {
      console.error(`Failed to update ${acc.email}:`, error.message);
    } else {
      console.log(`✅ ${acc.email} password synchronized.`);
    }
  }

  console.log('🎉 All demo account passwords synchronized in Supabase!');
  process.exit(0);
}

syncPasswords();
