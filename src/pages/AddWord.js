/* ============================================
   LexiLearn — Add / Edit Word Page
   ============================================ */

import { getDecks, saveWord, getWordById } from '../data/store.js';
import { navigateTo, getCurrentRoute } from '../router.js';
import { lookupWord } from '../utils/api.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/helpers.js';

export function renderAddWord(container) {
  // Parse query params
  const hash = getCurrentRoute();
  const qIdx = hash.indexOf('?');
  const params = new URLSearchParams(qIdx >= 0 ? hash.slice(qIdx) : '');
  const editId = params.get('edit');
  const preselectedDeck = params.get('deck');
  const isEdit = !!editId;
  const existingWord = isEdit ? getWordById(editId) : null;

  const decks = getDecks();
  const ew = existingWord || {};

  container.innerHTML = `
    <div class="animate-fade-in-up" style="max-width:720px;">
      <button class="btn btn-ghost btn-sm" id="back-btn" style="margin-bottom:var(--space-6);">← Back</button>

      <div style="margin-bottom:var(--space-8);">
        <h1 style="font-size:var(--font-size-2xl);font-weight:700;color:#1f2937;margin-bottom:var(--space-2);">${isEdit ? 'Edit Word' : 'Add New Word'}</h1>
        <p style="color:#6b7280;font-size:var(--font-size-base);">${isEdit ? 'Update the word details and save your changes.' : 'Enter a new vocabulary word with meaning, example, and related words.'}</p>
      </div>

      <div class="card" style="padding:var(--space-8);">
        <form id="word-form" class="flex flex-col gap-5">
          <!-- Word + Auto-lookup -->
          <div class="flex gap-4 items-end">
            <div class="input-group" style="flex:1;">
              <label>Word *</label>
              <input class="input" id="word-input" value="${escapeHtml(ew.word || '')}" placeholder="e.g. abandon" required>
            </div>
            <button type="button" class="btn btn-secondary" id="lookup-btn" style="height:42px;">
              🔍 Auto Lookup
            </button>
          </div>

          <!-- Phonetic + Audio -->
          <div id="phonetic-section" class="flex items-center gap-4" style="display:${ew.phonetic ? 'flex' : 'none'};">
            <span class="text-muted" id="phonetic-display">${escapeHtml(ew.phonetic || '')}</span>
            <button type="button" class="btn btn-ghost btn-sm" id="play-audio-btn" style="display:${ew.audioUrl ? 'inline-flex' : 'none'};">🔊 Play</button>
            <audio id="word-audio" src="${ew.audioUrl || ''}"></audio>
          </div>

          <!-- Part of Speech -->
          <div class="input-group">
            <label>Part of Speech</label>
            <select class="input" id="pos-input">
              <option value="">Select...</option>
              ${['noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun', 'interjection', 'phrase'].map(pos =>
                `<option value="${pos}" ${ew.partOfSpeech === pos ? 'selected' : ''}>${pos}</option>`
              ).join('')}
            </select>
          </div>

          <!-- Meaning (Vietnamese) -->
          <div class="input-group">
            <label>Meaning (Vietnamese) *</label>
            <input class="input" id="meaning-input" value="${escapeHtml(ew.meaning || '')}" placeholder="e.g. từ bỏ" required>
          </div>

          <!-- English Explanation -->
          <div class="input-group">
            <label>English Explanation</label>
            <textarea class="textarea" id="explanation-input" placeholder="e.g. to leave something permanently" rows="2">${escapeHtml(ew.explanation || '')}</textarea>
          </div>

          <!-- Example Sentence -->
          <div class="input-group">
            <label>Example Sentence</label>
            <input class="input" id="example-input" value="${escapeHtml(ew.example || '')}" placeholder="e.g. He abandoned the project.">
          </div>

          <!-- Example Meaning -->
          <div class="input-group">
            <label>Example Meaning</label>
            <input class="input" id="example-meaning-input" value="${escapeHtml(ew.exampleMeaning || '')}" placeholder="e.g. Anh ấy đã từ bỏ dự án">
          </div>

          <!-- Synonyms -->
          <div class="input-group">
            <label>Synonyms <span class="text-muted text-sm">(comma separated)</span></label>
            <input class="input" id="synonyms-input" value="${escapeHtml(ew.synonyms || '')}" placeholder="e.g. leave, quit, desert">
          </div>

          <!-- Antonyms -->
          <div class="input-group">
            <label>Antonyms <span class="text-muted text-sm">(comma separated)</span></label>
            <input class="input" id="antonyms-input" value="${escapeHtml(ew.antonyms || '')}" placeholder="e.g. continue, persist">
          </div>

          <!-- Tags -->
          <div class="input-group">
            <label>Tags <span class="text-muted text-sm">(comma separated)</span></label>
            <input class="input" id="tags-input" value="${escapeHtml(ew.tags || '')}" placeholder="e.g. IELTS, Writing, Academic">
          </div>

          <!-- Deck -->
          <div class="input-group">
            <label>Deck</label>
            <select class="input" id="deck-input">
              <option value="">No deck</option>
              ${decks.map(d => `<option value="${d.id}" ${(ew.deckId || preselectedDeck) === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
            </select>
          </div>

          <!-- Notes -->
          <div class="input-group">
            <label>Notes</label>
            <textarea class="textarea" id="notes-input" placeholder="e.g. IELTS Writing useful word" rows="2">${escapeHtml(ew.notes || '')}</textarea>
          </div>

          <!-- Submit -->
          <div class="flex gap-3" style="margin-top:var(--space-4);">
            <button type="submit" class="btn btn-primary" style="flex:1;padding:var(--space-4);">
              ${isEdit ? 'Update Word' : 'Add Word'}
            </button>
            ${!isEdit ? '<button type="button" class="btn btn-secondary" id="add-another-btn" style="flex:1;padding:var(--space-4);">Add & New</button>' : ''}
          </div>
        </form>
      </div>
    </div>
  `;

  let currentAudioUrl = ew.audioUrl || '';

  // Back button
  container.querySelector('#back-btn').addEventListener('click', () => {
    window.history.back();
  });

  // Auto-lookup
  container.querySelector('#lookup-btn').addEventListener('click', async () => {
    const word = document.getElementById('word-input').value.trim();
    if (!word) return showToast('Enter a word first', 'info');

    const btn = container.querySelector('#lookup-btn');
    btn.textContent = '⏳ Looking up...';
    btn.disabled = true;

    const result = await lookupWord(word);

    btn.textContent = '🔍 Auto Lookup';
    btn.disabled = false;

    if (!result) return showToast('Word not found in dictionary', 'error');

    // Fill fields
    if (result.phonetic) {
      document.getElementById('phonetic-display').textContent = result.phonetic;
      document.getElementById('phonetic-section').style.display = 'flex';
    }
    if (result.audioUrl) {
      currentAudioUrl = result.audioUrl;
      document.getElementById('word-audio').src = result.audioUrl;
      document.getElementById('play-audio-btn').style.display = 'inline-flex';
    }
    if (result.meanings?.length > 0) {
      const m = result.meanings[0];
      if (m.partOfSpeech) document.getElementById('pos-input').value = m.partOfSpeech;
      if (m.definition && !document.getElementById('explanation-input').value) {
        document.getElementById('explanation-input').value = m.definition;
      }
      if (m.example && !document.getElementById('example-input').value) {
        document.getElementById('example-input').value = m.example;
      }
    }
    if (result.synonyms.length > 0 && !document.getElementById('synonyms-input').value) {
      document.getElementById('synonyms-input').value = result.synonyms.join(', ');
    }
    if (result.antonyms.length > 0 && !document.getElementById('antonyms-input').value) {
      document.getElementById('antonyms-input').value = result.antonyms.join(', ');
    }

    showToast('Dictionary data loaded!');
  });

  // Play audio
  container.querySelector('#play-audio-btn').addEventListener('click', () => {
    const audio = document.getElementById('word-audio');
    if (audio.src) audio.play();
  });

  // Form submit
  const handleSave = (andNew = false) => {
    const word = document.getElementById('word-input').value.trim();
    const meaning = document.getElementById('meaning-input').value.trim();
    if (!word) return showToast('Word is required', 'error');
    if (!meaning) return showToast('Meaning is required', 'error');

    const data = {
      word,
      meaning,
      partOfSpeech: document.getElementById('pos-input').value,
      explanation: document.getElementById('explanation-input').value.trim(),
      example: document.getElementById('example-input').value.trim(),
      exampleMeaning: document.getElementById('example-meaning-input').value.trim(),
      synonyms: document.getElementById('synonyms-input').value.trim(),
      antonyms: document.getElementById('antonyms-input').value.trim(),
      tags: document.getElementById('tags-input').value.trim(),
      deckId: document.getElementById('deck-input').value || null,
      notes: document.getElementById('notes-input').value.trim(),
      phonetic: document.getElementById('phonetic-display').textContent || '',
      audioUrl: currentAudioUrl,
    };

    if (isEdit) {
      data.id = editId;
    }

    saveWord(data);
    showToast(isEdit ? 'Word updated!' : `"${word}" added!`);

    if (andNew) {
      // Reset form
      document.getElementById('word-form').reset();
      document.getElementById('phonetic-section').style.display = 'none';
      document.getElementById('word-input').focus();
      currentAudioUrl = '';
    } else {
      window.history.back();
    }
  };

  container.querySelector('#word-form').addEventListener('submit', (e) => {
    e.preventDefault();
    handleSave(false);
  });

  container.querySelector('#add-another-btn')?.addEventListener('click', () => handleSave(true));

  // Focus first input
  setTimeout(() => document.getElementById('word-input')?.focus(), 100);
}
