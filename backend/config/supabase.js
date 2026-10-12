require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let supabaseClient = null;
let supabaseAdmin = null;

function isSupabaseConfigured() {
  return Boolean(
    SUPABASE_URL && 
    SUPABASE_URL.trim().length > 0 && 
    (SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY)
  );
}

if (isSupabaseConfigured()) {
  try {
    const keyToUse = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
    
    // Client for public operations
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    // Admin client (bypasses RLS with service role key if available)
    supabaseAdmin = createClient(SUPABASE_URL, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    console.log('⚡ Supabase Client Initialized for BloodConnect URL:', SUPABASE_URL);
  } catch (err) {
    console.error('⚠️ Failed to initialize Supabase Client:', err.message);
  }
}

async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase URL or Key is not configured in .env' };
  }
  try {
    const client = supabaseAdmin || supabaseClient;
    const { data, error } = await client.from('users').select('user_id').limit(1);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, message: 'Connected to Supabase PostgreSQL database successfully!' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  supabaseClient,
  supabaseAdmin,
  isSupabaseConfigured,
  testSupabaseConnection
};
