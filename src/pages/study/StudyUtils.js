/* ============================================
   LexiLearn — Study Utilities
   ============================================
*/

import { escapeHtml } from '../../utils/helpers.js';
import { callAI } from '../../services/ai-gateway.service.js';

export function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightWordInSentence(sentence, word) {
  if (!sentence || !word) return escapeHtml(sentence || '');
  const escaped = escapeRegex(word);
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(sentence).replace(regex, '<span class="study-word-highlight">$1</span>');
}

export function speakWord(word) {
  if (!word || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word.trim());
  u.lang = 'en-US';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

export async function fetchUsageAnalysis(word, sentence, targetSelector) {
  const el = document.querySelector(targetSelector);
  if (!el || !sentence?.trim()) return;
  try {
    const prompt = `Word: "${word}". Example: "${sentence}". In one short Vietnamese sentence, explain how "${word}" is used in this example. Reply with only that explanation, no quotes or preamble.`;
    const text = await callAI('tooltip', prompt, { jsonMode: false, temperature: 0.2 });

    if (text && document.querySelector(targetSelector)) {
      document.querySelector(targetSelector).innerHTML = escapeHtml(typeof text === 'string' ? text.trim() : '').replace(/&lt;br&gt;/g, '<br>');
      document.querySelector(targetSelector).classList.remove('animate-pulse');
    }
  } catch {
    if (document.querySelector(targetSelector)) {
      document.querySelector(targetSelector).innerHTML = '<span class="text-xs text-muted">Analysis unavailable.</span>';
      document.querySelector(targetSelector).classList.remove('animate-pulse');
    }
  }
}

export function parseSynonyms(card) {
  if (!card) return [];
  const s = card.synonyms;
  if (Array.isArray(s)) return s.filter(Boolean).map((x) => String(x).trim());
  if (typeof s === 'string' && s.trim()) return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return [];
}
