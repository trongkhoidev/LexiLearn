/* ============================================
   LexiLearn — Deck Detail Page
   ============================================ */

import { getDeckById, getWords, deleteWord } from '../data/store.js';
import { getDueWords, getMasteryLabel, formatNextReview } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { showModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { parsePastedText } from '../utils/csv.js';
import { importWords } from '../data/store.js';
import { escapeHtml, truncate } from '../utils/helpers.js';

export function renderDeckDetail(container, params) {
  const deckId = params.id;
  const render = () => {
    const deck = getDeckById(deckId);
    if (!deck) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❓</div>
          <div class="empty-state-title">Deck not found</div>
          <button class="btn btn-primary" id="back-to-decks">← Back to Decks</button>
        </div>
      `;
      container.querySelector('#back-to-decks')?.addEventListener('click', () => navigateTo('/decks'));
      return;
    }

    const words = getWords().filter(w => w.deckId === deckId);
    const dueWords = getDueWords(deckId);

    const masteryColors = {
      New: 'badge-yellow',
      Learning: 'badge-accent',
      Intermediate: 'badge-accent',
      Mastered: 'badge-green',
    };

    container.innerHTML = `
      <div class="animate-fade-in-up">
        <button class="btn btn-ghost" id="back-btn" style="margin-bottom:var(--space-4);">← Back to Decks</button>

        <div class="card card-gradient" style="margin-bottom:var(--space-8);padding:var(--space-8);">
          <div class="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-bold);margin-bottom:var(--space-2);">
                ${escapeHtml(deck.name)}
              </h1>
              <p class="text-muted">${escapeHtml(deck.description || 'No description')}</p>
            </div>
            <div class="flex gap-3 flex-wrap">
              ${dueWords.length > 0 ? `<button class="btn btn-primary" id="study-deck-btn">📖 Study (${dueWords.length})</button>` : ''}
              <button class="btn btn-secondary" id="add-word-to-deck-btn">➕ Add Word</button>
              <button class="btn btn-secondary" id="import-bulk-btn">📥 Import from Text</button>
            </div>
          </div>
          <div class="grid grid-3" style="margin-top:var(--space-6);">
            <div class="stat-card">
              <div class="stat-value">${words.length}</div>
              <div class="stat-label">Total Words</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${dueWords.length}</div>
              <div class="stat-label">Due for Review</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${words.filter(w => w.srsLevel >= 5).length}</div>
              <div class="stat-label">Mastered</div>
            </div>
          </div>
        </div>

        <!-- Word List -->
        <h2 style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);margin-bottom:var(--space-5);">
          Word List
        </h2>

        ${words.length === 0 ? `
          <div class="empty-state card">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">No words yet</div>
            <div class="empty-state-text">Add vocabulary to this deck to start learning.</div>
            <button class="btn btn-primary" id="empty-add-word-btn">➕ Add Your First Word</button>
          </div>
        ` : `
          <div class="flex flex-col gap-3 stagger">
            ${words.map((word, i) => `
              <div class="card card-interactive animate-fade-in-up word-row flex items-center justify-between gap-4" style="padding:var(--space-4) var(--space-5);cursor:pointer;" data-word-id="${word.id}">
                <div class="flex items-center gap-4" style="flex:1;min-width:0;">
                  <div style="min-width:0;flex:1;">
                    <div class="flex items-center gap-3" style="margin-bottom:var(--space-1);">
                      <strong style="font-size:var(--font-size-md);">${escapeHtml(word.word)}</strong>
                      ${word.partOfSpeech ? `<span class="badge badge-outline">${escapeHtml(word.partOfSpeech)}</span>` : ''}
                      <span class="badge ${masteryColors[getMasteryLabel(word)]}">${getMasteryLabel(word)}</span>
                    </div>
                    <div class="text-sm text-muted">${escapeHtml(truncate(word.meaning, 80))}</div>
                  </div>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-sm text-muted">${formatNextReview(word.nextReview)}</span>
                  <button class="btn btn-ghost btn-sm edit-word-btn" data-word-id="${word.id}">✏️</button>
                  <button class="btn btn-ghost btn-sm del-word-btn" data-word-id="${word.id}">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    // Events
    container.querySelector('#back-btn').addEventListener('click', () => navigateTo('/decks'));
    container.querySelector('#study-deck-btn')?.addEventListener('click', () => navigateTo(`/study/${deckId}`));
    container.querySelector('#add-word-to-deck-btn')?.addEventListener('click', () => navigateTo(`/add-word?deck=${deckId}`));
    container.querySelector('#empty-add-word-btn')?.addEventListener('click', () => navigateTo(`/add-word?deck=${deckId}`));

    // Deep Custom Bulk Import (Quizlet style)
    container.querySelector('#import-bulk-btn')?.addEventListener('click', () => {
      const modal = showModal('Nhập (Import)', `
        <div class="flex flex-col gap-4">
          <p class="text-sm text-muted">Chép và dán dữ liệu từ Word, Excel, Google Docs, v.v.</p>
          
          <textarea id="bulk-import-textarea" class="textarea w-full" rows="10" placeholder="Từ 1 \\t Định nghĩa 1 \\t Phát âm (nếu có) \\t Loại từ (nếu có) \\t Ví dụ (nếu có) \\t Từ đồng nghĩa (nếu có)\\nTừ 2 \\t Định nghĩa 2..."></textarea>
          
          <div class="grid grid-2 gap-4 mt-2">
            <div>
              <strong class="text-sm">Giữa thuật ngữ và định nghĩa</strong>
              <div class="flex flex-col gap-2 mt-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="term-delim" value="\\t" checked> Tab
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="term-delim" value=","> Phẩy
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="term-delim" value="custom"> Tùy chọn
                  <input type="text" id="custom-term-delim" class="input input-sm ml-2" style="width: 60px; display: none;" value="-">
                </label>
              </div>
            </div>
            <div>
              <strong class="text-sm">Giữa các thẻ</strong>
              <div class="flex flex-col gap-2 mt-2">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="card-delim" value="\\n" checked> Dòng mới
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="card-delim" value=";"> Chấm phẩy
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="card-delim" value="custom"> Tùy chọn
                  <input type="text" id="custom-card-delim" class="input input-sm ml-2" style="width: 60px; display: none;" value="\\\\n\\\\n">
                </label>
              </div>
            </div>
          </div>

          <div id="bulk-preview-container" class="mt-4" style="display:none;">
            <p class="text-sm text-primary font-bold mb-2">Xem trước (<span id="bulk-count">0</span> thẻ)</p>
            <div id="bulk-preview-list" class="flex flex-col gap-2" style="max-height: 200px; overflow-y: auto;"></div>
          </div>

          <div class="flex gap-3 justify-end mt-4">
            <button class="btn btn-outline" id="bulk-cancel-btn">Huỷ nhập</button>
            <button class="btn btn-primary" id="bulk-submit-btn" disabled>Nhập</button>
          </div>
        </div>
      `, { width: 700 });

      let parsedWords = [];
      const textarea = document.getElementById('bulk-import-textarea');
      const submitBtn = document.getElementById('bulk-submit-btn');
      const cancelBtn = document.getElementById('bulk-cancel-btn');
      const previewContainer = document.getElementById('bulk-preview-container');
      const previewList = document.getElementById('bulk-preview-list');
      const countLabel = document.getElementById('bulk-count');
      const termRadios = document.querySelectorAll('input[name="term-delim"]');
      const cardRadios = document.querySelectorAll('input[name="card-delim"]');
      const customTermInput = document.getElementById('custom-term-delim');
      const customCardInput = document.getElementById('custom-card-delim');

      // Toggle custom inputs
      termRadios.forEach(r => r.addEventListener('change', () => {
        customTermInput.style.display = r.value === 'custom' ? 'inline-block' : 'none';
        parseAndPreview();
      }));
      cardRadios.forEach(r => r.addEventListener('change', () => {
        customCardInput.style.display = r.value === 'custom' ? 'inline-block' : 'none';
        parseAndPreview();
      }));

      const getDelim = (type) => {
        const selected = document.querySelector(`input[name="${type}-delim"]:checked`).value;
        const val = selected === 'custom' 
          ? document.getElementById(`custom-${type}-delim`).value 
          : selected;
          
        if (val === '\\n') return '\n';
        if (val === '\\t') return '\t';
        
        return val.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      };

      const parseAndPreview = () => {
        const text = textarea.value;
        const termDelim = getDelim('term');
        const cardDelim = getDelim('card');
        
        parsedWords = parsePastedText(text, termDelim, cardDelim).map(w => ({ ...w, deckId }));
        
        if (parsedWords.length > 0) {
          previewContainer.style.display = 'block';
          countLabel.textContent = parsedWords.length;
          submitBtn.disabled = false;
          
          // Render preview items
          previewList.innerHTML = '';
          parsedWords.slice(0, 50).forEach((w, i) => {
            const el = document.createElement('div');
            el.className = 'flex gap-4 p-2 border-b text-sm';
            el.innerHTML = `<div style="flex:1" class="font-bold">${escapeHtml(w.word)}</div><div style="flex:2">${escapeHtml(w.meaning)}</div>`;
            previewList.appendChild(el);
          });
          if (parsedWords.length > 50) {
            const el = document.createElement('div');
            el.className = 'text-center text-xs text-muted mt-2';
            el.textContent = `+ ${parsedWords.length - 50} more...`;
            previewList.appendChild(el);
          }
        } else {
          previewContainer.style.display = 'none';
          submitBtn.disabled = true;
        }
      };

      textarea.addEventListener('input', parseAndPreview);
      customTermInput.addEventListener('input', parseAndPreview);
      customCardInput.addEventListener('input', parseAndPreview);

      submitBtn.addEventListener('click', () => {
        if (parsedWords.length === 0) return;
        importWords(parsedWords);
        modal.close();
        showToast(`Imported ${parsedWords.length} words!`, 'success');
        render(); // re-render the word list
      });

      cancelBtn.addEventListener('click', () => {
        modal.close();
      });
    });

    // Edit word → navigate to add-word page with edit param
    container.querySelectorAll('.edit-word-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateTo(`/add-word?edit=${btn.dataset.wordId}`);
      });
    });

    // Delete word
    container.querySelectorAll('.del-word-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const wordId = btn.dataset.wordId;
        const word = getWords().find(w => w.id === wordId);
        if (!word) return;
        const modal = showModal('Delete Word', `
          <p style="margin-bottom:var(--space-6);">Delete <strong>"${escapeHtml(word.word)}"</strong> permanently?</p>
          <div class="flex gap-3">
            <button class="btn btn-danger" id="confirm-del-word" style="flex:1;">Delete</button>
            <button class="btn btn-secondary" id="cancel-del-word" style="flex:1;">Cancel</button>
          </div>
        `);
        document.getElementById('confirm-del-word').addEventListener('click', () => {
          deleteWord(wordId);
          modal.close();
          showToast('Word deleted');
          render();
        });
        document.getElementById('cancel-del-word').addEventListener('click', () => modal.close());
      });
    });
  };

  render();
}
