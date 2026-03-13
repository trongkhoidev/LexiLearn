/* ============================================
   LexiLearn — Free Dictionary API
   ============================================ */

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

/**
 * Lookup a word from Free Dictionary API.
 * @param {string} word
 * @returns {Promise<object|null>}
 */
export async function lookupWord(word) {
  try {
    const res = await fetch(`${API_BASE}/${encodeURIComponent(word.trim().toLowerCase())}`);
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const entry = data[0];
    const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
    const audioUrl = entry.phonetics?.find(p => p.audio)?.audio || '';

    // Gather meanings
    const meanings = [];
    entry.meanings?.forEach(m => {
      m.definitions?.forEach(d => {
        meanings.push({
          partOfSpeech: m.partOfSpeech || '',
          definition: d.definition || '',
          example: d.example || '',
          synonyms: d.synonyms || [],
          antonyms: d.antonyms || [],
        });
      });
    });

    // Top-level synonyms/antonyms
    const synonyms = [...new Set(entry.meanings?.flatMap(m => m.synonyms || []) || [])];
    const antonyms = [...new Set(entry.meanings?.flatMap(m => m.antonyms || []) || [])];

    return {
      word: entry.word,
      phonetic,
      audioUrl,
      meanings,
      synonyms: synonyms.slice(0, 8),
      antonyms: antonyms.slice(0, 8),
    };
  } catch (err) {
    console.warn('Dictionary API error:', err);
    return null;
  }
}
