/* ============================================
   LexiLearn — Core Database Utility
   ============================================
   Low-level wrappers for Supabase REST API.
*/

export const SUPABASE_URL =
  localStorage.getItem('lexilearn_supabase_url') ||
  'https://itxflxgbcbrwetagtosu.supabase.co';

// IMPORTANT: Supabase Auth requires an anon public key (JWT-looking string "eyJ..."),
// not "sb_publishable_*" keys.
export const SUPABASE_KEY =
  localStorage.getItem('lexilearn_supabase_key') ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0eGZseGdiY2Jyd2V0YWd0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0MTQ0NzksImV4cCI6MjA4ODk5MDQ3OX0.syDmAYw5jZmrFGlCeWD_RSL8_iGHITKAZKDUzdf0fkY';

/**
 * Check if the database is configured
 */
export function isDbConfigured() {
  return !!(SUPABASE_URL && SUPABASE_KEY);
}

/**
 * Get the current session token
 */
export function getSessionToken() {
  return localStorage.getItem('lexilearn_token');
}

/**
 * Generic fetch wrapper for Supabase REST API
 */
export async function supabaseFetch(table, options = {}) {
  if (!isDbConfigured()) return [];

  const { select = '*', filters = {}, order = '', limit = null } = options;
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;

  // Apply filters
  Object.entries(filters).forEach(([key, val]) => {
    // PostgREST logical filters
    if ((key === 'or' || key === 'and') && typeof val === 'string' && val.trim()) {
      // Expect val like: "(col.eq.x,col.is.null)"
      url += `&${key}=${encodeURIComponent(val)}`;
      return;
    }

    if (val === null) {
      url += `&${key}=is.null`;
    } else if (typeof val === 'string' && (
      val.startsWith('eq.') || 
      val.startsWith('lte.') || 
      val.startsWith('gte.') || 
      val.startsWith('is.') || 
      val.startsWith('in.') ||
      val.startsWith('or.') ||
      val.startsWith('and.')
    )) {
      url += `&${key}=${val}`;
    } else {
      url += `&${key}=eq.${val}`;
    }
  });

  if (order) url += `&order=${order}`;
  if (limit) url += `&limit=${limit}`;

  const token = getSessionToken();

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token || SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || `Failed to fetch from ${table}`);
    }

    return response.json();
  } catch (err) {
    throw err;
  }
}

/**
 * Generic insert/update/upsert wrapper
 */
export async function supabaseSave(table, data, isUpdate = false, matchKey = 'id') {
  if (!isDbConfigured()) throw new Error('Database not configured');

  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  const method = isUpdate ? 'PATCH' : 'POST';
  const token = getSessionToken();
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${token || SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  if (isUpdate) {
    url += `?${matchKey}=eq.${data[matchKey]}`;
  } else {
    headers['Prefer'] += ',resolution=merge-duplicates';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || `Failed to save to ${table}`);
  }

  return response.json();
}

/**
 * Generic delete wrapper
 */
export async function supabaseDelete(table, id, matchKey = 'id') {
  if (!isDbConfigured()) return;
  
  const token = getSessionToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${matchKey}=eq.${id}`, {
    method: 'DELETE',
    headers: { 
      'apikey': SUPABASE_KEY, 
      'Authorization': `Bearer ${token || SUPABASE_KEY}` 
    }
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || `Failed to delete from ${table}`);
  }
}
