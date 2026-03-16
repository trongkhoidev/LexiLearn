import { toSlug } from './url.js';
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
    getBySlug: async (slug) => {
      // First try to find by a column named 'slug'
      try {
        const res = await supabaseFetch('decks', { filters: { slug } });
        if (res && res.length > 0) return res[0];
      } catch (e) {
        // Fallback: if 'slug' column doesn't exist, we'll fetch all and filter in JS 
        // (Less efficient but works for small deck counts without DB migrations)
        const all = await supabaseFetch('decks');
        return all.find(d => toSlug(d.name) === slug);
      }
      return null;
    },
    create: (data) => supabaseSave('decks', { ...data, slug: toSlug(data.name) }),
    update: (id, data) => {
      const updateData = { ...data, id };
      if (data.name) updateData.slug = toSlug(data.name);
      return supabaseSave('decks', updateData, true);
    },
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
    get: async (id) => {
      const tests = await supabaseFetch('tests', { filters: { id } });
      if (!tests.length) return null;
      const test = tests[0];
      
      // Fetch sections (passages)
      const sections = await supabaseFetch('sections', { 
        filters: { test_id: id }, 
        order: 'section_num.asc' 
      });
      
      // Fetch questions for each section
      for (const section of sections) {
        section.questions = await supabaseFetch('questions', {
          filters: { section_id: section.id },
          order: 'question_num.asc'
        });
      }

      test.passages = sections; // Compatibility with TestPlayer.js
      return test;
    },
    getByBook: (bookId) => supabaseFetch('tests', { filters: { book_id: bookId }, order: 'test_num.asc' }),
    create: (data) => supabaseSave('tests', data),
  },

  sections: {
    getByTest: (testId) => supabaseFetch('sections', { filters: { test_id: testId }, order: 'section_num.asc' }),
    create: (data) => supabaseSave('sections', data),
  },

  questions: {
    getBySection: (sectionId) => supabaseFetch('questions', { filters: { section_id: sectionId }, order: 'question_num.asc' }),
    create: (data) => supabaseSave('questions', data),
  },

  // ------------------------------------------
  // Core LexiLearn IELTS Platform (New Schema)
  // ------------------------------------------

  // Users & Classrooms
  classrooms: {
    listByTeacher: (teacherId) => supabaseFetch('classrooms', { filters: { teacher_id: teacherId }, order: 'created_at.desc' }),
    listForStudent: (studentId) => supabaseFetch('classroom_members', {
      select: 'classrooms:classroom_id(*)',
      filters: { student_id: studentId, status: 'eq.active' }
    }),
    get: (id) => supabaseFetch('classrooms', { filters: { id } }).then(res => res[0]),
    create: (data) => supabaseSave('classrooms', { ...data, created_at: new Date().toISOString() }),
    update: (id, data) => supabaseSave('classrooms', { ...data, id, updated_at: new Date().toISOString() }, true),
  },

  classroomMembers: {
    listByClassroom: (classroomId) => supabaseFetch('classroom_members', {
      select: '*, profile:student_id(full_name,email,role)',
      filters: { classroom_id: classroomId }
    }),
    addStudent: (data) => supabaseSave('classroom_members', {
      ...data,
      status: data.status || 'active',
      joined_at: new Date().toISOString()
    }),
    updateStatus: (id, status) => supabaseSave('classroom_members', { id, status }, true),
  },

  // Materials & Folders (teacher-side content tree)
  materialFolders: {
    listRootForTeacher: (teacherId, classroomId = null) =>
      supabaseFetch('material_folders', {
        filters: {
          teacher_id: teacherId,
          classroom_id: classroomId,
          parent_id: 'is.null'
        },
        order: 'created_at.asc'
      }),
    listChildren: (parentId) =>
      supabaseFetch('material_folders', {
        filters: { parent_id: parentId },
        order: 'created_at.asc'
      }),
    create: (data) => supabaseSave('material_folders', {
      ...data,
      created_at: new Date().toISOString()
    }),
  },

  materials: {
    listByFolder: (folderId) =>
      supabaseFetch('materials', {
        filters: { folder_id: folderId },
        order: 'created_at.desc'
      }),
    create: (data) => supabaseSave('materials', {
      ...data,
      created_at: new Date().toISOString()
    }),
    update: (id, data) => supabaseSave('materials', { ...data, id, updated_at: new Date().toISOString() }, true),
  },

  // Assignments & Submissions
  assignments: {
    listByClassroom: (classroomId) =>
      supabaseFetch('assignments', {
        filters: { classroom_id: classroomId },
        order: 'created_at.desc'
      }),
    get: (id) => supabaseFetch('assignments', { filters: { id } }).then(res => res[0]),
    create: (data) => supabaseSave('assignments', {
      ...data,
      created_at: new Date().toISOString()
    }),
    update: (id, data) => supabaseSave('assignments', { ...data, id, updated_at: new Date().toISOString() }, true),
  },

  assignmentTargets: {
    listByAssignment: (assignmentId) =>
      supabaseFetch('assignment_targets', {
        filters: { assignment_id: assignmentId }
      }),
    createMany: (rows) => Promise.all(rows.map((row) => supabaseSave('assignment_targets', row))),
  },

  submissions: {
    listByAssignment: (assignmentId) =>
      supabaseFetch('submissions', {
        filters: { assignment_id: assignmentId },
        order: 'created_at.desc'
      }),
    listByStudent: (studentId) =>
      supabaseFetch('submissions', {
        filters: { student_id: studentId },
        order: 'created_at.desc'
      }),
    get: (id) => supabaseFetch('submissions', { filters: { id } }).then(res => res[0]),
    createOrUpdate: (data) => supabaseSave('submissions', data, !!data.id),
  },

  submissionAnswers: {
    listBySubmission: (submissionId) =>
      supabaseFetch('submission_answers', {
        filters: { submission_id: submissionId },
        order: 'question_index.asc'
      }),
    upsertMany: (rows) => Promise.all(rows.map((row) => supabaseSave('submission_answers', row))),
  },

  // Personal Desk
  desks: {
    listForStudent: (studentId) =>
      supabaseFetch('desks', {
        filters: { student_id: studentId },
        order: 'created_at.desc'
      }),
    get: (id) => supabaseFetch('desks', { filters: { id } }).then(res => res[0]),
    create: (data) => supabaseSave('desks', {
      ...data,
      created_at: new Date().toISOString()
    }),
    update: (id, data) => supabaseSave('desks', { ...data, id, updated_at: new Date().toISOString() }, true),
  },

  deskItems: {
    listByDesk: (deskId) =>
      supabaseFetch('desk_items', {
        filters: { desk_id: deskId },
        order: 'created_at.desc'
      }),
    create: (data) => supabaseSave('desk_items', {
      ...data,
      created_at: new Date().toISOString()
    }),
    update: (id, data) => supabaseSave('desk_items', { ...data, id }, true),
  },

  // Progress & Analytics
  studyEvents: {
    log: (data) => supabaseSave('study_events', {
      ...data,
      created_at: new Date().toISOString()
    }),
  },

  progressSnapshots: {
    listForUser: (userId) =>
      supabaseFetch('progress_snapshots', {
        filters: { user_id: userId },
        order: 'updated_at.desc'
      }),
  },

  notifications: {
    listForUser: (userId) =>
      supabaseFetch('notifications', {
        filters: { user_id: userId },
        order: 'created_at.desc'
      }),
    markRead: (id) => supabaseSave('notifications', { id, read_at: new Date().toISOString() }, true),
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
  },

  // Dictionary Cache
  dictionary: {
    get: async (word) => {
      try {
        const res = await supabaseFetch('dictionary', { filters: { word: word } });
        return res[0] ? res[0].data : null;
      } catch (e) {
        return null; // Fail gracefully if table doesn't exist
      }
    },
    create: async (word, data) => {
      try {
        await supabaseSave('dictionary', { word, data }, false, 'word');
      } catch (e) {
        // Fail gracefully
      }
    }
  }
};
