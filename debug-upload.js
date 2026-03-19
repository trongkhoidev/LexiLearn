const SUPABASE_URL = 'https://itxflxgbcbrwetagtosu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0eGZseGdiY2Jyd2V0YWd0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTQ0NzksImV4cCI6MjA4ODk5MDQ3OX0.syDmAYw5jZmrFGlCeWD_RSL8_iGHITKAZKDUzdf0fkY';

async function test() {
  const fileBlob = new Blob(['helloworld'], { type: 'application/pdf' });
  const bucket = 'exam-pdfs';
  const path = 'cambridge/test/reading.pdf';
  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': fileBlob.type || 'application/octet-stream',
        'x-upsert': 'true'
      },
      body: await fileBlob.arrayBuffer()
    });
    
    if (!response.ok) {
        const err = await response.json();
        console.error('Error response JSON:', err);
    } else {
        const data = await response.json();
        console.log('Success:', data);
    }
  } catch (err) {
    console.error('Network Error:', err);
  }
}

test();
