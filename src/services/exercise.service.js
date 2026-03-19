import { supabaseFetch, supabaseSave, supabaseDelete, supabaseUpload } from '../core/db.js';

export const exerciseService = {
  // EXAMS
  async listExams(filters = {}) {
    return await supabaseFetch('exams', {
      select: '*',
      order: 'created_at',
      ascending: false,
      ...filters
    });
  },

  async getExam(id) {
    const exams = await supabaseFetch('exams', {
      select: '*, question_blocks(*)',
      filter: { id: `eq.${id}` }
    });
    return exams?.[0] || null;
  },

  async saveExam(data) {
    return await supabaseSave('exams', data);
  },

  async deleteExam(id) {
    return await supabaseDelete('exams', id);
  },

  // QUESTION BLOCKS
  async saveQuestionBlock(data) {
    return await supabaseSave('question_blocks', data);
  },

  async deleteQuestionBlock(id) {
    return await supabaseDelete('question_blocks', id);
  },

  async getQuestionBlocks(examId) {
    return await supabaseFetch('question_blocks', {
      select: '*',
      filter: { exam_id: `eq.${examId}` },
      order: 'block_order',
      ascending: true
    });
  },

  // SUBMISSIONS
  async startSubmission(examId, studentId, assignmentId = null) {
    // Check for existing in-progress submission
    const existing = await supabaseFetch('exam_submissions', {
      select: '*',
      filter: {
        exam_id: `eq.${examId}`,
        student_id: `eq.${studentId}`,
        status: 'eq.in_progress'
      }
    });

    if (existing?.[0]) return existing[0];

    const data = {
      exam_id: examId,
      student_id: studentId,
      assignment_id: assignmentId,
      status: 'in_progress',
      started_at: new Date().toISOString()
    };
    const rows = await supabaseSave('exam_submissions', data);
    return rows[0];
  },

  async getSubmission(id) {
    const submissions = await supabaseFetch('exam_submissions', {
      select: '*, exam_answers(*)',
      filter: { id: `eq.${id}` }
    });
    return submissions?.[0] || null;
  },

  async updateSubmission(id, data) {
    return await supabaseSave('exam_submissions', { id, ...data });
  },

  async getSubmissionsByExam(examId) {
    return await supabaseFetch('exam_submissions', {
      select: '*, profiles:student_id(full_name, email)',
      filter: { exam_id: `eq.${examId}` },
      order: 'submitted_at',
      ascending: false
    });
  },
  
  async getUserSubmissions(studentId) {
    return await supabaseFetch('exam_submissions', {
      select: '*, exams:exam_id(title, module, total_questions)',
      filter: { student_id: `eq.${studentId}`, status: 'eq.submitted' },
      order: 'submitted_at',
      ascending: false
    });
  },

  // ANSWERS (Detailed)
  async saveAnswer(data) {
    // data should include submission_id, block_id, question_num, user_answer/user_answers
    return await supabaseSave('exam_answers', data);
  },

  async saveAnswers(answersArray) {
    // Bulk upsert if backend supports it, otherwise loop
    // In LexiLearn, supabaseSave handles lists by default if we use RPC or direct REST
    // Since our db.js might not handle bulk perfectly, we'll try to pass the array
    return await supabaseSave('exam_answers', answersArray);
  },

  async getAnswers(submissionId) {
    return await supabaseFetch('exam_answers', {
      select: '*',
      filter: { submission_id: `eq.${submissionId}` }
    });
  },

  // MEDIA
  async uploadAudio(submissionId, qNum, blob) {
    const fileName = `audio_${submissionId}_${qNum}_${Date.now()}.webm`;
    const path = `submissions/${submissionId}/${fileName}`;
    await supabaseUpload('exam-pdfs', path, blob); // Using existing bucket for now, or create 'exam-media'
    
    // Return the public URL (assuming public bucket)
    const { SUPABASE_URL } = await import('../core/db.js');
    return `${SUPABASE_URL}/storage/v1/object/public/exam-pdfs/${path}`;
  }
};
