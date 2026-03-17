/* ============================================
   LexiLearn — IELTS Service
   ============================================
   Handles Cambridge books, tests, and questions.
*/

import { supabaseFetch, supabaseSave } from '../core/db.js';

export const ieltsService = {
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
      const sections = await supabaseFetch('sections', { 
        filters: { test_id: id }, 
        order: 'section_num.asc' 
      });
      for (const section of sections) {
        section.questions = await supabaseFetch('questions', {
          filters: { section_id: section.id },
          order: 'question_num.asc'
        });
      }
      test.passages = sections;
      return test;
    },
    getByBook: (bookId) => supabaseFetch('tests', { filters: { book_id: bookId }, order: 'test_num.asc' }),
    create: (data) => supabaseSave('tests', data),
  },

  sections: {
    getByTest: (testId) => supabaseFetch('sections', { filters: { test_id: testId }, order: 'section_num.asc' }),
    get: (id) => supabaseFetch('sections', { filters: { id } }).then(res => res[0]),
    create: (data) => supabaseSave('sections', data),
  },

  questions: {
    getBySection: (sectionId) => supabaseFetch('questions', { filters: { section_id: sectionId }, order: 'question_num.asc' }),
    create: (data) => supabaseSave('questions', data),
  }
};
