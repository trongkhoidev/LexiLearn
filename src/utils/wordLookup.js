/* ============================================
   LexiLearn — Word Lookup Utility
   ============================================
   Provides rich word information via:
   1. localStorage cache (instant)
   2. Free Dictionary API (English definitions, phonetics, examples)
   3. MyMemory Translate API (Vietnamese translations)
*/

import { escapeHtml } from './helpers.js';
import { db } from './supabase.js';

const CACHE_KEY = 'lexilearn_word_cache_v3'; // Bumping version for new logic

// Simple local VN meanings for some common IELTS words as a last-resort fallback
const LOCAL_VI_MEANINGS = {
  sustainable: 'bền vững',
  widely: 'rộng rãi; phổ biến',
  significant: 'đáng kể; quan trọng',
  majority: 'phần lớn; đa số',
  minority: 'thiểu số',
};

export async function lookupWord(word, context = '') {
  const normalizedWord = word.toLowerCase().trim();
  if (!normalizedWord) return null;

  const isPhrase = normalizedWord.includes(' ');

  // 1. Check local cache (Layer 1)
  const cached = getFromCache(normalizedWord);
  if (cached && cached.meaning_vi) {
    const viRejects = ['Look up failed', 'AI rate limit', 'AI đang bị giới hạn', 'Lỗi kết nối'];
    const isBadCache = viRejects.some(str => cached.meaning_vi.includes(str));
    if (!isBadCache) return cached;
  }

  // 2. Check Supabase DB Cache (Layer 2)
  try {
    const dbCached = await db.dictionary.get(normalizedWord);
    if (dbCached && dbCached.meaning_vi) {
      saveToCache(normalizedWord, dbCached); // populate local cache for next time
      return dbCached;
    }
  } catch (err) {
    console.warn("Supabase cache check failed", err);
  }

  // 3. Fallback to APIs (Layer 3)
  let result = null;
  if (isPhrase) {
    result = await lookupPhraseViaAPI(normalizedWord);
  } else {
    result = await lookupViaPublicApis(normalizedWord);
  }

  if (result) {
    // Save to both caches
    saveToCache(normalizedWord, result);
    try {
      await db.dictionary.create(normalizedWord, result);
    } catch(e) { } // Silent fail if DB setup is missing
    return result;
  }

  // 4. Final local dummy fallback so tooltip is never completely empty
  return buildMinimalInfo(normalizedWord);
}

/**
 * Look up phrase via MyMemory Translation API
 */
async function lookupPhraseViaAPI(phrase) {
  let meaning_vi = 'Lỗi kết nối dịch thuật.';
  try {
    const transResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(phrase)}&langpair=en|vi`);
    if (transResponse.ok) {
      const transData = await transResponse.json();
      if (transData.responseData?.translatedText && transData.responseData.translatedText.toLowerCase() !== phrase.toLowerCase()) {
         meaning_vi = transData.responseData.translatedText;
      } else {
         meaning_vi = 'Chưa tìm thấy bản dịch phù hợp.';
      }
    }
  } catch (e) {
    console.warn('Translation API error:', e);
  }

  if (meaning_vi === 'Lỗi kết nối dịch thuật.') return null;

  return {
    word: phrase,
    meaning_vi: meaning_vi,
    isPhrase: true // flag for UI to format differently
  };
}

/**
 * Look up word via Free Dictionary API and translate via MyMemory API
 */
async function lookupViaPublicApis(word) {
  let entries = [];
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (response.ok) {
      entries = await response.json();
    }
  } catch (e) {
    console.warn('Dictionary API error:', e);
  }

  const entry = entries[0] || {};
  const firstMeaning = entry.meanings?.[0];
  const definition = firstMeaning?.definitions?.[0];

  // Extract up to 3 distinct meanings/parts of speech
  const meanings_list = [];
  if (entry.meanings) {
    for (const m of entry.meanings.slice(0, 3)) {
      if (m.definitions && m.definitions.length > 0) {
        meanings_list.push({
          partOfSpeech: m.partOfSpeech || '',
          definition: m.definitions[0].definition,
          example: m.definitions[0].example || ''
        });
      }
    }
  }

  // Fetch Vietnamese translation
  let meaning_vi = LOCAL_VI_MEANINGS[word] || '';
  if (!meaning_vi) {
    try {
      const transResponse = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|vi`);
      if (transResponse.ok) {
        const transData = await transResponse.json();
        // Check if translation seems valid (not just echoing the english word back unless it's identical in VN)
        if (transData.responseData?.translatedText && transData.responseData.translatedText.toLowerCase() !== word.toLowerCase()) {
           meaning_vi = transData.responseData.translatedText;
        } else {
           meaning_vi = 'Chưa tìm thấy nghĩa Tiếng Việt phù hợp.';
        }
      }
    } catch (e) {
      console.warn('Translation API error:', e);
      meaning_vi = 'Lỗi kết nối dịch thuật.';
    }
  }

  if (!entry.word && meaning_vi === 'Lỗi kết nối dịch thuật.') {
     return null; // Both failed completely
  }

  return {
    word: entry.word || word,
    meaning_vi: meaning_vi,
    meanings_list: meanings_list,
    meaning_en: definition?.definition || '', // Legacy fallback
    meaning_en_vi: '', 
    partOfSpeech: firstMeaning?.partOfSpeech || '', // Legacy fallback
    phonetic: entry.phonetic || entry.phonetics?.[0]?.text || '',
    synonyms: (firstMeaning?.synonyms || []).slice(0, 3),
    antonyms: (firstMeaning?.antonyms || []).slice(0, 2),
    collocations: [],
    example: definition?.example || '',
    ielts_tip: '', // Cleaned up since no AI
    difficulty: '',
  };
}

/**
 * Build tooltip HTML from word info
 */
export function buildTooltipHTML(info) {
  if (!info) return '<div class="tooltip-content shadow-xl border-t-4 border-blue-500"><em>No information found</em></div>';

  let html = '<div class="tooltip-content shadow-xl border-t-4 border-blue-500">';

  if (info.isPhrase) {
    html += `<div class="tooltip-header" style="padding-bottom:var(--space-2);margin-bottom:var(--space-2);">
      <div style="font-size:0.75rem;color:#6b7280;font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;">Bản dịch ngữ cảnh</div>
      <strong style="font-size:1.05rem;color:#111827;font-weight:700;line-height:1.4;">"${escapeHtml(info.word)}"</strong>
    </div>`;
    html += `<div style="padding:var(--space-3);background:#eff6ff;border-radius:8px;border-left:4px solid #3b82f6;">
      <div style="color:#1d4ed8;font-size:0.95rem;font-weight:600;line-height:1.5;">🇻🇳 ${escapeHtml(info.meaning_vi)}</div>
    </div>`;
    html += '</div>';
    return html;
  }

  // Word + phonetic (Tag removed from header as we will show it per meaning)
  html += `<div class="tooltip-header" style="border-bottom:1px solid #f3f4f6;padding-bottom:var(--space-2);margin-bottom:var(--space-2);">
    <div class="flex items-center justify-between">
      <strong style="font-size:1.1rem;color:#111827;font-weight:700;">${escapeHtml(info.word)}</strong>
      ${info.difficulty ? `<span style="font-size:10px;font-weight:700;background:#111827;color:white;padding:1px 5px;border-radius:3px;">${info.difficulty}</span>` : ''}
    </div>
    <div class="flex items-center gap-2 mt-1">
      ${info.phonetic ? `<span style="color:#6b7280;font-size:var(--font-size-sm);">${escapeHtml(info.phonetic)}</span>` : ''}
    </div>
  </div>`;

  // Vietnamese translation header
  if (info.meaning_vi) {
    html += `<div style="margin-bottom:var(--space-2);color:#1d4ed8;font-weight:600;font-size:0.95rem;">🇻🇳 ${escapeHtml(info.meaning_vi)}</div>`;
  }

  // Multi-meanings block
  if (info.meanings_list && info.meanings_list.length > 0) {
    html += `<div style="margin-bottom:var(--space-3);display:flex;flex-direction:column;gap:6px;">`;
    info.meanings_list.forEach((m, idx) => {
      html += `<div style="color:#374151;font-size:0.85rem;line-height:1.4;">
        <span style="display:inline-block;color:#0369a1;font-size:9px;padding:1px 5px;border-radius:4px;font-weight:700;text-transform:uppercase;background:#e0f2fe;margin-right:2px;vertical-align:middle;">${escapeHtml(m.partOfSpeech)}</span>
        <span style="vertical-align:middle;">${escapeHtml(m.definition)}</span>
      </div>`;
    });
    html += `</div>`;
  } else if (info.meaning_en) {
    // Legacy support for cached entries without meanings_list
    html += `<div style="margin-bottom:var(--space-3);color:#374151;font-size:var(--font-size-sm);line-height:1.4;">🇬🇧 ${escapeHtml(info.meaning_en)}</div>`;
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
  if (info.meanings_list && info.meanings_list[0] && info.meanings_list[0].example) {
    html += `<div style="margin-bottom:var(--space-3);padding:var(--space-3);background:#f8fafc;border-radius:8px;border-left:4px solid #3b82f6;">
      <span style="color:#64748b;font-size:10px;font-weight:700;">EXAMPLE SENTENCE</span>
      <div style="font-size:var(--font-size-sm);color:#1e293b;font-style:italic;margin-top:2px;line-height:1.5;">"${escapeHtml(info.meanings_list[0].example)}"</div>
    </div>`;
  } else if (info.example) {
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

// Removed getting Gemini api key since it is not used in this file anymore

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
