/* ============================================
   LexiLearn — Search & Smart Review Page
   ============================================ */

import { getWords, getDecks } from '../data/store.js';
import { getDueWords, getDifficultWords, getNewWords, getMasteryLabel, formatNextReview } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { debounce, escapeHtml, truncate } from '../utils/helpers.js';

export function renderSearch(container) {
  let filter = 'all';    // all | due | difficult | new
  let searchQuery = '';
  let filterDeck = '';
  let filterPos = '';

  const decks = getDecks();

  const render = () => {
    let words = getWords();

    // Apply smart filter
    switch (filter) {
      case 'due': words = getDueWords(); break;
      case 'difficult': words = getDifficultWords(); break;
      case 'new': words = getNewWords(); break;
    }

    // Apply deck filter
    if (filterDeck) words = words.filter(w => w.deckId === filterDeck);

    // Apply POS filter
    if (filterPos) words = words.filter(w => w.partOfSpeech === filterPos);

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      words = words.filter(w =>
        w.word.toLowerCase().includes(q) ||
        (w.meaning && w.meaning.toLowerCase().includes(q)) ||
        (w.explanation && w.explanation.toLowerCase().includes(q)) ||
        (w.tags && w.tags.toLowerCase().includes(q))
      );
    }

    const masteryColors = {
      New: 'badge-yellow',
      Learning: 'badge-accent',
      Intermediate: 'badge-accent',
      Mastered: 'badge-green',
    };

    const deck = (id) => decks.find(d => d.id === id);

    container.innerHTML = `
      <div class="animate-fade-in-up">
        <div class="page-header">
          <h1>🔍 Search & Review</h1>
          <p>Find, filter, and review your vocabulary</p>
        </div>

        <!-- Search Bar -->
        <div class="search-bar" style="margin-bottom:var(--space-5);">
          <span class="search-icon">🔍</span>
          <input class="input" id="search-input" placeholder="Search words, meanings, tags..." value="${escapeHtml(searchQuery)}" autofocus>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap gap-3" style="margin-bottom:var(--space-6);">
          <div class="flex gap-2">
            ${[
              { id: 'all', label: '📋 All', count: getWords().length },
              { id: 'due', label: '⏰ Due Today', count: getDueWords().length },
              { id: 'difficult', label: '⚠️ Difficult', count: getDifficultWords().length },
              { id: 'new', label: '🆕 New', count: getNewWords().length },
            ].map(f => `
              <button class="btn ${filter === f.id ? 'btn-primary' : 'btn-secondary'} btn-sm filter-btn" data-filter="${f.id}">
                ${f.label} (${f.count})
              </button>
            `).join('')}
          </div>

          <select class="input" id="deck-filter" style="width:auto;padding:var(--space-2) var(--space-6) var(--space-2) var(--space-3);font-size:var(--font-size-sm);">
            <option value="">All Decks</option>
            ${decks.map(d => `<option value="${d.id}" ${filterDeck === d.id ? 'selected' : ''}>${escapeHtml(d.name)}</option>`).join('')}
          </select>

          <select class="input" id="pos-filter" style="width:auto;padding:var(--space-2) var(--space-6) var(--space-2) var(--space-3);font-size:var(--font-size-sm);">
            <option value="">All POS</option>
            ${['noun', 'verb', 'adjective', 'adverb', 'preposition', 'phrase'].map(pos => `
              <option value="${pos}" ${filterPos === pos ? 'selected' : ''}>${pos}</option>
            `).join('')}
          </select>
        </div>

        <!-- Results -->
        <div class="text-sm text-muted" style="margin-bottom:var(--space-4);">${words.length} result${words.length !== 1 ? 's' : ''}</div>

        ${words.length === 0 ? `
          <div class="empty-state card">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No words found</div>
            <div class="empty-state-text">Try a different search or filter.</div>
          </div>
        ` : `
          <div class="flex flex-col gap-3 stagger">
            ${words.slice(0, 100).map(word => `
              <div class="card card-interactive animate-fade-in-up word-result" style="padding:var(--space-4) var(--space-5);cursor:pointer;" data-word-id="${word.id}">
                <div class="flex items-center justify-between gap-4 flex-wrap">
                  <div style="min-width:0;flex:1;">
                    <div class="flex items-center gap-3 flex-wrap" style="margin-bottom:var(--space-2);">
                      <strong style="font-size:var(--font-size-md);">${escapeHtml(word.word)}</strong>
                      ${word.phonetic ? `<span class="text-sm text-muted">${escapeHtml(word.phonetic)}</span>` : ''}
                      ${word.partOfSpeech ? `<span class="badge badge-outline">${escapeHtml(word.partOfSpeech)}</span>` : ''}
                      <span class="badge ${masteryColors[getMasteryLabel(word)]}">${getMasteryLabel(word)}</span>
                    </div>
                    <div class="text-sm" style="margin-bottom:var(--space-2);">${escapeHtml(word.meaning)}</div>
                    ${word.example ? `<div class="text-sm text-muted" style="font-style:italic;">"${escapeHtml(truncate(word.example, 100))}"</div>` : ''}
                    <div class="flex items-center gap-3 flex-wrap" style="margin-top:var(--space-2);">
                      ${word.tags ? word.tags.split(',').slice(0, 4).map(t => `<span class="tag">${escapeHtml(t.trim())}</span>`).join('') : ''}
                      ${deck(word.deckId) ? `<span class="tag">📚 ${escapeHtml(deck(word.deckId).name)}</span>` : ''}
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-2" style="flex-shrink:0;">
                    <span class="text-sm text-muted">Next: ${formatNextReview(word.nextReview)}</span>
                    <button class="btn btn-ghost btn-sm edit-btn" data-word-id="${word.id}">✏️ Edit</button>
                  </div>
                </div>
              </div>
            `).join('')}
            ${words.length > 100 ? `<p class="text-sm text-muted" style="text-align:center;">Showing first 100 of ${words.length} results</p>` : ''}
          </div>
        `}
      </div>
    `;

    // Events
    const searchInput = document.getElementById('search-input');
    const handleSearch = debounce((val) => {
      searchQuery = val;
      render();
    }, 250);
    searchInput?.addEventListener('input', (e) => handleSearch(e.target.value));

    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = btn.dataset.filter;
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

    // Restore focus
    if (searchQuery) {
      const input = document.getElementById('search-input');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  };

  render();
}
