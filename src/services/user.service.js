/* ============================================
   LexiLearn — User & Study Service
   ============================================
   Handles desks, progress, and notifications.
*/

import { supabaseFetch, supabaseSave, supabaseDelete } from '../core/db.js';

export const userService = {
  // Profiles
  profiles: {
    search: (query) => supabaseFetch('profiles', { 
      filters: { 
        or: `full_name.ilike.*${query}*,email.ilike.*${query}*` 
      },
      limit: 10
    }),
    get: (id) => supabaseFetch('profiles', { filters: { id } }).then(res => res[0]),
  },

  desks: {
    listByUser: (userId) =>
      supabaseFetch('desks', {
        filters: { student_id: userId },
        order: 'created_at.desc'
      }),
    get: (id) => supabaseFetch('desks', { filters: { id } }).then(res => res[0]),
    create: (data) => supabaseSave('desks', {
      ...data,
      created_at: new Date().toISOString()
    }),
    update: (id, data) => supabaseSave('desks', { ...data, id, updated_at: new Date().toISOString() }, true),
    
    items: {
      listByDesk: (deskId) =>
        supabaseFetch('desk_items', {
          filters: { desk_id: deskId },
          order: 'created_at.desc'
        }),
      create: (data) => supabaseSave('desk_items', {
        ...data,
        created_at: new Date().toISOString()
      }),
      delete: (id) => supabaseDelete('desk_items', id)
    }
  },

  study: {
    logEvent: (data) => supabaseSave('study_events', {
      ...data,
      created_at: new Date().toISOString()
    }),
    listProgress: (userId) =>
      supabaseFetch('progress_snapshots', {
        filters: { user_id: userId },
        order: 'updated_at.desc'
      }),
    logReview: (wordId, rating, isCorrect) => supabaseSave('user_progress', {
      target_id: wordId,
      target_type: 'word',
      status: isCorrect ? 'correct' : 'incorrect',
      score_raw: rating,
      attempted_at: new Date().toISOString()
    }),
    saveProgress: (data) => supabaseSave('user_progress', data, !!data.id)
  },

  notifications: {
    listForUser: (userId) =>
      supabaseFetch('notifications', {
        filters: { user_id: userId },
        order: 'created_at.desc'
      }),
    create: (data) => supabaseSave('notifications', {
      ...data,
      created_at: new Date().toISOString()
    }),
    markRead: (id) => supabaseSave('notifications', { id, read_at: new Date().toISOString() }, true),
  },

  dictionary: {
    get: async (word) => {
      try {
        const res = await supabaseFetch('dictionary', { filters: { word: word } });
        return res[0] ? res[0].data : null;
      } catch (e) {
        return null;
      }
    },
    create: async (word, data) => {
      try {
        await supabaseSave('dictionary', { word, data }, false, 'word');
      } catch (e) {}
    }
  }
};
