import { db } from '../utils/supabase.js';
import { getMasteryLabel, formatNextReview } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { showModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { parsePastedText } from '../utils/csv.js';
import { escapeHtml, truncate } from '../utils/helpers.js';

const IMPORT_PLACEHOLDER = `Từ 1\tĐịnh nghĩa 1\tPhát âm (nếu có)\tLoại từ (nếu có)\tVí dụ (nếu có)\tĐồng nghĩa (nếu có)
Từ 2\tĐịnh nghĩa 2\t...
Từ 3\tĐịnh nghĩa 3\t...`;

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
    container.innerHTML = '<p class="text-muted" style="padding:var(--space-4);text-align:center;font-size:var(--font-size-sm);">Chưa có thẻ nào. Chép và dán dữ liệu phía trên.</p>';
    return;
  }
  container.innerHTML = `
    <div class="import-preview-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-3);max-height:280px;overflow-y:auto;">
      ${parsed.map((card, i) => `
        <div class="card" style="padding:var(--space-3);font-size:var(--font-size-sm);border:1px solid var(--color-border);">
          <div style="font-weight:700;color:var(--color-text-primary);margin-bottom:4px;">${escapeHtml(card.word)}</div>
          <div class="text-muted" style="font-size:0.8rem;line-height:1.3;">${escapeHtml(truncate(card.meaning || '', 60))}</div>
          ${card.phonetic ? `<div style="margin-top:4px;font-size:0.75rem;color:#6b7280;">/${escapeHtml(card.phonetic)}/</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function openImportModal(deckId, onSuccess) {
  const modal = showModal('Nhập', `
    <p class="text-muted" style="margin-bottom:var(--space-4);font-size:var(--font-size-sm);">Chép và dán dữ liệu từ Word, Excel, Google Docs, v.v.</p>
    <textarea id="import-bulk-textarea" class="input" rows="8" placeholder="${escapeHtml(IMPORT_PLACEHOLDER)}" style="width:100%;resize:vertical;min-height:140px;font-family:inherit;"></textarea>

    <div style="margin-top:var(--space-5);">
      <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-2);">Giữa thuật ngữ và định nghĩa</div>
      <div class="flex flex-wrap items-center gap-4" style="margin-bottom:var(--space-4);">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="import-term-delim" value="tab" checked />
          <span>Tab</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="import-term-delim" value="comma" />
          <span>Phẩy</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="import-term-delim" value="custom" />
          <span>Tuỳ chọn</span>
        </label>
        <input type="text" id="import-custom-term-delim" placeholder="ký tự" maxlength="2" style="width:3rem;padding:var(--space-1) var(--space-2);font-size:var(--font-size-sm);border:1px solid var(--color-border);border-radius:var(--border-radius);" />
      </div>

      <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-2);">Giữa các thẻ</div>
      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="import-card-delim" value="newline" checked />
          <span>Dòng mới</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="import-card-delim" value="semicolon" />
          <span>Chấm phẩy</span>
        </label>
      </div>
    </div>

    <div style="margin-top:var(--space-6);padding-top:var(--space-4);border-top:1px solid var(--color-border);">
      <div style="font-weight:600;font-size:var(--font-size-sm);margin-bottom:var(--space-3);">Các thẻ được tạo (<span id="import-preview-count">0</span> thẻ)</div>
      <div id="import-preview-cards" class="import-preview-area" style="background:var(--color-bg-glass);border-radius:var(--border-radius);border:1px dashed var(--color-border);">
        <p class="text-muted" style="padding:var(--space-4);text-align:center;font-size:var(--font-size-sm);">Chưa có thẻ nào. Chép và dán dữ liệu phía trên.</p>
      </div>
    </div>

    <div class="flex gap-3 justify-end" style="margin-top:var(--space-5);">
      <button class="btn btn-secondary" id="import-bulk-cancel">Huỷ nhập</button>
      <button class="btn btn-primary" id="import-bulk-submit">Nhập</button>
    </div>
  `, { width: 640 });

  const body = modal.element?.querySelector('.modal-body');
  if (!body) return;

  const runPreview = () => updateImportPreview();
  body.querySelector('#import-bulk-textarea')?.addEventListener('input', runPreview);
  body.querySelector('#import-bulk-textarea')?.addEventListener('paste', () => setTimeout(runPreview, 10));
  body.querySelectorAll('input[name="import-term-delim"], input[name="import-card-delim"]').forEach(el => el.addEventListener('change', runPreview));
  body.querySelector('#import-custom-term-delim')?.addEventListener('input', runPreview);

  body.querySelector('#import-bulk-submit').onclick = async () => {
    const text = body.querySelector('#import-bulk-textarea').value;
    const { termDelim, cardDelim } = getImportDelimiters();
    const parsed = parsePastedText(text, termDelim, cardDelim);
    if (parsed.length === 0) {
      showToast('Chưa có dữ liệu hợp lệ để nhập. Mỗi dòng cần ít nhất: Từ + Định nghĩa.', 'info');
      return;
    }
    for (const w of parsed) {
      await db.words.create({
        word: w.word,
        deck_id: deckId,
        meaning: w.meaning || '',
        pos: w.partOfSpeech || '',
        explanation: w.explanation || '',
        example_sent: w.example || '',
        phonetic: w.phonetic || '',
      });
    }
    modal.close();
    showToast(`Đã nhập ${parsed.length} từ!`, 'success');
    onSuccess();
  };
  body.querySelector('#import-bulk-cancel').onclick = () => modal.close();
}

export async function renderDeckDetail(container, params) {
  const deckId = params.id;
  container.innerHTML = `<div class="flex items-center justify-center" style="min-height:200px;"><div class="spinner"></div></div>`;

  const render = async () => {
    try {
      const deck = await db.decks.get(deckId);
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

      const words = await db.words.getByDeck(deckId);
      const dueWords = words.filter(w => new Date(w.next_review) <= new Date());

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
                <p class="text-muted" style="max-width:600px;">${escapeHtml(deck.description || 'No description')}</p>
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
                <div class="stat-value">${words.filter(w => w.srs_level >= 5).length}</div>
                <div class="stat-label">Mastered</div>
              </div>
            </div>
          </div>

          <h2 style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);margin-bottom:var(--space-5);">Word List</h2>

          ${words.length === 0 ? `
            <div class="empty-state card">
              <div class="empty-state-icon">📝</div>
              <div class="empty-state-title">No words yet</div>
              <button class="btn btn-primary" id="empty-add-word-btn">➕ Add Your First Word</button>
            </div>
          ` : `
            <div class="flex flex-col gap-3 stagger">
              ${words.map(word => {
                const label = getMasteryLabel(word.srs_level || 0);
                return `
                  <div class="card card-interactive animate-fade-in-up word-row flex items-center justify-between gap-4" style="padding:var(--space-4) var(--space-5);" data-word-id="${word.id}">
                    <div style="flex:1;min-width:0;">
                      <div class="flex items-center gap-3" style="margin-bottom:2px;">
                        <strong style="font-size:var(--font-size-md);">${escapeHtml(word.word)}</strong>
                        ${word.pos ? `<span class="badge badge-outline">${escapeHtml(word.pos)}</span>` : ''}
                        <span class="badge ${masteryColors[label] || 'badge-accent'}">${label}</span>
                      </div>
                      <div class="text-sm text-muted">${escapeHtml(truncate(word.meaning || '', 80))}</div>
                    </div>
                    <div class="flex items-center gap-3">
                      <span class="text-sm text-muted">${formatNextReview(word.next_review)}</span>
                      <button class="btn btn-ghost btn-sm edit-word-btn" data-word-id="${word.id}">✏️</button>
                      <button class="btn btn-ghost btn-sm del-word-btn" data-word-id="${word.id}">🗑️</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `;

      setupEvents(deckId, words);
    } catch (err) {
      container.innerHTML = `<div class="card" style="padding:2rem;text-align:center;"><h3 style="color:#ef4444;">Error</h3><p>${err.message}</p></div>`;
    }
  };

  const setupEvents = (deckId, words) => {
    container.querySelector('#back-btn').addEventListener('click', () => navigateTo('/decks'));
    container.querySelector('#study-deck-btn')?.addEventListener('click', () => navigateTo(`/study/${deckId}`));
    container.querySelector('#add-word-to-deck-btn')?.addEventListener('click', () => navigateTo(`/add-word?deck=${deckId}`));
    container.querySelector('#empty-add-word-btn')?.addEventListener('click', () => navigateTo(`/add-word?deck=${deckId}`));

    container.querySelectorAll('.edit-word-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateTo(`/add-word?edit=${btn.dataset.wordId}`);
      });
    });

    container.querySelectorAll('.del-word-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Delete this word permanently?')) {
          await db.words.delete(btn.dataset.wordId);
          showToast('Word deleted');
          render();
        }
      });
    });

    container.querySelector('#import-bulk-btn')?.addEventListener('click', () => {
      openImportModal(deckId, render);
    });
  };

  render();
}
