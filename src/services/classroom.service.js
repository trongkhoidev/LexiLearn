/* ============================================
   LexiLearn — Classroom Service
   ============================================
   Handles classrooms, assignments, and students.
*/

import { supabaseFetch, supabaseSave, supabaseDelete } from '../core/db.js';
import { getCurrentUser } from '../core/auth.js';

export const classroomService = {
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

  members: {
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

  materials: {
    folders: {
      listRootForTeacher: (teacherId, classroomId = null) =>
        supabaseFetch('material_folders', {
          filters: {
            teacher_id: teacherId,
            classroom_id: classroomId || 'is.null',
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
    items: {
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
    }
  },

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
    answers: {
      listBySubmission: (submissionId) =>
        supabaseFetch('submission_answers', {
          filters: { submission_id: submissionId },
          order: 'question_index.asc'
        }),
      upsertMany: (rows) => Promise.all(rows.map((row) => supabaseSave('submission_answers', row))),
    },
    writing: {
      listByTeacher: (teacherId) => supabaseFetch('writing_submissions', {
        select: '*, submissions!inner(student_id, assignment_id, profiles(full_name))',
        filters: { 'submissions.assignments.teacher_id': teacherId }
      }),
      get: (id) => supabaseFetch('writing_submissions', { filters: { id } }).then(res => res[0]),
      update: (id, data) => supabaseSave('writing_submissions', { ...data, id, updated_at: new Date().toISOString() }, true),
    },
    speaking: {
      listByTeacher: (teacherId) => supabaseFetch('speaking_submissions', {
        select: '*, submissions!inner(student_id, assignment_id, profiles(full_name))',
        filters: { 'submissions.assignments.teacher_id': teacherId }
      }),
      get: (id) => supabaseFetch('speaking_submissions', { filters: { id } }).then(res => res[0]),
      update: (id, data) => supabaseSave('speaking_submissions', { ...data, id, updated_at: new Date().toISOString() }, true),
    }
  },

  announcements: {
    listByClassroom: (classroomId) =>
      supabaseFetch('announcements', {
        filters: { classroom_id: classroomId },
        order: 'created_at.desc'
      }),
    create: (data) => supabaseSave('announcements', {
      ...data,
      created_at: new Date().toISOString()
    }),
  },

  feedback: {
    comments: {
      listBySubmission: (submissionId) =>
        supabaseFetch('comments', {
          select: '*, profile:user_id(full_name,role)',
          filters: { submission_id: submissionId },
          order: 'created_at.asc'
        }),
      create: (data) => supabaseSave('comments', {
        ...data,
        created_at: new Date().toISOString()
      }),
    }
  }
};
