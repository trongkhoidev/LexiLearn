import { db } from '../utils/supabase.js';
import { getMasteryLabel, formatNextReview } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { showModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { parsePastedText } from '../utils/csv.js';
import { renderSkeleton, renderEmptyState, escapeHtml, truncate } from '../utils/helpers.js';

const IMPORT_PLACEHOLDER = `Term 1\tDefinition 1\tPhonetic (optional)\tPOS (optional)\tExample (optional)\tSynonyms (optional)
Term 2\tDefinition 2\t...`;

function speakWord(word) {
  if (!word || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word.trim());
  u.lang = 'en-US';
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

function getImportDelimiters() {
  const termRadio = document.querySelector('input[name="import-term-delim"]:checked');
  const cardRadio = document.querySelector('input[name="import-card-delim"]:checked');
  const customInput = document.getElementById('import-custom-term-delim');
  let termDelim = '\t';
  if (termRadio?.value === 'comma') termDelim = ',';
  else if (termRadio?.value === 'custom' && customInput?.value?.trim()) termDelim = customInput.value.trim()[0] || '\t';
  const cardDelim = cardRadio?.value === 'semicolon' ? ';' : '\n';
  return { termDelim, cardDelim };
}

function updateImportPreview() {
  const textarea = document.getElementById('import-bulk-textarea');
  const container = document.getElementById('import-preview-cards');
  if (!textarea || !container) return;
  const { termDelim, cardDelim } = getImportDelimiters();
  const parsed = parsePastedText(textarea.value, termDelim, cardDelim);
  const countEl = document.getElementById('import-preview-count');
  if (countEl) countEl.textContent = parsed.length;

  if (parsed.length === 0) {
    container.innerHTML = '<p class="text-muted" style="padding:var(--space-4);text-align:center;font-size:var(--font-size-sm);">No valid cards detected yet. Paste your data above.</p>';
    return;
  }
  container.innerHTML = `
    <div class="import-preview-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:var(--space-3);max-height:280px;overflow-y:auto;padding:var(--space-2);">
      ${parsed.map((card, i) => `
        <div class="card p-3 shadow-none border border-gray-100 bg-white">
          <div class="font-bold text-sm text-gray-900 mb-1">${escapeHtml(card.word)}</div>
          <div class="text-[10px] text-muted line-clamp-2">${escapeHtml(truncate(card.meaning || '', 60))}</div>
          ${card.phonetic ? `<div class="mt-2 text-[9px] text-blue-500 font-mono">/${escapeHtml(card.phonetic)}/</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function openImportModal(deckId, onSuccess) {
  const modal = showModal('Bulk Import Cards', `
    <form id="import-bulk-form" class="space-y-6">
      <div class="input-group">
        <label>Paste Data (Excel Tab-separated or CSV)</label>
        <textarea id="import-bulk-textarea" class="textarea italic" rows="6" placeholder="${escapeHtml(IMPORT_PLACEHOLDER)}"></textarea>
      </div>

      <div class="grid grid-2 gap-6 p-4 bg-gray-50 rounded-xl">
        <div>
          <label class="text-xxs font-black uppercase tracking-widest text-muted block mb-3">Term Separator</label>
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-3 text-xs cursor-pointer"><input type="radio" name="import-term-delim" value="tab" checked> Tab (Excel)</label>
            <label class="flex items-center gap-3 text-xs cursor-pointer"><input type="radio" name="import-term-delim" value="comma"> Comma (CSV)</label>
            <label class="flex items-center gap-3 text-xs cursor-pointer"><input type="radio" name="import-term-delim" value="custom"> Custom: <input type="text" id="import-custom-term-delim" class="input py-0.5 px-1 w-8 text-center" maxlength="1"></label>
          </div>
        </div>
        <div>
          <label class="text-xxs font-black uppercase tracking-widest text-muted block mb-3">Card Separator</label>
          <div class="flex flex-col gap-2">
            <label class="flex items-center gap-3 text-xs cursor-pointer"><input type="radio" name="import-card-delim" value="newline" checked> New Line</label>
            <label class="flex items-center gap-3 text-xs cursor-pointer"><input type="radio" name="import-card-delim" value="semicolon"> Semicolon (;)</label>
          </div>
        </div>
      </div>

      <div>
        <div class="flex-between mb-3">
          <label class="text-xxs font-black uppercase tracking-widest text-muted">Import Preview (<span id="import-preview-count">0</span> cards)</label>
        </div>
        <div id="import-preview-cards" class="border border-dashed border-gray-200 rounded-xl bg-white min-h-[80px] flex-center">
          <p class="text-xxs text-muted uppercase font-bold">Preview Area</p>
        </div>
      </div>

      <div class="flex gap-3 justify-end pt-4 border-t">
        <button type="button" class="btn btn-ghost" id="import-bulk-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary px-10" id="import-bulk-submit">Import Now</button>
      </div>
    </form>
  `, { width: 680 });

  const body = modal.element?.querySelector('.modal-body');
  if (!body) return;

  const runPreview = () => updateImportPreview();
  body.querySelector('#import-bulk-textarea')?.addEventListener('input', runPreview);
  body.querySelector('#import-bulk-textarea')?.addEventListener('paste', () => setTimeout(runPreview, 10));
  body.querySelectorAll('input[name="import-term-delim"], input[name="import-card-delim"]').forEach(el => el.addEventListener('change', runPreview));
  body.querySelector('#import-custom-term-delim')?.addEventListener('input', runPreview);

  body.querySelector('#import-bulk-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = body.querySelector('#import-bulk-submit');
    const text = body.querySelector('#import-bulk-textarea').value;
    const { termDelim, cardDelim } = getImportDelimiters();
    const parsed = parsePastedText(text, termDelim, cardDelim);
    
    if (parsed.length === 0) {
      showToast('No valid cards found. Ensure columns are separated correctly.', 'info');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner-xs"></div> Importing...';

    try {
      await Promise.all(parsed.map(w => 
        db.words.create({
          word: w.word,
          deck_id: deckId,
          meaning: w.meaning || '',
          pos: w.partOfSpeech || '',
          explanation: w.explanation || '',
          example_sent: w.example || '',
          phonetic: w.phonetic || '',
        })
      ));
      
      modal.close();
      showToast(`Successfully imported ${parsed.length} words!`, 'success');
      onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Import Now';
    }
  });
  body.querySelector('#import-bulk-cancel').onclick = () => modal.close();
}

export async function renderDeckDetail(container, params) {
  const deckSlug = params.slug;
  
  // Initial skeleton
  container.innerHTML = `
    <div class="animate-fade-in" style="max-width:1100px;margin:0 auto;">
      <div class="skeleton mb-10" style="height: 250px; border-radius: 24px;"></div>
      <div class="flex-between mb-8">
         <div class="skeleton" style="width: 150px; height: 32px;"></div>
      </div>
      <div class="space-y-4">
        ${renderSkeleton('card', 5)}
      </div>
    </div>
  `;

  const render = async () => {
    try {
      const deck = await db.decks.getBySlug(deckSlug);
      if (!deck) {
        container.innerHTML = renderEmptyState({
          icon: '❓',
          title: 'Deck not found',
          message: 'This collection might have been deleted or moved.',
          actionHtml: `<button class="btn btn-primary" onclick="navigateTo('/decks')">← Back to Decks</button>`
        });
        return;
      }

      const words = await db.words.getByDeck(deck.id);
      const dueWords = words.filter(w => !w.next_review || new Date(w.next_review) <= new Date());

      const masteryColors = {
        New: 'badge-yellow',
        Learning: 'badge-purple',
        Intermediate: 'badge-blue',
        Mastered: 'badge-green',
      };

      container.innerHTML = `
        <div class="animate-fade-in-up" style="max-width:1100px;margin:0 auto;">
          <div class="flex-between mb-6">
            <button class="btn btn-ghost btn-sm text-muted font-bold" id="back-btn">← Back to All Decks</button>
            <div class="badge badge-outline text-xxs uppercase font-black tracking-widest">Deck Info</div>
          </div>

          <div class="hero-card shadow-xl p-10 mb-10 text-white relative overflow-hidden" style="background: var(--gradient-primary); border: none;">
            <div class="relative z-10">
              <div class="flex-between flex-wrap gap-8 items-start mb-10">
                <div class="flex-1">
                  <h1 class="text-4xl font-extra-bold mb-3">${escapeHtml(deck.name)}</h1>
                  <p class="text-blue-50 leading-relaxed max-w-xl opacity-80">${escapeHtml(deck.description || 'Build your vocabulary foundation with this curated collection.')}</p>
                </div>
                <div class="flex gap-3 flex-wrap">
                  ${dueWords.length > 0 ? `<button class="btn bg-white text-blue-600 hover:bg-blue-50 font-black px-8 py-3 shadow-lg" id="study-deck-btn">Start Review (${dueWords.length})</button>` : ''}
                  <button class="btn bg-blue-500/30 text-white border-white/20 hover:bg-blue-400/40 font-bold" id="add-word-btn">+ Add Word</button>
                  <button class="btn bg-blue-500/30 text-white border-white/20 hover:bg-blue-400/40 font-bold" id="import-bulk-btn">📥 Import</button>
                </div>
              </div>
              
              <div class="grid grid-4 gap-6">
                <div class="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                   <div class="text-3xl font-black mb-1">${words.length}</div>
                   <div class="text-[10px] font-black uppercase tracking-widest text-blue-200">Total Cards</div>
                </div>
                <div class="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                   <div class="text-3xl font-black mb-1">${dueWords.length}</div>
                   <div class="text-[10px] font-black uppercase tracking-widest text-blue-200">Wait for Review</div>
                </div>
                <div class="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                   <div class="text-3xl font-black mb-1">${words.filter(w => w.srs_level >= 5).length}</div>
                   <div class="text-[10px] font-black uppercase tracking-widest text-blue-200">Mastered</div>
                </div>
                <div class="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                   <div class="text-3xl font-black mb-1">${deck.items?.length || 0}</div>
                   <div class="text-[10px] font-black uppercase tracking-widest text-blue-200">Desk Links</div>
                </div>
              </div>
            </div>
            <div class="absolute -bottom-40 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          </div>

          <div class="flex-between mb-8">
            <h2 class="text-xl font-black text-gray-800 uppercase tracking-tight">Word Collection</h2>
            <div class="flex gap-2">
               <input type="text" class="input input-sm py-2 px-6" placeholder="Filter words..." id="word-search">
            </div>
          </div>

          ${words.length === 0 ? renderEmptyState({
            icon: '📝',
            title: 'Your deck is empty',
            message: 'Add words manually or import them in bulk to start your SRS journey.',
            actionHtml: `<button class="btn btn-primary" id="empty-add-btn">+ Add First Word</button>`
          }) : `
            <div class="space-y-4">
              ${words.map(word => {
                const label = getMasteryLabel(word.srs_level || 0);
                return `
                  <div class="card card-interactive hover-lift group word-row flex items-center justify-between gap-6 px-8 py-5" data-word-id="${word.id}">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-4 mb-2">
                        <strong class="text-lg font-black text-gray-900">${escapeHtml(word.word)}</strong>
                        ${word.pos ? `<span class="badge badge-outline text-[10px] font-black uppercase tracking-tight">${escapeHtml(word.pos)}</span>` : ''}
                        ${word.phonetic ? `<span class="text-xs text-blue-500 font-mono italic">/${escapeHtml(word.phonetic)}/</span>` : ''}
                        <span class="badge ${masteryColors[label] || 'badge-accent'} text-[9px] font-black uppercase tracking-widest ml-auto sm:ml-0">${label}</span>
                      </div>
                      <div class="text-sm font-medium text-gray-600 line-clamp-1 mb-1">${escapeHtml(word.meaning || '')}</div>
                      ${word.example_sent ? `<div class="text-xs text-muted font-medium italic opacity-70 line-clamp-1">${escapeHtml(word.example_sent)}</div>` : ''}
                    </div>
                    
                    <div class="flex items-center gap-2">
                      <div class="text-right mr-4 hidden md:block">
                        <div class="text-[10px] font-black text-muted uppercase tracking-widest mb-1">Next Review</div>
                        <div class="text-xs font-bold text-gray-800">${formatNextReview(word.next_review)}</div>
                      </div>
                      <button class="btn btn-ghost btn-sm speak-word-btn w-10 h-10 flex-center text-xl hover:bg-blue-50 hover:text-blue-600 transition-colors" data-word="${escapeHtml(word.word)}" title="Hear pronunciation">🔊</button>
                      <button class="btn btn-ghost btn-sm edit-word-btn w-10 h-10 flex-center text-xl hover:bg-pink-50 hover:text-pink-600 transition-colors" data-word-id="${word.id}">✏️</button>
                      <button class="btn btn-ghost btn-sm del-word-btn w-10 h-10 flex-center text-xl hover:bg-red-50 hover:text-red-500 transition-colors" data-word-id="${word.id}">🗑️</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `;

      setupEvents(deck.id, words);
    } catch (err) {
      container.innerHTML = `<div class="p-12 text-center text-red-500 card m-8 shadow-xl">
        <h2 class="font-bold mb-2">Failed to load deck data</h2>
        <p class="text-sm opacity-70 mb-6">${err.message}</p>
        <button class="btn btn-primary btn-sm" onclick="window.location.reload()">Retry Now</button>
      </div>`;
    }
  };

  const setupEvents = (deckId, words) => {
    container.querySelector('#back-btn').addEventListener('click', () => navigateTo('/decks'));
    container.querySelector('#study-deck-btn')?.addEventListener('click', () => navigateTo(`/study/${deckSlug}`));

    const openWordModal = (word = null) => {
      const isEdit = !!word;
      const content = `
        <form id="word-form" class="space-y-4">
          <div class="grid grid-2 gap-4">
             <div class="input-group">
                <label>Target Language (En) *</label>
                <input type="text" name="word" class="input" value="${escapeHtml(word?.word || '')}" placeholder="sustainable" required>
             </div>
             <div class="input-group">
                <label>Meaning (Vi) *</label>
                <input type="text" name="meaning" class="input" value="${escapeHtml(word?.meaning || '')}" placeholder="bền vững" required>
             </div>
          </div>
          <div class="grid grid-2 gap-4">
             <div class="input-group">
                <label>Phonetic</label>
                <input type="text" name="phonetic" class="input" value="${escapeHtml(word?.phonetic || '')}" placeholder="/səˈsteɪnəbl/">
             </div>
             <div class="input-group">
                <label>Part of Speech</label>
                <input type="text" name="pos" class="input" value="${escapeHtml(word?.pos || '')}" placeholder="adj.">
             </div>
          </div>
          <div class="input-group">
             <label>Context / Example Sentence</label>
             <textarea name="example" class="textarea" rows="2" placeholder="Economic growth must be sustainable in the long term.">${escapeHtml(word?.example_sent || '')}</textarea>
          </div>
          <div class="input-group">
             <label>Deep Explanation (Internal)</label>
             <textarea name="explanation" class="textarea" rows="2">${escapeHtml(word?.explanation || '')}</textarea>
          </div>
          <div class="mt-8 flex justify-end gap-3">
             <button type="button" class="btn btn-ghost modal-close-btn" id="cancel-word">Cancel</button>
             <button type="submit" class="btn btn-primary px-10">${isEdit ? 'Update Word' : 'Save New Word'}</button>
          </div>
        </form>
      `;

      const modal = showModal(isEdit ? 'Edit Word Properties' : '➕ Add Vocabulary', content, { width: 560 });
      const form = modal.element.querySelector('#word-form');
      
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const submitBtn = form.querySelector('button[type="submit"]');

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner-xs"></div> Saving...';

        try {
          const payload = {
            word: data.get('word').trim(),
            meaning: data.get('meaning').trim(),
            deck_id: deckId,
            phonetic: data.get('phonetic').trim(),
            pos: data.get('pos').trim(),
            example_sent: data.get('example').trim(),
            explanation: data.get('explanation').trim()
          };

          if (isEdit) await db.words.update(word.id, payload);
          else await db.words.create(payload);

          modal.close();
          showToast(isEdit ? 'Word properties updated!' : 'Successfully added to collection!', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Retry Save';
        }
      });

      modal.element.querySelector('#cancel-word').onclick = () => modal.close();
    };

    container.querySelector('#add-word-btn')?.addEventListener('click', () => openWordModal());
    container.querySelector('#empty-add-btn')?.addEventListener('click', () => openWordModal());

    container.querySelectorAll('.speak-word-btn').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); speakWord(btn.dataset.word); });
    });

    container.querySelectorAll('.edit-word-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const word = words.find(w => w.id === btn.dataset.wordId);
        openWordModal(word);
      });
    });

    container.querySelectorAll('.del-word-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this word permanently from your deck?')) {
          try {
            await db.words.delete(btn.dataset.wordId);
            showToast('Word removed from collection');
            render();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });

    container.querySelector('#import-bulk-btn')?.addEventListener('click', () => {
      openImportModal(deckId, render);
    });
  };

  render();
}

