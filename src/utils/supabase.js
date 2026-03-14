/* ============================================
   LexiLearn — Supabase Client Utility
   ============================================
   Interfaces with the PostgreSQL database.
*/

// These should be set in your .env file or a local config
const SUPABASE_URL = localStorage.getItem('lexilearn_supabase_url') || 'https://itxflxgbcbrwetagtosu.supabase.co';
const SUPABASE_KEY = localStorage.getItem('lexilearn_supabase_key') || 'sb_publishable_9F3h0HLh52pf9LBBsHFJVQ_wfNq1zIM';

/**
 * Check if the database is configured
 * @returns {boolean}
 */
export function isDbConfigured() {
  return !!(SUPABASE_URL && SUPABASE_KEY);
}

/**
 * Generic fetch wrapper for Supabase REST API
 */
async function supabaseFetch(table, options = {}) {
  if (!isDbConfigured()) return [];

  const { select = '*', filters = {}, order = '' } = options;
  let url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}`;

  // Apply filters
  Object.entries(filters).forEach(([key, val]) => {
    if (val === null) {
      url += `&${key}=is.null`;
    } else if (typeof val === 'string' && (val.startsWith('eq.') || val.startsWith('lte.') || val.startsWith('gte.'))) {
      url += `&${key}=${val}`;
    } else {
      url += `&${key}=eq.${val}`;
    }
  });

  if (order) url += `&order=${order}`;

  try {
    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const err = await response.json();
      const msg = err.message || `Failed to fetch from ${table}`;
      // Catch common "missing table" error messages from Supabase
      if (msg.includes('does not exist') || msg.includes('schema cache')) {
         throw new Error(`Table 'public.${table}' is missing. Please run the provided schema.sql in your Supabase SQL Editor.`);
      }
      throw new Error(msg);
    }

    return response.json();
  } catch (err) {
    if (err.message.includes('fetch')) throw new Error(`Network error connecting to Supabase: ${err.message}`);
    throw err;
  }
}

/**
 * Generic insert/update/upsert wrapper
 */
async function supabaseSave(table, data, isUpdate = false, matchKey = 'id') {
  if (!isDbConfigured()) throw new Error('Database not configured');

  let url = `${SUPABASE_URL}/rest/v1/${table}`;
  let method = isUpdate ? 'PATCH' : 'POST';
  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  if (isUpdate) {
    url += `?${matchKey}=eq.${data[matchKey]}`;
  } else {
    // Check for upsert preference if specified
    headers['Prefer'] += ',resolution=merge-duplicates';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    const err = await response.json();
    const msg = err.message || `Failed to save to ${table}`;
    if (msg.includes('does not exist')) {
       throw new Error(`Table 'public.${table}' is missing. Please run the schema SQL in Supabase.`);
    }
    throw new Error(msg);
  }

  return response.json();
}

// ---- Domain Specific Methods ----

export const db = {
  // Vocabulary
  decks: {
    list: () => supabaseFetch('decks', { order: 'created_at.desc' }),
    get: (id) => supabaseFetch('decks', { filters: { id } }).then(res => res[0]),
    create: (data) => supabaseSave('decks', data),
    update: (id, data) => supabaseSave('decks', { ...data, id }, true),
    delete: async (id) => {
      if (!isDbConfigured()) return;
      await fetch(`${SUPABASE_URL}/rest/v1/decks?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
    }
  },

  words: {
    list: () => supabaseFetch('words', { order: 'created_at.desc' }),
    getByDeck: (deckId) => supabaseFetch('words', { filters: { deck_id: deckId }, order: 'created_at.desc' }),
    getDue: (deckId) => {
      let filters = { next_review: `lte.${new Date().toISOString()}` };
      if (deckId) filters.deck_id = deckId;
      return supabaseFetch('words', { filters });
    },
    getById: (id) => supabaseFetch('words', { filters: { id: id } }).then(res => res[0]),
    create: (data) => supabaseSave('words', { ...data, created_at: new Date().toISOString() }),
    update: (id, data) => supabaseSave('words', { ...data, updated_at: new Date().toISOString(), id: id }, true),
    delete: async (id) => {
      if (!isDbConfigured()) return;
      await fetch(`${SUPABASE_URL}/rest/v1/words?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
    }
  },

  // Cambridge IELTS
  books: {
    list: () => supabaseFetch('books', { order: 'book_num.asc' }),
    getTree: async (bookId) => {
      const books = await supabaseFetch('books', { filters: { id: bookId } });
      if (!books.length) return null;
      const tests = await supabaseFetch('tests', { filters: { book_id: bookId }, order: 'test_num.asc' });
      return { ...books[0], tests };
    },
    create: (data) => supabaseSave('books', data),
  },

  tests: {
    get: (id) => supabaseFetch('tests', { filters: { id } }).then(res => res[0])
  },

  progress: {
    get: (targetId, targetType = 'word') => supabaseFetch('user_progress', { filters: { target_id: targetId, target_type: targetType } }),
    save: (data) => supabaseSave('user_progress', data, !!data.id),
    logReview: (wordId, rating, isCorrect) => supabaseSave('user_progress', {
      target_id: wordId,
      target_type: 'word',
      status: isCorrect ? 'correct' : 'incorrect',
      score_raw: rating,
      attempted_at: new Date().toISOString()
    })
  },

  readings: {
    list: () => supabaseFetch('readings', { order: 'created_at.desc' }),
    create: (data) => supabaseSave('readings', data),
    delete: async (id) => {
      if (!isDbConfigured()) return;
      await fetch(`${SUPABASE_URL}/rest/v1/readings?id=eq.${id}`, {
        method: 'DELETE',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
      });
    }
  }
};
