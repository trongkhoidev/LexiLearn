/* ============================================
   LexiLearn — Bulk Import Utility
   ============================================ */

/**
 * Parse pasted raw text (from Excel, Word, etc.) into word objects.
 * Handles custom delimiters for terms and cards.
 * @param {string} text - Raw pasted text.
 * @param {string} termDelim - Delimiter between word, meaning, etc. (e.g. '\t', ',')
 * @param {string} cardDelim - Delimiter between rows (e.g. '\n', ';')
 * @returns {Array} - Array of parsed word objects.
 */
export function parsePastedText(text, termDelim, cardDelim) {
  if (!text || !text.trim()) return [];

  // Split text into cards (rows)
  const rows = text.split(cardDelim).map(r => r.trim()).filter(r => r.length > 0);
  const words = [];

  for (let i = 0; i < rows.length; i++) {
    // Split row into columns based on term delimiter
    const cols = rows[i].split(termDelim).map(c => c.trim());
    
    // Minimum requirement: Word & Meaning
    if (cols.length < 2) continue;

    const wordObj = {
      word: cols[0],
      meaning: cols[1],
      phonetic: cols[2] || '',
      partOfSpeech: cols[3] || '',
      example: cols[4] || '',
      synonyms: cols[5] || '',
      explanation: '', // Not typically in the simple paste format, but can be added later
      exampleMeaning: '',
      antonyms: '',
      notes: 'Imported',
      tags: '',
    };

    words.push(wordObj);
  }

  return words;
}
