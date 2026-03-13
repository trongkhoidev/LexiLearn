/* ============================================
   LexiLearn — Dashboard Page
   ============================================ */

import { getDecks, getWords, getStats } from '../data/store.js';
import { getDueWords, getNewWords, getMasteryDistribution } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { percent } from '../utils/helpers.js';

export function renderDashboard(container) {
  const words = getWords();
  const decks = getDecks();
  const stats = getStats();
  const dueWords = getDueWords();
  const newWords = getNewWords();
  const mastery = getMasteryDistribution();
  const today = new Date().toISOString().slice(0, 10);
  const todayStats = stats.dailySessions?.[today] || { studied: 0, newWords: 0, reviewed: 0 };

  container.innerHTML = `
    <div class="animate-fade-in-up">
      <!-- Hero Section -->
      <div class="dashboard-hero card card-gradient" style="margin-bottom:var(--space-8);padding:var(--space-10) var(--space-8);position:relative;overflow:hidden;">
        <div style="position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(108,99,255,0.15) 0%,transparent 70%);pointer-events:none;"></div>
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-bold);margin-bottom:var(--space-2);">
              Welcome back! 👋
            </h1>
            <p class="text-muted" style="font-size:var(--font-size-base);">
              ${dueWords.length > 0
                ? `You have <strong style="color:var(--color-accent)">${dueWords.length} cards</strong> due for review today.`
                : words.length > 0 ? 'All caught up! No cards due for review. 🎉' : 'Start by creating a deck and adding some words!'
              }
            </p>
          </div>
          <div class="flex gap-3">
            ${dueWords.length > 0 ? `<button class="btn btn-primary btn-lg" id="dash-study-btn">📖 Study Now</button>` : ''}
            <button class="btn btn-secondary btn-lg" id="dash-add-btn">➕ Add Word</button>
          </div>
        </div>
        ${stats.streak > 0 ? `
          <div style="margin-top:var(--space-6);display:flex;align-items:center;gap:var(--space-3);">
            <span style="font-size:1.6rem;animation:fireGlow 2s infinite;">🔥</span>
            <span style="font-weight:var(--font-weight-bold);font-size:var(--font-size-lg);">${stats.streak} day streak!</span>
          </div>
        ` : ''}
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-4 stagger" style="margin-bottom:var(--space-8);">
        <div class="card stat-card animate-fade-in-up">
          <div class="stat-value">${words.length}</div>
          <div class="stat-label">Total Words</div>
        </div>
        <div class="card stat-card animate-fade-in-up">
          <div class="stat-value">${dueWords.length}</div>
          <div class="stat-label">Due Today</div>
        </div>
        <div class="card stat-card animate-fade-in-up">
          <div class="stat-value">${todayStats.studied}</div>
          <div class="stat-label">Studied Today</div>
        </div>
        <div class="card stat-card animate-fade-in-up">
          <div class="stat-value">${mastery.Mastered}</div>
          <div class="stat-label">Mastered</div>
        </div>
      </div>

      <!-- Decks Section -->
      <div class="flex items-center justify-between" style="margin-bottom:var(--space-5);">
        <h2 style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);">My Decks</h2>
        <button class="btn btn-ghost btn-sm" id="dash-view-decks">View All →</button>
      </div>

      ${decks.length === 0 ? `
        <div class="empty-state card">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-title">No decks yet</div>
          <div class="empty-state-text">Create your first deck to start organizing and learning vocabulary.</div>
          <button class="btn btn-primary" id="dash-create-deck-btn">📚 Create Deck</button>
        </div>
      ` : `
        <div class="grid grid-3 stagger">
          ${decks.slice(0, 6).map(deck => {
            const deckWords = words.filter(w => w.deckId === deck.id);
            const deckDue = getDueWords(deck.id).length;
            const totalWords = deckWords.length;
            const mastered = deckWords.filter(w => w.srsLevel >= 5).length;
            const progress = percent(mastered, totalWords);
            return `
              <div class="card card-interactive animate-fade-in-up deck-card" data-deck-id="${deck.id}">
                <div class="flex items-center justify-between" style="margin-bottom:var(--space-4);">
                  <h3 style="font-size:var(--font-size-md);font-weight:var(--font-weight-semibold);">${deck.name}</h3>
                  ${deckDue > 0 ? `<span class="badge badge-accent">${deckDue} due</span>` : `<span class="badge badge-green">✓</span>`}
                </div>
                <p class="text-sm text-muted" style="margin-bottom:var(--space-4);">${deck.description || 'No description'}</p>
                <div class="flex items-center justify-between text-sm" style="margin-bottom:var(--space-2);">
                  <span class="text-muted">${totalWords} words</span>
                  <span class="text-muted">${progress}%</span>
                </div>
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width:${progress}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    </div>
  `;

  // Event listeners
  container.querySelector('#dash-study-btn')?.addEventListener('click', () => {
    // Find the deck with most due words, or study all
    if (decks.length > 0) {
      let best = decks[0];
      let bestCount = getDueWords(decks[0].id).length;
      decks.forEach(d => {
        const c = getDueWords(d.id).length;
        if (c > bestCount) { best = d; bestCount = c; }
      });
      navigateTo(`/study/${best.id}`);
    } else {
      navigateTo('/study/all');
    }
  });

  container.querySelector('#dash-add-btn')?.addEventListener('click', () => navigateTo('/add-word'));
  container.querySelector('#dash-view-decks')?.addEventListener('click', () => navigateTo('/decks'));
  container.querySelector('#dash-create-deck-btn')?.addEventListener('click', () => navigateTo('/decks'));

  container.querySelectorAll('.deck-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.deckId;
      navigateTo(`/deck/${id}`);
    });
  });
}
