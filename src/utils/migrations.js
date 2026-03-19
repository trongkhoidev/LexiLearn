import { supabase } from './supabase.js';

export async function addTestColumns() {
  try {
    console.log('[Migration] Checking if test columns exist...');
    
    // We can't directly alter table via supabase-js client if RLS or permissions prevent it,
    // but in local dev with simple setup we can try raw SQL or just handle it gracefully.
    // For LexiLearn, we'll assume the migration is done manually or we just use `skill` and `band_level`
    // in the insert/update payload and Supabase accepts it if the columns exist.
    
    // Actually, a safer approach for this architecture is to verify we can query them:
    const { data, error } = await supabase
      .from('books')
      .select('skill, band_level')
      .limit(1);
      
    if (error && error.code === '42703') { // 42703 is Postgres code for undefined_column
      console.warn('Columns "skill" and "band_level" do not exist on "books" table.');
      console.warn('Please run the following SQL in your Supabase SQL Editor:');
      console.warn(`
        ALTER TABLE books ADD COLUMN IF NOT EXISTS skill text DEFAULT 'reading';
        ALTER TABLE books ADD COLUMN IF NOT EXISTS band_level text DEFAULT '7.0';
      `);
      return false;
    }
    console.log('[Migration] Schema is ready for multi-skill library.');
    return true;
  } catch (err) {
    console.error('[Migration Error]', err);
    return false;
  }
}
