/* ============================================
   LexiLearn — IELTS Exercise Generator (Refactored)
   ============================================
   Routes exercise generation through ai-gateway.service.js.
   Primary: Groq (speed) | Backup: DeepSeek
*/

import { callAI } from '../services/ai-gateway.service.js';

/**
 * Generate IELTS exercises from a passage
 * @param {string} passage - The reading passage text
 * @param {string} band - Target band level (6.0, 7.0, 8.0+)
 * @returns {Promise<Object>} Structured questions
 */
export async function generateExercises(passage, band = '7.0') {
  const prompt = `
    Passage: "${passage.substring(0, 4000)}"

    Target IELTS Band: ${band}

    Task: Generate a set of IELTS Reading exercises based on the passage above.
    Include a mix of these question types:
    1. Multiple Choice (MCQ) - 3 questions
    2. True/False/Not Given (TFNG) - 3 questions
    3. Summary Completion (cloze test) - 4 gaps

    For Band ${band}, ensure the level of vocabulary, paraphrasing, and traps are appropriate. 
    Higher bands should have more subtle distractors and more complex paraphrasing.

    Return the result as a JSON object with this exact structure:
    {
      "title": "A suitable title for the passage",
      "questions": [
        {
          "id": 1,
          "type": "mcq",
          "text": "The question text...",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "answer": "A",
          "explanation": "Explanation linking back to the passage..."
        },
        {
          "id": 4,
          "type": "tfng",
          "text": "The statement text...",
          "answer": "TRUE",
          "explanation": "Explanation..."
        },
        {
          "id": 7,
          "type": "summary",
          "text": "A summary paragraph with gaps like [GAP].",
          "gaps": [
            {"id": 1, "answer": "word1", "explanation": "..."},
            {"id": 2, "answer": "word2", "explanation": "..."}
          ]
        }
      ]
    }
  `;

  return await callAI('exercise_gen', prompt, { temperature: 0.7 });
}
