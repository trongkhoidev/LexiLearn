
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://itxflxgbcbrwetagtosu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0eGZseGdiY2Jyd2V0YWd0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTQ0NzksImV4cCI6MjA4ODk5MDQ3OX0.syDmAYw5jZmrFGlCeWD_RSL8_iGHITKAZKDUzdf0fkY';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function uploadFile(bucket, filePath, destPath) {
  const fileBuffer = fs.readFileSync(filePath);
  const { data, error } = await supabase.storage.from(bucket).upload(destPath, fileBuffer, {
    upsert: true,
    contentType: filePath.endsWith('.pdf') ? 'application/pdf' : 'audio/mpeg'
  });
  if (error) {
    console.error(`Error uploading ${filePath}:`, error.message);
    return null;
  }
  console.log(`Uploaded ${filePath} to ${data.path}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${data.path}`;
}

async function run() {
  const files = [
    { bucket: 'exam-pdfs', path: '/Users/admin/Development/LexiLearn/The Importance Of Children.pdf', dest: 'reading/children_play.pdf' },
    { bucket: 'exam-pdfs', path: '/Users/admin/Development/LexiLearn/IELTS/cam 13 part 2.pdf', dest: 'listening/cam13_test1.pdf' },
    { bucket: 'exam-pdfs', path: '/Users/admin/Development/LexiLearn/IELTS/IELTS13-Tests1-4CD1Track_02.mp3', dest: 'audio/cam13_t1.mp3' }
  ];

  for (const f of files) {
    await uploadFile(f.bucket, f.path, f.dest);
  }
}

run();
