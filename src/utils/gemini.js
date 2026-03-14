/* ============================================
   Gemini API Integration Utility
   ============================================ */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Extracts vocabulary words from a given text using Gemini API.
 * @param {string} text - The input text or URL to extract from.
 * @returns {Promise<Array>} - Array of word objects.
 */
export async function extractVocabularyFromText(text) {
  const apiKey = 'AIzaSyA-85K3L3BiJjpcu4Siu-xxQT0-dYXKBO8';


  const prompt = `
    You are an expert English teacher. First, extract the most useful and important English vocabulary words or idiomatic phrases from the following text (aim for B1-C2 level words). 
    
    Then, format the result STRICTLY as a JSON array of objects. Do not include markdown formatting like \`\`\`json or \`\`\` in the response. Just the raw JSON array.
    
    For each word/phrase, provide these exact fields:
    - "word": the base form of the word or phrase in English.
    - "partOfSpeech": noun, verb, adjective, adverb, idiom, etc.
    - "meaning": the meaning in Vietnamese.
    - "explanation": a short, clear English explanation.
    - "example": a practical example sentence using the word in context.
    - "synonyms": a comma-separated string of 1-3 synonyms (if applicable, else empty string).
    - "antonyms": a comma-separated string of 1-3 antonyms (if applicable, else empty string).

    Text to analyze:
    """
    ${text}
    """
  `;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0.2, // Low temperature for more deterministic, structured output
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) {
      throw new Error('Invalid response structure from Gemini API.');
    }

    // Attempt to parse JSON
    try {
      const parsed = JSON.parse(resultText);
      return Array.isArray(parsed) ? parsed : [];
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON:", resultText);
      throw new Error('AI returned malformed JSON.');
    }
    
  } catch (error) {
    console.error('Gemini API Error:', error);
    throw error;
  }
}

/**
 * Validates a user's answer against the target word using Gemini.
 * @param {string} userInput - What the user typed.
 * @param {string} targetWord - The correct word.
 * @param {string} context - The sentence or definition used.
 * @returns {Promise<Object>} - { isCorrect: boolean, feedback: string }
 */
export async function validateAnswer(userInput, targetWord, context) {
  const apiKey = 'AIzaSyA-85K3L3BiJjpcu4Siu-xxQT0-dYXKBO8';
  
  const prompt = `
    Context: "${context}"
    Correct word: "${targetWord}"
    User answer: "${userInput}"

    Is the user's answer "close enough" to the correct word? 
    Rules:
    - If it's a minor typo (e.g., "happines" vs "happiness"), it's correct.
    - If it's a synonym that fits perfectly in the context, it's correct.
    - If it's the wrong part of speech but the right root (e.g., "happy" vs "happiness"), it's partially correct but consider it WRONG for strict learning unless it fits the context perfectly.
    - Be strict but helpful.

    Return a JSON object:
    {
      "isCorrect": boolean,
      "feedback": "A short encouragement or correction in Vietnamese"
    }
    
    Do not include markdown formatting.
  `;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
      })
    });

    if (!response.ok) return { isCorrect: userInput.toLowerCase() === targetWord.toLowerCase(), feedback: "" };

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(resultText);
  } catch (error) {
    console.error('Validation Error:', error);
    return { isCorrect: userInput.toLowerCase() === targetWord.toLowerCase(), feedback: "" };
  }
}
