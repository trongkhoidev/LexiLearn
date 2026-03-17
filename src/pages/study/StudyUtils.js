/* ============================================
   LexiLearn — Study Utilities
   ============================================
*/

import { escapeHtml } from '../../utils/helpers.js';
import { GEMINI_API_URL } from '../../utils/gemini.js';

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
    const settings = JSON.parse(localStorage.getItem('lexilearn_settings') || '{}');
    const keys = settings.apiKeys || [{ name: 'Default', key: 'AIzaSyDv5yQ04GH5gqZqIjYGUoSHuHBn-i5O-0M' }];
    const apiKey = settings.selectedApiKey || keys[0].key;
    
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Word: "${word}". Example: "${sentence}". In one short Vietnamese sentence, explain how "${word}" is used in this example. Reply with only that explanation, no quotes or preamble.` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 150 }
      })
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text && document.querySelector(targetSelector)) {
      document.querySelector(targetSelector).innerHTML = escapeHtml(text).replace(/&lt;br&gt;/g, '<br>');
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
