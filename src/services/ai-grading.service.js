/**
 * LexiLearn AI Grading Service (Refactored)
 * Routes Writing/Speaking grading to DeepSeek R1 (reasoning-optimized).
 * Falls back to Groq or Gemini via the gateway.
 */

import { callAI } from './ai-gateway.service.js';

export const aiGradingService = {
  async gradeWriting(essay, taskType, instruction) {
    const prompt = `
      You are an expert IELTS Examiner. Grade the following student essay for IELTS ${taskType.replace(/_/g, ' ')}.
      
      INSTRUCTION: ${instruction || 'Standard IELTS prompt'}
      STUDENT ESSAY:
      """
      ${essay}
      """

      Grade based on 4 IELTS criteria:
      1. Task Response
      2. Coherence and Cohesion
      3. Lexical Resource
      4. Grammatical Range and Accuracy

      Return ONLY a JSON object with this structure:
      {
        "band_score": number, 
        "criteria": {
          "task_response": { "score": number, "feedback": "string" },
          "coherence_cohesion": { "score": number, "feedback": "string" },
          "lexical_resource": { "score": number, "feedback": "string" },
          "grammatical_range": { "score": number, "feedback": "string" }
        },
        "overall_feedback": "string",
        "improvement_tips": ["tip1", "tip2"]
      }
    `;

    return await callAI('writing_grade', prompt, {
      temperature: 0.2,
      systemPrompt: 'You are an expert IELTS Writing Examiner. Return only valid JSON.',
    });
  },

  async gradeSpeaking(transcript, part, instruction) {
    const prompt = `
      You are an expert IELTS Examiner. Grade the following transcript of an IELTS Speaking ${part.replace(/_/g, ' ')} response.
      
      INSTRUCTION: ${instruction || 'Standard IELTS prompt'}
      TRANSCRIPT:
      """
      ${transcript}
      """

      Grade based on 4 IELTS criteria:
      1. Fluency and Coherence
      2. Lexical Resource
      3. Grammatical Range and Accuracy
      4. Pronunciation (Note: Judge based on transcript clarity and word choices)

      Return ONLY a JSON object with this structure:
      {
        "band_score": number, 
        "criteria": {
          "fluency_coherence": { "score": number, "feedback": "string" },
          "lexical_resource": { "score": number, "feedback": "string" },
          "grammatical_range": { "score": number, "feedback": "string" },
          "pronunciation": { "score": number, "feedback": "string" }
        },
        "overall_feedback": "string",
        "improvement_tips": ["tip1", "tip2"]
      }
    `;

    return await callAI('speaking_eval_full', prompt, {
      temperature: 0.2,
      systemPrompt: 'You are an expert IELTS Speaking Examiner. Return only valid JSON.',
    });
  },

  async extractExamBlocks(pdfText) {
    const prompt = `
      Extract IELTS question blocks from the following PDF text.
      TEXT:
      """
      ${pdfText}
      """

      Rules:
      1. Identify start/end question numbers (e.g., 1-5, 6-13).
      2. Identify the block_type (multiple_choice, fill_in_blank, true_false_not_given, matching, etc.).
      3. Identify instructions for each block.
      4. For multiple choice or matching, extract the options.
      5. Try to guess the correct answers if mentioned.

      Return ONLY a JSON array of blocks:
      [{
        "question_start": number,
        "question_end": number,
        "block_type": "string",
        "instruction": "string",
        "config": { "options": ["A. x", "B. y"] },
        "answers": { "1": "A", "2": "B" }
      }]
    `;

    return await callAI('exam_blocks', prompt, { temperature: 0.2 });
  }
};
