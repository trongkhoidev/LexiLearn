const SUPABASE_URL = 'https://itxflxgbcbrwetagtosu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9F3h0HLh52pf9LBBsHFJVQ_wfNq1zIM';
const email = 'admin@lexilearn.com';
const password = 'admin123';

async function testAuth() {
  console.log(`Testing Login for ${email}...`);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testAuth();
