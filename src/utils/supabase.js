/* ============================================
   LexiLearn — Supabase Client Utility (Refactored)
   ============================================
   This file now serves as a bridge for backward compatibility.
   New code should import directly from src/core/ or src/services/.
*/

import { isDbConfigured, getSessionToken as getSession } from '../core/db.js';
import { signIn, signUp, signOut, getCurrentUser } from '../core/auth.js';
import { vocabularyService } from '../services/vocabulary.service.js';
import { ieltsService } from '../services/ielts.service.js';
import { classroomService } from '../services/classroom.service.js';
import { userService } from '../services/user.service.js';

// Export core auth functions for backward compatibility
export { 
  isDbConfigured, 
  signIn, 
  signUp, 
  signOut, 
  getCurrentUser, 
  getSession 
};

// Re-export domain methods to maintain API compatibility
export const db = {
  profiles: userService.profiles,
  decks: vocabularyService.decks,
  words: vocabularyService.words,
  books: ieltsService.books,
  tests: ieltsService.tests,
  sections: ieltsService.sections,
  questions: ieltsService.questions,
  classrooms: classroomService.classrooms,
  classroomMembers: classroomService.members,
  materialFolders: classroomService.materials.folders,
  materials: classroomService.materials.items,
  materialClassrooms: classroomService.materialClassrooms,
  assignments: classroomService.assignments,
  assignmentTargets: {
    listByAssignment: (id) => classroomService.assignments.listTargets(id), // Not strictly in service yet but bridgeable
    createMany: (rows) => classroomService.assignments.createTargets(rows),
  },
  submissions: classroomService.submissions,
  submissionAnswers: classroomService.submissions.answers,
  writingSubmissions: classroomService.submissions.writing,
  speakingSubmissions: classroomService.submissions.speaking,
  desks: {
    ...userService.desks,
    // Back-compat aliases (some pages used older naming)
    listForUser: (userId) => userService.desks.listByUser(userId),
  },
  deskItems: userService.desks.items,
  studyEvents: {
    log: (data) => userService.study.logEvent(data),
  },
  progressSnapshots: {
    listForUser: (userId) => userService.study.listProgress(userId),
  },
  notifications: userService.notifications,
  announcements: classroomService.announcements,
  comments: classroomService.feedback.comments,
  progress: {
    // Old SRS progress table (word reviews) + test progress fallback
    logReview: userService.study.logReview,
    save: userService.study.saveProgress,
  },
  readings: vocabularyService.readings,
  dictionary: userService.dictionary
  ,
  sharedDesks: userService.sharedDesks
};

// Helper for IELTS band calculation (moved from old supabase.js)
export const IELTS = {
  estimateBand: (correct, total = 40, module = 'academic') => {
    if (total === 0) return 0;
    if (module === 'academic') {
      if (correct >= 39) return 9.0;
      if (correct >= 37) return 8.5;
      if (correct >= 35) return 8.0;
      if (correct >= 33) return 7.5;
      if (correct >= 30) return 7.0;
      if (correct >= 27) return 6.5;
      if (correct >= 23) return 6.0;
      if (correct >= 19) return 5.5;
      if (correct >= 15) return 5.0;
      if (correct >= 12) return 4.5;
      if (correct >= 9) return 4.0;
      if (correct >= 6) return 3.5;
      if (correct >= 4) return 3.0;
      return 2.5;
    } else {
      if (correct >= 40) return 9.0;
      if (correct >= 39) return 8.5;
      if (correct >= 38) return 8.0;
      if (correct >= 36) return 7.5;
      if (correct >= 34) return 7.0;
      if (correct >= 32) return 6.5;
      if (correct >= 30) return 6.0;
      if (correct >= 27) return 5.5;
      if (correct >= 23) return 5.0;
      if (correct >= 19) return 4.5;
      if (correct >= 15) return 4.0;
      return 3.5;
    }
  }
};
