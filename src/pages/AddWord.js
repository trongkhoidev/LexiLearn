import { db } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/Toast.js';
import { lookupWord, buildTooltipHTML } from '../utils/wordLookup.js';
import { escapeHtml } from '../utils/helpers.js';

export async function renderAddWord(container) {
  let selectedDeckId = null;
  let wordInfo = null;

  container.innerHTML = `<div class="p-20 flex justify-center"><div class="spinner"></div></div>`;

  try {
    const decks = await db.decks.list();

    container.innerHTML = `
      <div class="animate-fade-in-up max-w-2xl mx-auto">
        <div class="page-header mb-8">
          <h1 class="text-3xl font-bold">➕ Add New Word</h1>
          <p class="text-muted">Manually add a word or use AI lookup for rich information.</p>
        </div>

        <div class="card p-8">
          <div class="mb-6">
            <label class="form-label">English Word</label>
            <div class="flex gap-2">
              <input type="text" id="word-input" class="input flex-1" placeholder="e.g. Sustainable">
              <button class="btn btn-secondary" id="lookup-btn">🔍 AI Lookup</button>
            </div>
          </div>

          <div class="mb-6">
            <label class="form-label">Select Deck</label>
            <select id="deck-select" class="input">
              <option value="">-- No Deck --</option>
              ${decks.map(d => `<option value="${d.id}">${escapeHtml(d.name)}</option>`).join('')}
            </select>
          </div>

          <div id="word-details" class="hidden animate-fade-in">
            <div class="grid grid-2 gap-4 mb-6">
              <div>
                <label class="form-label">Meaning (VI)</label>
                <input type="text" id="meaning-input" class="input" placeholder="Vietnamese meaning">
              </div>
              <div>
                <label class="form-label">Part of Speech</label>
                <input type="text" id="pos-input" class="input" placeholder="e.g. adjective">
              </div>
            </div>
            
            <div class="mb-6">
              <label class="form-label">Explanation (EN)</label>
              <textarea id="explanation-input" class="input" rows="3"></textarea>
            </div>

            <div class="mb-8">
              <label class="form-label">Example Sentence</label>
              <textarea id="example-input" class="input" rows="2"></textarea>
            </div>

            <button class="btn btn-primary w-full py-4 text-lg" id="save-word-btn">Save Word to Database</button>
          </div>
        </div>
      </div>
    `;

    const wordDetails = document.getElementById('word-details');
    const lookupBtn = document.getElementById('lookup-btn');

    lookupBtn.addEventListener('click', async () => {
      const word = document.getElementById('word-input').value.trim();
      if (!word) return showToast('Enter a word first!', 'info');

      lookupBtn.disabled = true;
      lookupBtn.innerHTML = '<div class="spinner-sm"></div> Searching...';

      try {
        wordInfo = await lookupWord(word);
        if (wordInfo) {
          document.getElementById('meaning-input').value = wordInfo.meaning_vi || '';
          document.getElementById('pos-input').value = wordInfo.partOfSpeech || '';
          document.getElementById('explanation-input').value = wordInfo.meaning_en || '';
          document.getElementById('example-input').value = wordInfo.example || '';
          wordDetails.classList.remove('hidden');
          showToast(`Information found for "${word}"`, 'success');
        } else {
          showToast('Could not find information. Please fill manually.', 'info');
          wordDetails.classList.remove('hidden');
        }
      } catch (err) {
        showToast(err.message, 'error');
        wordDetails.classList.remove('hidden');
      } finally {
        lookupBtn.disabled = false;
        lookupBtn.innerHTML = '🔍 AI Lookup';
      }
    });

    document.getElementById('save-word-btn').addEventListener('click', async () => {
      const word = document.getElementById('word-input').value.trim();
      const deck_id = document.getElementById('deck-select').value;
      const meaning = document.getElementById('meaning-input').value.trim();
      const pos = document.getElementById('pos-input').value.trim();
      const explanation = document.getElementById('explanation-input').value.trim();
      const example_sent = document.getElementById('example-input').value.trim();

      if (!word || !meaning) return showToast('Word and meaning are required!', 'error');

      const btn = document.getElementById('save-word-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';

      try {
        await db.words.create({
          word,
          deck_id: deck_id || null,
          meaning,
          pos,
          explanation,
          example_sent,
          phonetic: wordInfo?.phonetic || ''
        });
        showToast(`"${word}" saved successfully!`, 'success');
        navigateTo('/decks');
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Save Word to Database';
      }
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-red-500">Error: ${err.message}</div>`;
  }
}
