import { db } from '../utils/supabase.js';
import { getMasteryLabel, formatNextReview } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { debounce, escapeHtml, truncate } from '../utils/helpers.js';

export async function renderSearch(container) {
  let activeFilter = 'all';    // all | due | difficult | new
  let searchQuery = '';
  let filterDeck = '';
  let filterPos = '';

  container.innerHTML = `<div class="flex items-center justify-center p-12"><div class="spinner"></div></div>`;

  const render = async () => {
    try {
      const allWords = await db.words.list();
      const decks = await db.decks.list();
      
      let words = [...allWords];

      // Apply smart filter
      if (activeFilter === 'due') {
        words = words.filter(w => new Date(w.next_review) <= new Date());
      } else if (activeFilter === 'difficult') {
        words = words.filter(w => (w.again_count || 0) >= 3 || (w.ease_factor || 2.5) < 1.8);
      } else if (activeFilter === 'new') {
        words = words.filter(w => (w.review_count || 0) === 0);
      }

      if (filterDeck) words = words.filter(w => w.deck_id === filterDeck);
      if (filterPos) words = words.filter(w => w.pos === filterPos);

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        words = words.filter(w =>
          w.word.toLowerCase().includes(q) ||
          (w.meaning && w.meaning.toLowerCase().includes(q)) ||
          (w.explanation && w.explanation.toLowerCase().includes(q))
        );
      }

      const masteryColors = {
        New: 'badge-yellow',
        Learning: 'badge-accent',
        Intermediate: 'badge-accent',
        Mastered: 'badge-green',
      };

      const getDeckName = (id) => decks.find(d => d.id === id)?.name || '';

      container.innerHTML = `
        <div class="animate-fade-in-up">
          <div class="page-header">
            <h1>🔍 Search & Review</h1>
            <p>Find, filter, and review your vocabulary in the cloud</p>
          </div>

          <div class="search-bar" style="margin-bottom:var(--space-6);">
            <span class="search-icon">🔍</span>
            <input class="input" id="search-input" placeholder="Search words, meanings, definitions..." value="${escapeHtml(searchQuery)}" autofocus>
          </div>

          <div class="flex flex-wrap gap-3" style="margin-bottom:var(--space-6);">
            <div class="flex gap-2">
              ${[
                { id: 'all', label: '📋 All', count: allWords.length },
                { id: 'due', label: '⏰ Due', count: allWords.filter(w => new Date(w.next_review) <= new Date()).length },
                { id: 'difficult', label: '⚠️ Hard', count: allWords.filter(w => (w.again_count || 0) >= 3 || (w.ease_factor || 2.5) < 1.8).length },
                { id: 'new', label: '🆕 New', count: allWords.filter(w => (w.review_count || 0) === 0).length },
              ].map(f => `
                <button class="btn ${activeFilter === f.id ? 'btn-primary' : 'btn-secondary'} btn-sm filter-btn" data-filter="${f.id}">
                  ${f.label} (${f.count})
                </button>
              `).join('')}
            </div>

            <select class="input" id="deck-filter" style="width:auto; min-width:140px;">
              <option value="">All Decks</option>
              ${decks.map(d => `<option value="${d.id}" ${filterDeck === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
            </select>

            <select class="input" id="pos-filter" style="width:auto;">
              <option value="">All POS</option>
              ${['noun', 'verb', 'adjective', 'adverb', 'phrase'].map(pos => `
                <option value="${pos}" ${filterPos === pos ? 'selected' : ''}>${pos}</option>
              `).join('')}
            </select>
          </div>

          <div class="text-sm text-muted" style="margin-bottom:var(--space-4);">${words.length} items found</div>

          ${words.length === 0 ? `
            <div class="empty-state card">
              <div class="empty-state-icon">🔍</div>
              <div class="empty-state-title">No matching words</div>
              <p class="text-muted">Try adjusting your filters or search query.</p>
            </div>
          ` : `
            <div class="flex flex-col gap-3 stagger">
              ${words.slice(0, 100).map(word => {
                const label = getMasteryLabel(word.srs_level || 0);
                return `
                  <div class="card card-interactive word-result" style="padding:var(--space-4) var(--space-5);" data-word-id="${word.id}">
                    <div class="flex items-center justify-between gap-4 flex-wrap">
                      <div style="min-width:0;flex:1;">
                        <div class="flex items-center gap-3 flex-wrap" style="margin-bottom:var(--space-1);">
                          <strong style="font-size:var(--font-size-md);">${escapeHtml(word.word)}</strong>
                          ${word.pos ? `<span class="badge badge-outline">${escapeHtml(word.pos)}</span>` : ''}
                          <span class="badge ${masteryColors[label] || 'badge-accent'}">${label}</span>
                        </div>
                        <div class="text-sm" style="margin-bottom:var(--space-1);">${escapeHtml(word.meaning || '')}</div>
                        ${word.example_sent ? `<div class="text-sm text-muted italic">"${escapeHtml(truncate(word.example_sent, 100))}"</div>` : ''}
                        <div class="flex items-center gap-2 mt-2">
                          ${getDeckName(word.deck_id) ? `<span class="tag">📚 ${escapeHtml(getDeckName(word.deck_id))}</span>` : ''}
                        </div>
                      </div>
                      <div class="flex flex-col items-end gap-2" style="flex-shrink:0;">
                        <span class="text-xs text-muted">Review: ${formatNextReview(word.next_review)}</span>
                        <button class="btn btn-ghost btn-sm edit-btn" data-word-id="${word.id}">✏️ Edit</button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
              ${words.length > 100 ? `<p class="text-sm text-muted text-center pt-4">Showing first 100 of ${words.length} items</p>` : ''}
            </div>
          `}
        </div>
      `;

      setupEvents();
    } catch (err) {
      container.innerHTML = `<div class="card p-8 text-center text-red-600">Error: ${err.message}</div>`;
    }
  };

  const setupEvents = () => {
    const searchInput = document.getElementById('search-input');
    const handleSearch = debounce((val) => {
      searchQuery = val;
      render();
    }, 300);
    
    searchInput?.addEventListener('input', (e) => handleSearch(e.target.value));

    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.dataset.filter;
        render();
      });
    });

    document.getElementById('deck-filter')?.addEventListener('change', (e) => {
      filterDeck = e.target.value;
      render();
    });

    document.getElementById('pos-filter')?.addEventListener('change', (e) => {
      filterPos = e.target.value;
      render();
    });

    container.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateTo(`/add-word?edit=${btn.dataset.wordId}`);
      });
    });

    if (searchQuery) {
      const input = document.getElementById('search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  };

  await render();
}
