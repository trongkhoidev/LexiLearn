/* ============================================
   LexiLearn — Vocabulary Service
   ============================================
   Handles decks and words logic.
*/

import { supabaseFetch, supabaseSave, supabaseDelete } from '../core/db.js';
import { getCurrentUser } from '../core/auth.js';
import { toSlug } from '../utils/url.js';

export const vocabularyService = {
  decks: {
    list: () => {
      const user = getCurrentUser();
      if (!user) return [];
      return supabaseFetch('decks', { 
        // Public decks (user_id is null) + user's own decks
        filters: { or: `(user_id.eq.${user.id},user_id.is.null)` },
        order: 'created_at.desc' 
      });
    },
    get: (id) => supabaseFetch('decks', { filters: { id } }).then(res => res[0]),
    getBySlug: async (slug) => {
      try {
        const res = await supabaseFetch('decks', { filters: { slug } });
        if (res && res.length > 0) return res[0];
      } catch (e) {
        const all = await vocabularyService.decks.list();
        return all.find(d => toSlug(d.name) === slug);
      }
      return null;
    },
    create: (data) => {
      const user = getCurrentUser();
      return supabaseSave('decks', { ...data, user_id: user?.id, slug: toSlug(data.name) });
    },
    update: (id, data) => {
      const updateData = { ...data, id };
      if (data.name) updateData.slug = toSlug(data.name);
      return supabaseSave('decks', updateData, true);
    },
    delete: (id) => supabaseDelete('decks', id)
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
    delete: (id) => supabaseDelete('words', id)
  },

  readings: {
    list: () => supabaseFetch('readings', { order: 'created_at.desc' }),
    create: (data) => supabaseSave('readings', data),
    delete: (id) => supabaseDelete('readings', id)
  }
};
