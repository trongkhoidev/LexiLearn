const SUPABASE_URL = 'https://itxflxgbcbrwetagtosu.supabase.co';
const SUPABASE_KEY = 'sb_publishable_9F3h0HLh52pf9LBBsHFJVQ_wfNq1zIM';

async function testAuth(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  console.log(`Login as ${email}:`, data.access_token ? "Success" : data.error_description || data.msg || data.message || "Failed");
}

async function run() {
  await testAuth('admin@gmail.com', 'admin123');
  await testAuth('user1@gmail.com', 'user123');
  await testAuth('admin@lexilearn.com', 'admin123');
  await testAuth('user1@lexilearn.com', 'user123');
  await testAuth('admin@example.com', 'admin123');
  await testAuth('user1@example.com', 'user123');
}

run();
