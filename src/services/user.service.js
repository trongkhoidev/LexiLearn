/* ============================================
   LexiLearn — User & Study Service
   ============================================
   Handles desks, progress, and notifications.
*/

import { supabaseFetch, supabaseSave, supabaseDelete, supabaseDeleteWhere } from '../core/db.js';

export const userService = {
  // Profiles
  profiles: {
    listStudents: ({ limit = 50, offset = 0 } = {}) =>
      supabaseFetch('profiles', {
        filters: { role: 'eq.student' },
        order: 'created_at.desc',
        limit,
        offset,
      }),
    search: (query) => {
      const q = String(query || '')
        .trim()
        // Avoid breaking PostgREST logic syntax
        .replace(/[(),]/g, ' ')
        .replace(/\s+/g, ' ');

      if (!q) return Promise.resolve([]);

      return supabaseFetch('profiles', {
        filters: {
          role: 'eq.student',
          // PostgREST expects: or=(cond1,cond2)
          or: `(full_name.ilike.*${q}*,email.ilike.*${q}*)`
        },
        limit: 10
      });
    },
    get: (id) => supabaseFetch('profiles', { filters: { id } }).then(res => res[0]),
    update: (id, data) => supabaseSave('profiles', { ...data, id, updated_at: new Date().toISOString() }, true),
  },

  desks: {
    listByUser: (userId) =>
      supabaseFetch('desks', {
        // Embed items so dashboards can render recents without extra roundtrips
        select: '*, items:desk_items(*)',
        filters: { student_id: userId },
        order: 'created_at.desc',
        limit: 1
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

  sharedDesks: {
    // Teacher
    listByTeacher: (teacherId) =>
      supabaseFetch('shared_desks', { filters: { teacher_id: teacherId }, order: 'created_at.desc' }),
    get: (id) => supabaseFetch('shared_desks', { filters: { id } }).then(res => res[0]),
    create: (data) => supabaseSave('shared_desks', { ...data, created_at: new Date().toISOString() }),
    update: (id, data) => supabaseSave('shared_desks', { ...data, id, updated_at: new Date().toISOString() }, true),

    listClassrooms: (deskId) =>
      supabaseFetch('shared_desk_classrooms', { filters: { desk_id: deskId }, order: 'created_at.asc' }),

    setClassrooms: async (deskId, classroomIds) => {
      const desired = new Set((classroomIds || []).map(String));
      const existing = await supabaseFetch('shared_desk_classrooms', { filters: { desk_id: deskId } }).catch(() => []);

      // Delete mappings that are no longer selected (strict sync)
      const toDelete = (existing || []).filter(r => !desired.has(String(r.classroom_id)));
      await Promise.all(toDelete.map(r => supabaseDeleteWhere('shared_desk_classrooms', { desk_id: `eq.${deskId}`, classroom_id: `eq.${r.classroom_id}` })));

      // Upsert desired mappings
      const toUpsert = [...desired].map(classroom_id => ({ desk_id: deskId, classroom_id }));
      await Promise.all(toUpsert.map(r => supabaseSave('shared_desk_classrooms', r)));
      return toUpsert;
    },

    // Student
    listForStudent: (studentId) =>
      supabaseFetch('shared_desks', {
        // RLS enforces access; studentId isn't needed but kept for signature symmetry
        order: 'created_at.desc'
      }),

    topics: {
      listByDesk: (deskId) =>
        supabaseFetch('shared_desk_topics', { filters: { desk_id: deskId }, order: 'order_index.asc' }),
      get: (id) => supabaseFetch('shared_desk_topics', { filters: { id } }).then(res => res[0]),
      create: (data) => supabaseSave('shared_desk_topics', { ...data, created_at: new Date().toISOString() }),
      update: (id, data) => supabaseSave('shared_desk_topics', { ...data, id, updated_at: new Date().toISOString() }, true),
    },

    items: {
      listByTopic: (topicId) =>
        supabaseFetch('shared_desk_topic_items', { filters: { topic_id: topicId }, order: 'order_index.asc' }),
      create: (data) => supabaseSave('shared_desk_topic_items', { ...data, created_at: new Date().toISOString() }),
      delete: (id) => supabaseDelete('shared_desk_topic_items', id),
    },

    progress: {
      listByStudent: (studentId) =>
        supabaseFetch('shared_desk_topic_progress', { filters: { student_id: studentId }, order: 'updated_at.desc' }),
      listByDesk: (deskId) =>
        supabaseFetch('shared_desk_topic_progress', {
          select: '*, topic:topic_id(id,desk_id,title)',
          filters: { 'topic.desk_id': deskId },
          order: 'updated_at.desc'
        }),
      get: (topicId, studentId) =>
        supabaseFetch('shared_desk_topic_progress', { filters: { topic_id: topicId, student_id: studentId } }),
      upsert: (data) => supabaseSave('shared_desk_topic_progress', { ...data, updated_at: new Date().toISOString() }),
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
