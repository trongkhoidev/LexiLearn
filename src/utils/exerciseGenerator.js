/* ============================================
   LexiLearn — IELTS Exercise Generator
   ============================================
   Uses Gemini AI to generate structured IELTS questions from text.
*/

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Generate IELTS exercises from a passage
 * @param {string} passage - The reading passage text
 * @param {string} band - Target band level (6.0, 7.0, 8.0+)
 * @returns {Promise<Object>} Structured questions
 */
export async function generateExercises(passage, band = '7.0') {
  const apiKey = getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is required for exercise generation.');

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
          "answer": "TRUE", // or FALSE or NOT GIVEN
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

    Return ONLY the JSON. No markdown.
  `;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        response_mime_type: 'application/json',
        temperature: 0.7 
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to generate exercises');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('AI returned an empty response');

  return JSON.parse(text);
}

function getGeminiApiKey() {
  try {
    const settings = JSON.parse(localStorage.getItem('lexilearn_settings') || '{}');
    if (settings.geminiApiKey) return settings.geminiApiKey;
  } catch { /* ignore */ }
  // Fallback to hardcoded (may be blocked)
  return 'AIzaSyA-85K3L3BiJjpcu4Siu-xxQT0-dYXKBO8';
}
