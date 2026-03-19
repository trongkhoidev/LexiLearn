const SUPABASE_URL = 'https://itxflxgbcbrwetagtosu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0eGZseGdiY2Jyd2V0YWd0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTQ0NzksImV4cCI6MjA4ODk5MDQ3OX0.syDmAYw5jZmrFGlCeWD_RSL8_iGHITKAZKDUzdf0fkY';

async function listBuckets() {
  try {
    const response = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    
    const data = await response.json();
    console.log('Buckets:', data);
  } catch (err) {
    console.error('Error:', err);
  }
}

listBuckets();
