/* ============================================
   LexiLearn — Gemini Utilities (Refactored)
   ============================================
   All AI calls now route through ai-gateway.service.js.
   This file preserves the public API for backward compatibility.
*/

import { callAI, getProviderKey } from '../services/ai-gateway.service.js';

// ─── Backward-compatible key helpers ────────────────────────────────
export function getGeminiApiKey() {
  return getProviderKey('gemini');
}

export function rotateGeminiApiKey() {
  // No-op: rotation is handled by the gateway's fallback mechanism
  console.log('Key rotation delegated to AI gateway.');
}

// ─── Vocabulary Extraction ──────────────────────────────────────────
export async function extractVocabularyFromText(text) {
  const prompt = `
    You are an expert English teacher. Extract the most useful and important English vocabulary words or idiomatic phrases from the following text (aim for B1-C2 level words). 
    
    Format the result STRICTLY as a JSON array of objects.
    
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

  const result = await callAI('vocab_extract', prompt, { temperature: 0.2 });
  return Array.isArray(result) ? result : [];
}

// ─── Passage Insights ───────────────────────────────────────────────
export async function extractPassageInsights(text) {
  const prompt = `
    You are an expert IELTS reading instructor. Analyze the following reading passage.
    Extract 5 to 8 of the most valuable English vocabulary items for an IELTS student. 
    Focus specifically on:
    - Collocations (e.g., "play a crucial role", "deeply embedded in")
    - Idioms or Phrasal Verbs
    - High-level Topic Vocabulary (C1-C2 level)

    Format the result STRICTLY as a JSON array of objects.

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
    const result = await callAI('passage_insights', prompt, { temperature: 0.2 });
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error('Passage Insight Error:', error);
    return [];
  }
}

// ─── Answer Validation ──────────────────────────────────────────────
export async function validateAnswer(userInput, targetWord, context) {
  const prompt = `
    Context: "${context}"
    Correct word: "${targetWord}"
    User answer: "${userInput}"

    Is the user's answer "close enough" to the correct word? 
    Rules:
    - If it's a minor typo (e.g., "happines" vs "happiness"), it's correct.
    - If it's a synonym that fits perfectly in the context, it's correct.
    - If it's the wrong part of speech but the right root, consider it WRONG unless it fits the context perfectly.
    - Be strict but helpful.

    Return a JSON object:
    {
      "isCorrect": boolean,
      "feedback": "A short encouragement or correction in Vietnamese"
    }
  `;

  try {
    return await callAI('answer_validation', prompt, { temperature: 0.1 });
  } catch (error) {
    console.error('Validation Error:', error);
    return { isCorrect: userInput.toLowerCase() === targetWord.toLowerCase(), feedback: "" };
  }
}

// ─── Distractor Generation ──────────────────────────────────────────
export async function generateDistractors(targetWord, meaning, pos, mode = 'recall', contextSentence = '') {
  const prompt = mode === 'recall' ? `
    Generate 3 wrong options (distractors) for a multiple choice English vocabulary question.
    The correct word is: "${targetWord}" (meaning: ${meaning}, part of speech: ${pos || 'unknown'}).
    The word is used in this sentence: "${contextSentence}".
    
    The 3 wrong options SHOULD:
    1. Be the same part of speech as the correct word.
    2. Be valid English words that fit grammatically but are semantically incorrect.
    3. Look vaguely similar to trick a learner, but are clearly wrong in context.
    4. MUST exactly be 3 single English words.
    
    Return ONLY a JSON array of 3 strings. E.g. ["word1", "word2", "word3"]
  ` : `
    Generate 3 wrong English words (distractors) for a multiple choice English vocabulary question.
    The Vietnamese meaning the user sees is: "${meaning}".
    The correct English word is: "${targetWord}" (part of speech: ${pos || 'unknown'}).
    
    The 3 wrong options SHOULD:
    1. Be valid English words commonly found in the same topic.
    2. Be in the same part of speech as the correct word.
    3. NOT mean "${meaning}".
    4. MUST exactly be 3 single English words.
    5. CRITICAL: NEVER include Vietnamese. Distractors MUST be in English.
    
    Return ONLY a JSON array of 3 strings. E.g. ["word1", "word2", "word3"]
  `;

  try {
    const rawDistractors = await callAI('distractors', prompt, { temperature: 0.6 });
    if (Array.isArray(rawDistractors) && rawDistractors.length >= 1) {
      let validDistractors = rawDistractors
        .map(d => String(d).trim().toLowerCase())
        .filter(d => {
          const hasVnChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(d);
          const isExactMeaning = d === meaning.toLowerCase();
          return !hasVnChars && !isExactMeaning && d !== targetWord.toLowerCase();
        });

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
    const genericFallbacks = ['environment', 'culture', 'tradition', 'system', 'process', 'development'];
    return genericFallbacks.filter(w => w.toLowerCase() !== targetWord.toLowerCase()).sort(() => 0.5 - Math.random()).slice(0, 3);
  }
}

// ─── Speaking Prompt Generation ─────────────────────────────────────
export async function generateSpeakingPrompt(targetWord, meaning) {
  const prompt = `
    Target Word: "${targetWord}" (Meaning: ${meaning})
    
    Create a highly engaging, situational speaking prompt (in English) that naturally encourages the student to use the target word "${targetWord}" in their answer. 
    The prompt should be 1-2 short sentences. 
    Make it feel like a real IELTS speaking part 1/2 question.
    
    Return ONLY the text of the prompt. No markdown, no quotes, no extra text.
  `;

  try {
    const result = await callAI('speaking_prompt', prompt, { jsonMode: false, temperature: 0.8 });
    return typeof result === 'string' ? result.trim() : `Can you make a sentence using the word "${targetWord}"?`;
  } catch (err) {
    console.warn('Failed to generate speaking prompt', err);
    return `Can you make a sentence using the word "${targetWord}"?`;
  }
}

// ─── Speaking Evaluation (Simple) ───────────────────────────────────
export async function evaluateSpeaking(transcript, targetWord) {
  const prompt = `
    Target Word: "${targetWord}"
    User Transcript: "${transcript}"
    
    Evaluate the user's spoken answer.
    1. Did they use the target word (or a very close morphological variant)?
    2. Was the sentence grammatically coherent?
    
    If they used it correctly and made a coherent sentence, score is "good".
    If they used it but the sentence is unnatural/broken, score is "ok".
    If they completely missed the word or the sentence is nonsense, score is "bad".
    
    Provide a short, encouraging 1-sentence feedback in Vietnamese.
    
    Return ONLY JSON:
    { "score": "good" | "ok" | "bad", "feedback": "string" }
  `;

  try {
    return await callAI('speaking_eval', prompt, { temperature: 0.3 });
  } catch (err) {
    console.error('Failed to evaluate speaking', err);
  }

  // Fallback
  const lowerTranscript = transcript.toLowerCase();
  const lowerWord = targetWord.toLowerCase();
  if (lowerTranscript.includes(lowerWord)) {
    return { score: 'good', feedback: 'Tốt lắm! Bạn đã dùng đúng từ.' };
  } else if (lowerTranscript.length > 5) {
    return { score: 'ok', feedback: `Câu trả lời có vẻ hợp lý nhưng chưa thấy từ "${targetWord}".` };
  } else {
    return { score: 'bad', feedback: `Chưa nghe rõ được câu trả lời. Hãy thử dùng từ "${targetWord}" nhé.` };
  }
}

// ─── Full Speaking Evaluation (IELTS Mock Interview) ────────────────
export async function evaluateCustomSpeaking(transcript, question, customApiKey = '', deckVocab = []) {
  const vocabListStr = deckVocab.length > 0 ? deckVocab.join(', ') : 'None';

  const prompt = `
    You are an expert IELTS Speaking Examiner. 
    The candidate was asked: "${question}"
    The candidate answered: "${transcript}"
    
    Target Vocabulary from deck: [${vocabListStr}]

    Task: Evaluate based on IELTS criteria. Be encouraging but accurate.

    1. Overall Band Score (e.g., "5.5", "6.5")
    2. Breakdown scores (0.0 to 9.0):
       - Fluency and Coherence (FC)
       - Lexical Resource (LR) - Check if words from target list were used correctly.
       - Grammatical Range and Accuracy (GRA)
       - Pronunciation (P) - Assess based on transcription hints.
    3. Constructive Feedback (in Vietnamese).
    4. Idea Expansion (5W1H advice, in Vietnamese).

    Return ONLY JSON:
    {
      "overall": "string_band_score",
      "criteria": {
         "FC": { "score": "number", "feedback": "string_feedback_vn" },
         "LR": { "score": "number", "feedback": "string_feedback_vn" },
         "GRA": { "score": "number", "feedback": "string_feedback_vn" },
         "P": { "score": "number", "feedback": "string_feedback_vn" }
      },
      "vocab_used": ["string"],
      "vocab_tips": ["string"],
      "expansion_5w1h": ["string"]
    }
  `;

  return await callAI('speaking_eval_full', prompt, { temperature: 0.2 });
}
