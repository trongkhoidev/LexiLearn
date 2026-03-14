/* ============================================
   LexiLearn — Word Lookup Utility
   ============================================
   Provides rich word information via:
   1. localStorage cache (instant)
   2. Gemini AI (detailed, with IELTS context)
   3. Free Dictionary API (fallback)
*/

import { escapeHtml } from './helpers.js';

const CACHE_KEY = 'lexilearn_word_cache';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Simple local VN meanings for some common IELTS words as a last-resort fallback
const LOCAL_VI_MEANINGS = {
  sustainable: 'bền vững',
  widely: 'rộng rãi; phổ biến',
  significant: 'đáng kể; quan trọng',
  majority: 'phần lớn; đa số',
  minority: 'thiểu số',
};

/**
 * Look up a word with caching and AI enrichment
 */
export async function lookupWord(word, context = '') {
  const normalizedWord = word.toLowerCase().trim();
  if (!normalizedWord || normalizedWord.length < 2) return null;

  // 1. Check cache first
  const cached = getFromCache(normalizedWord);
  if (cached && cached.meaning_vi && cached.meaning_vi !== 'Look up failed - Use Cloud/AI for VN meaning') return cached;

  // 2. Try Gemini AI
  try {
    const result = await lookupViaGeminiWithRetry(normalizedWord, context);
    if (result) {
      saveToCache(normalizedWord, result);
      return result;
    }
  } catch (err) {
    console.warn('Gemini lookup failed:', err.message);
  }

  // 3. Fallback to Free Dictionary API
  try {
    const result = await lookupViaFreeDictionary(normalizedWord);
    if (result) {
      saveToCache(normalizedWord, result);
      return result;
    }
  } catch (err) {
    console.warn('Free Dictionary lookup failed:', err.message);
  }

  // 4. Final local dummy fallback so tooltip is never completely empty
  return buildMinimalInfo(normalizedWord);
}

/**
 * Look up word via Gemini AI with Retry for 429
 */
async function lookupViaGeminiWithRetry(word, context, attempts = 2) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const prompt = `
    Word: "${word}"
    ${context ? `Context sentence: "${context}"` : ''}

    Provide a JSON object with these fields:
    - "word": "${word}"
    - "meaning_vi": Common Vietnamese meaning (concise)
    - "meaning_en": Clear English definition
    - "meaning_en_vi": Vietnamese translation of the English definition
    - "partOfSpeech": part of speech
    - "phonetic": IPA pronunciation
    - "synonyms": array of 3-4 synonyms
    - "antonyms": array of 2 antonyms (if applicable, else empty array)
    - "collocations": array of 4 common collocations
    - "example": one clear example sentence using the word
    - "ielts_tip": one short IELTS usage tip (in Vietnamese)
    - "difficulty": CEFR level (e.g., B2, C1)

    Return ONLY the JSON object. No markdown.
  `;

  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
        })
      });

      if (!response.ok) {
        // Simple retry for 429 with incremental backoff
        if (response.status === 429 && i < attempts - 1) {
          console.log(`Rate limited (429). Retrying in ${1000 * (i + 1)}ms...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
          continue;
        }
        // For the last attempt, if still 429, return a special object so UI can show a helpful message
        if (response.status === 429) {
          return {
            word,
            meaning_vi: 'AI đang bị giới hạn lượt truy cập (rate limit). Hãy thử lại sau ít phút hoặc thêm API key riêng trong phần Settings.',
            meaning_en: 'AI rate limit reached. Please try again later.',
            meaning_en_vi: '',
            partOfSpeech: '',
            phonetic: '',
            synonyms: [],
            antonyms: [],
            collocations: [],
            example: '',
            ielts_tip: '',
            difficulty: '',
          };
        }
        return null;
      }

      const data = await response.json();
      let text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      
      // Clean text from markdown / code fences before parsing
      text = text.replace(/```json\n?|```/g, '').trim();
      return JSON.parse(text);
    } catch (e) {
      if (i === attempts - 1) throw e;
    }
  }
  return null;
}

/**
 * Fallback: Free Dictionary API
 */
async function lookupViaFreeDictionary(word) {
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
  if (!response.ok) return null;

  const [entry] = await response.json();
  if (!entry) return null;

  const firstMeaning = entry.meanings?.[0];
  const definition = firstMeaning?.definitions?.[0];

  return {
    word: entry.word,
    meaning_vi: LOCAL_VI_MEANINGS[word] || 'Tạm thời chưa có nghĩa tiếng Việt. Hãy bật AI hoặc tự thêm nghĩa.',
    meaning_en: definition?.definition || '',
    meaning_en_vi: '',
    partOfSpeech: firstMeaning?.partOfSpeech || '',
    phonetic: entry.phonetic || entry.phonetics?.[0]?.text || '',
    synonyms: (firstMeaning?.synonyms || []).slice(0, 3),
    antonyms: (firstMeaning?.antonyms || []).slice(0, 2),
    collocations: [],
    example: definition?.example || '',
    ielts_tip: '',
  };
}

/**
 * Build tooltip HTML from word info
 */
export function buildTooltipHTML(info) {
  if (!info) return '<div class="tooltip-content shadow-xl border-t-4 border-blue-500"><em>No information found</em></div>';

  let html = '<div class="tooltip-content shadow-xl border-t-4 border-blue-500">';

  // Word + phonetic + Tag
  html += `<div class="tooltip-header" style="border-bottom:1px solid #f3f4f6;padding-bottom:var(--space-2);margin-bottom:var(--space-2);">
    <div class="flex items-center justify-between">
      <strong style="font-size:1.1rem;color:#111827;font-weight:700;">${escapeHtml(info.word)}</strong>
      ${info.difficulty ? `<span style="font-size:10px;font-weight:700;background:#111827;color:white;padding:1px 5px;border-radius:3px;">${info.difficulty}</span>` : ''}
    </div>
    <div class="flex items-center gap-2 mt-1">
      ${info.phonetic ? `<span style="color:#6b7280;font-size:var(--font-size-sm);">${escapeHtml(info.phonetic)}</span>` : ''}
      ${info.partOfSpeech ? `<span style="background:#e0f2fe;color:#0369a1;font-size:10px;padding:1px 6px;border-radius:4px;font-weight:600;text-transform:uppercase;">${escapeHtml(info.partOfSpeech)}</span>` : ''}
    </div>
  </div>`;

  // Meanings block — ensure we always show something if we have at least EN or VI
  if (info.meaning_vi || info.meaning_en || info.meaning_en_vi) {
    html += `<div style="margin-bottom:var(--space-3);">`;
    if (info.meaning_vi) {
      html += `<div style="color:#1d4ed8;font-weight:600;font-size:0.95rem;">🇻🇳 ${escapeHtml(info.meaning_vi)}</div>`;
    }
    if (info.meaning_en) {
      html += `<div style="margin-top:var(--space-1);color:#374151;font-size:var(--font-size-sm);line-height:1.4;">🇬🇧 ${escapeHtml(info.meaning_en)}</div>`;
    }
    if (info.meaning_en_vi) {
      html += `<div style="margin-top:2px;color:#6b7280;font-size:0.75rem;font-style:italic;">(${escapeHtml(info.meaning_en_vi)})</div>`;
    }
    html += `</div>`;
  }

  // Synonyms/Antonyms
  if ((info.synonyms && info.synonyms.length > 0) || (info.antonyms && info.antonyms.length > 0)) {
    html += `<div style="margin-bottom:var(--space-3);display:grid;grid-template-columns:1fr;gap:var(--space-2);">`;
    if (info.synonyms && info.synonyms.length > 0) {
      html += `<div>
        <span style="color:#9ca3af;font-size:10px;font-weight:800;letter-spacing:0.05em;">SYNONYMS</span>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:1px;">
          ${info.synonyms.map(s => `<span style="background:#f9fafb;border:1px solid #f3f4f6;padding:1px 5px;border-radius:3px;font-size:11px;color:#4b5563;">${escapeHtml(s)}</span>`).join('')}
        </div>
      </div>`;
    }
    html += `</div>`;
  }

  // Collocations
  if (info.collocations && info.collocations.length > 0) {
    html += `<div style="margin-bottom:var(--space-3);">
      <span style="color:#9ca3af;font-size:10px;font-weight:800;letter-spacing:0.05em;">COLLOCATIONS</span>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:1px;">
        ${info.collocations.map(c => `<span style="background:#fff7ed;border:1px solid #ffedd5;padding:1px 5px;border-radius:3px;font-size:11px;color:#9a3412;">${escapeHtml(c)}</span>`).join('')}
      </div>
    </div>`;
  }

  // Example
  if (info.example) {
    html += `<div style="margin-bottom:var(--space-3);padding:var(--space-3);background:#f8fafc;border-radius:8px;border-left:4px solid #3b82f6;">
      <span style="color:#64748b;font-size:10px;font-weight:700;">EXAMPLE SENTENCE</span>
      <div style="font-size:var(--font-size-sm);color:#1e293b;font-style:italic;margin-top:2px;line-height:1.5;">"${escapeHtml(info.example)}"</div>
    </div>`;
  }

  // IELTS tip
  if (info.ielts_tip) {
    html += `<div style="padding:var(--space-2) var(--space-3);background:#ecfdf5;border-radius:8px;border:1px solid #d1fae5;">
      <div style="color:#059669;font-weight:800;font-size:10px;display:flex;align-items:center;gap:4px;">
        <span>✨</span> IELTS USAGE TIP
      </div>
      <div style="font-size:0.8rem;color:#065f46;margin-top:2px;line-height:1.4;">${escapeHtml(info.ielts_tip)}</div>
    </div>`;
  }

  html += '</div>';
  return html;
}

// ---- Cache helpers ----
function getFromCache(word) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    return cache[word] || null;
  } catch { return null; }
}

function saveToCache(word, data) {
  try {
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    cache[word] = data;
    // Limit cache to 500 words (evict oldest)
    const keys = Object.keys(cache);
    if (keys.length > 500) {
      delete cache[keys[0]];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

function getGeminiApiKey() {
  // Check if there's a user-stored key first
  try {
    const settings = JSON.parse(localStorage.getItem('lexilearn_settings') || '{}');
    if (settings.geminiApiKey) return settings.geminiApiKey;
  } catch { /* ignore */ }
  // Fallback to hardcoded (may be expired)
  return 'AIzaSyA-85K3L3BiJjpcu4Siu-xxQT0-dYXKBO8';
}

// Minimal info builder used as a final fallback so tooltips never appear completely broken
function buildMinimalInfo(word) {
  const baseMeaning = LOCAL_VI_MEANINGS[word] || 'Không thể tra cứu từ này ngay lúc này. Hãy thử lại sau hoặc nhập nghĩa thủ công.';
  return {
    word,
    meaning_vi: baseMeaning,
    meaning_en: '',
    meaning_en_vi: '',
    partOfSpeech: '',
    phonetic: '',
    synonyms: [],
    antonyms: [],
    collocations: [],
    example: '',
    ielts_tip: '',
    difficulty: '',
  };
}
