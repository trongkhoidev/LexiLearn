export const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Fallback pool of keys provided by the user to avoid rate limits
const FALLBACK_API_KEYS = [
  'AIzaSyDnScRM-sf-ZxRpXqtezIe8tVGQqYR-nCI',
  'AIzaSyAhPPPcszeepv0NnVh6lB5QBXarYS2JdwE',
  'AIzaSyDv5yQ04GH5gqZqIjYGUoSHuHBn-i5O-0M',
  'AIzaSyDoTi1ezvmMPjl-XgIHviaRxcPUtFsNct4',
  'AIzaSyA-85K3L3BiJjpcu4Siu-xxQT0-dYXKBO8'
];

let currentKeyIndex = 0;

export function getGeminiApiKey() {
  try {
    const settings = JSON.parse(localStorage.getItem('lexilearn_settings') || '{}');
    if (settings.geminiApiKey) {
      // Extract valid Gemini keys (starting with AIzaSy) to handle users pasting with "or", "hoặc", spaces, etc.
      const customKeys = (settings.geminiApiKey.match(/AIzaSy[A-Za-z0-9_-]{33}/g) || []);
      if (customKeys.length > 0) {
        return customKeys[currentKeyIndex % customKeys.length];
      }
    }
  } catch { /* ignore */ }
  
  return FALLBACK_API_KEYS[currentKeyIndex % FALLBACK_API_KEYS.length];
}

export function rotateGeminiApiKey() {
  currentKeyIndex++;
  console.log(`Rotating Gemini API Key... Try #${currentKeyIndex + 1}`);
}

/**
 * Enhanced fetch wrapper with automatic key rotation on 429 (Rate Limit) errors
 */
async function fetchWithKeyRotation(bodyData, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const apiKey = getGeminiApiKey();
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(bodyData)
    });

    if (response.status === 400) {
      throw new Error("Mã API Key của bạn không hợp lệ hoặc đã bị khóa. Vui lòng vào Cài đặt để xóa hoặc nhập Key mới.");
    }

    if (response.status === 429 || response.status === 403 || response.status === 500) {
      // 429: Too Many Requests (Rate limit)
      // 403: Often Quota Exceeded
      // 500: Internal server error (sometimes API hiccups)
      console.warn(`Gemini API Error ${response.status} with key ending in ${apiKey.slice(-4)}. Retrying...`);
      rotateGeminiApiKey();
      await new Promise(r => setTimeout(r, 500)); // Short pause before retry
      continue;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API Error: ${response.status}`);
    }

    return response;
  }
  throw new Error("All API keys are currently rate-limited or exhausted.");
}


/**
 * Extracts vocabulary words from a given text using Gemini API.
 * @param {string} text - The input text or URL to extract from.
 * @returns {Promise<Array>} - Array of word objects.
 */
export async function extractVocabularyFromText(text) {
  const apiKey = getGeminiApiKey();


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
    const response = await fetchWithKeyRotation({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2, // Low temperature for more deterministic, structured output
      }
    });

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
 * Scans a reading passage and extracts key collocations, idioms, and topic vocabulary.
 * @param {string} text - The reading passage text.
 * @returns {Promise<Array>} - Array of insight objects.
 */
export async function extractPassageInsights(text) {
  const apiKey = getGeminiApiKey();

  const prompt = `
    You are an expert IELTS reading instructor. Analyze the following reading passage.
    Extract 5 to 8 of the most valuable English vocabulary items for an IELTS student. 
    Focus specifically on:
    - Collocations (e.g., "play a crucial role", "deeply embedded in")
    - Idioms or Phrasal Verbs
    - High-level Topic Vocabulary (C1-C2 level)

    Format the result STRICTLY as a JSON array of objects. Do not include markdown formatting like \`\`\`json or \`\`\`. 

    For each item, provide these exact fields:
    - "phrase": The exact English phrase or word as it appears in the text.
    - "type": Classify it as one of: "Collocation", "Idiom", "Phrasal Verb", or "Topic Vocab".
    - "meaning_vi": A natural, context-accurate Vietnamese translation.
    - "meaning_en": A short English definition.

    Passage to analyze:
    """
    ${text}
    """
  `;

  try {
    const response = await fetchWithKeyRotation({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2, // Low temperature for deterministic output
      }
    });

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) return [];

    try {
      const cleanJson = resultText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("Failed to parse Insights JSON", e);
      return [];
    }
  } catch (error) {
    console.error('Passage Insight Error:', error);
    return [];
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
  const apiKey = getGeminiApiKey();
  
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
    const response = await fetchWithKeyRotation({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json", temperature: 0.1 }
    });

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(resultText);
  } catch (error) {
    console.error('Validation Error:', error);
    return { isCorrect: userInput.toLowerCase() === targetWord.toLowerCase(), feedback: "" };
  }
}

/**
 * Generates distractors (wrong options) for multiple choice questions.
 * @param {string} targetWord - The correct word
 * @param {string} meaning - The right meaning
 * @param {string} pos - Part of speech
 * @param {string} mode - 'recall' or 'meaning' to adjust distractor style
 * @returns {Promise<Array<string>>} - Array of 3 wrong words or meanings
 */
export async function generateDistractors(targetWord, meaning, pos, mode = 'recall', contextSentence = '') {
  const apiKey = getGeminiApiKey();
  
  const prompt = mode === 'recall' ? `
    Generate 3 wrong options (distractors) for a multiple choice English vocabulary question.
    The correct word is: "${targetWord}" (meaning: ${meaning}, part of speech: ${pos || 'unknown'}).
    The word is used in this sentence: "${contextSentence}".
    
    The 3 wrong options SHOULD:
    1. Be the same part of speech as the correct word.
    2. Be valid English words that fit grammatically into the blank in the sentence, but are semantically incorrect.
    3. Look vaguely similar in meaning or spelling to trick a learner, but are clearly incorrect in context.
    4. MUST exactly be 3 single English words.
    
    Return ONLY a JSON array of 3 strings. E.g. ["word1", "word2", "word3"]
  ` : `
    Generate 3 wrong English words (distractors) for a multiple choice English vocabulary question.
    The Vietnamese meaning the user sees is: "${meaning}".
    The correct English word is: "${targetWord}" (part of speech: ${pos || 'unknown'}).
    
    The 3 wrong options SHOULD:
    1. Be valid English words that are commonly found in the same topic or context.
    2. Be in the same part of speech as the correct word.
    3. NOT mean "${meaning}".
    4. MUST exactly be 3 single English words.
    5. CRITICAL: NEVER include the exact Vietnamese meaning "${meaning}" in the distractors. The distractors MUST be in English.
    
    Return ONLY a JSON array of 3 strings. E.g. ["word1", "word2", "word3"]
  `;

  try {
    const response = await fetchWithKeyRotation({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json", temperature: 0.6 }
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const rawDistractors = JSON.parse(text);
    if (Array.isArray(rawDistractors) && rawDistractors.length >= 1) {
      // Filter out any Vietnamese phrases or Exact meaning matches
      let validDistractors = rawDistractors
        .map(d => String(d).trim().toLowerCase())
        .filter(d => {
          // Check if string contains Vietnamese specific characters
          const hasVnChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d);
          const isExactMeaning = d === meaning.toLowerCase();
          return !hasVnChars && !isExactMeaning && d !== targetWord.toLowerCase();
        });
        
      // If we filtered out too many, fill with fallbacks
      const genericFallbacks = ['environment', 'culture', 'tradition', 'system', 'process', 'development', 'condition', 'element'];
      while (validDistractors.length < 3) {
        const fb = genericFallbacks[Math.floor(Math.random() * genericFallbacks.length)];
        if (!validDistractors.includes(fb) && fb !== targetWord.toLowerCase()) {
           validDistractors.push(fb);
        }
      }
      
      return validDistractors.slice(0, 3);
    }
    throw new Error('Invalid distractor format');
  } catch (error) {
    console.warn('Failed to generate distractors, using fallbacks:', error);
    // Generic context-aware fallbacks could be better, but we return some English words at least
    const genericFallbacks = ['environment', 'culture', 'tradition', 'system', 'process', 'development'];
    return genericFallbacks.filter(w => w.toLowerCase() !== targetWord.toLowerCase()).sort(() => 0.5 - Math.random()).slice(0, 3);
  }
}

/**
 * Generates a speaking prompt to elicit the target word in context.
 * @param {string} targetWord - The word to practice
 * @param {string} meaning - Vietnamese meaning
 * @returns {Promise<string>} - The prompt/question in English
 */
export async function generateSpeakingPrompt(targetWord, meaning) {
  const apiKey = getGeminiApiKey();
  
  const prompt = `
    Target Word: "${targetWord}" (Meaning: ${meaning})
    
    Create a highly engaging, situational speaking prompt (in English) that naturally encourages the student to use the target word "${targetWord}" in their answer. 
    The prompt should be 1-2 short sentences. 
    Make it feel like a real conversation question or IELTS speaking part 1/2 question.
    
    Return ONLY the text of the prompt. No markdown, no quotes, no extra text.
  `;

  try {
    const response = await fetchWithKeyRotation({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.8 }
    });

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text.trim();
  } catch (err) {
    console.warn('Failed to generate speaking prompt', err);
  }
  return `Can you make a sentence using the word "${targetWord}"?`;
}

/**
 * Evaluates a user's spoken transcript against the target word.
 * @param {string} transcript - What the user said
 * @param {string} targetWord - The word they needed to say
 * @returns {Promise<Object>} - { score: 'good'|'ok'|'bad', feedback: string }
 */
export async function evaluateSpeaking(transcript, targetWord) {
  const apiKey = getGeminiApiKey();
  
  const prompt = `
    Target Word: "${targetWord}"
    User Transcript: "${transcript}"
    
    Evaluate the user's spoken answer.
    1. Did they use the target word (or a very close morphological variant)?
    2. Was the sentence grammatically coherent?
    
    If they used it correctly and generally made a coherent sentence, score is "good".
    If they used it but the sentence is very unnatural/broken, OR if the speech recognition slightly misheard the target word but the rest is perfect, score is "ok".
    If they completely missed the word or the sentence is nonsense, score is "bad".
    
    Also provide a short, encouraging 1-sentence feedback in Vietnamese explaining why.
    
    Return ONLY JSON:
    {
      "score": "good" | "ok" | "bad",
      "feedback": "string"
    }
  `;

  try {
    const response = await fetchWithKeyRotation({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { response_mime_type: "application/json", temperature: 0.3 }
    });

    const data = await response.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (err) {
    console.error('Failed to evaluate speaking', err);
  }
  
  // Fallback simple validation
  const lowerTranscript = transcript.toLowerCase();
  const lowerWord = targetWord.toLowerCase();
  if (lowerTranscript.includes(lowerWord)) {
    return { score: 'good', feedback: 'Tốt lẵm! Bạn đã dùng đúng từ.' };
  } else if (lowerTranscript.length > 5) {
    return { score: 'ok', feedback: `Câu trả lời có vẻ hợp lý nhưng chưa thấy từ "${targetWord}". (Hoặc do mic nhận diện sai)` };
  } else {
    return { score: 'bad', feedback: `Chưa nghe rõ được câu trả lời. Hãy thử dùng từ "${targetWord}" nhé.` };
  }
}

/**
 * Evaluates a user's spoken answer for a full Mock Interview question.
 * @param {string} transcript - What the user said
 * @param {string} question - The IELTS speaking question asked
 * @param {string} customApiKey - Optional dedicated API key
 * @param {Array} deckVocab - List of words in the current deck to check against
 * @returns {Promise<Object>} - Detailed score breakdown
 */
export async function evaluateCustomSpeaking(transcript, question, customApiKey = '', deckVocab = []) {
  const apiKeyToUse = customApiKey.trim() || getGeminiApiKey();
  
  const vocabListStr = deckVocab.length > 0 ? deckVocab.join(', ') : 'None';

  const prompt = `
    You are an expert IELTS Speaking Examiner. 
    The candidate was asked this question: "${question}"
    The candidate answered: "${transcript}"
    
    Target Vocabulary list from current deck: [${vocabListStr}]

    Task: Evaluate the candidate's answer based on standard IELTS criteria.
    Be encouraging but accurate. Do NOT penalize for obvious speech-to-text minor typos.

    1. Overall Band Score (e.g., "5.5", "6.5")
    2. Breakdown scores (0.0 to 9.0) for:
       - Fluency and Coherence (FC)
       - Lexical Resource (LR) - Check if words from the target list [${vocabListStr}] were used correctly.
       - Grammatical Range and Accuracy (GRA)
       - Pronunciation (P) - Assess based on transcription hints if any.
    3. Constructive Feedback:
       - Pronunciation/Grammar mistakes to fix.
       - Useful words they missed from target list.
    4. Idea Expansion (5W1H advice):
       - Give practical tips to expand using Who, What, When, Where, Why, or How.

    Return ONLY JSON matching this EXACT schema:
    {
      "overall": "string_band_score",
      "criteria": {
         "FC": { "score": "number", "feedback": "string_feedback_vn" },
         "LR": { "score": "number", "feedback": "string_feedback_vn" },
         "GRA": { "score": "number", "feedback": "string_feedback_vn" },
         "P": { "score": "number", "feedback": "string_feedback_vn" }
      },
      "vocab_used": ["string_word_from_deck_list"],
      "vocab_tips": ["string_missing_deck_word_tip_vn"],
      "expansion_5w1h": ["string_bullet_point_vn_expansion_tip"]
    }

    Note: All feedback strings MUST be in Vietnamese for the layout to feel native.
  `;

  try {
    const response = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKeyToUse
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: "application/json", temperature: 0.2 }
      })
    });

    if (!response.ok) {
      if (response.status === 400 && customApiKey) {
        throw new Error("Mã API Key riêng tư của bạn không hợp lệ.");
      }
      if (response.status === 429) {
        throw new Error("Lỗi Quota: API Key này đã vượt quá giới hạn lượt dùng hoặc hết hạn.");
      }
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch (err) {
    console.error('Failed to evaluate custom speaking', err);
    throw err;
  }
}
