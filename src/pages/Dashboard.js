import { db } from '../utils/supabase.js';
import { getMasteryDistribution } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { percent, escapeHtml } from '../utils/helpers.js';

export async function renderDashboard(container) {
  // Show loading state initially
  container.innerHTML = `
    <div class="flex items-center justify-center p-20">
      <div class="spinner"></div>
      <span class="ml-3 text-muted">Loading your progress...</span>
    </div>
  `;

  try {
    const words = await db.words.list();
    const decks = await db.decks.list();
    
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    
    const dueWords = words.filter(w => !w.next_review || new Date(w.next_review) <= now);
    const studiedToday = words.filter(w => w.last_review && w.last_review.startsWith(todayStr)).length;
    const mastery = getMasteryDistribution(words);

    // Mock streak for now or calculate from reviews
    const streak = 0; 

    container.innerHTML = `
      <div class="animate-fade-in-up dashboard-container">
        <!-- Hero Section -->
        <div class="hero-card" style="margin-bottom:var(--space-10);">
          <div class="flex items-center justify-between flex-wrap gap-6">
            <div style="flex:1;">
              <h1 class="hero-title">Welcome back!</h1>
              <p class="hero-subtitle">
                ${dueWords.length > 0
                  ? `You have <strong class="text-accent">${dueWords.length} card${dueWords.length !== 1 ? 's' : ''}</strong> due for review today.`
                  : words.length > 0 ? 'All caught up! No cards due for review today.' : 'Start by creating a deck and adding some words to get learning!'
                }
              </p>
              ${streak > 0 ? `
                <div class="streak-badge">
                  <span class="streak-icon">🔥</span>
                  <span class="streak-text">Streak: ${streak} day${streak !== 1 ? 's' : ''}</span>
                </div>
              ` : ''}
            </div>
            <div class="flex gap-3" style="flex-wrap:wrap;justify-content:flex-end;">
              ${dueWords.length > 0 ? `<button class="btn btn-primary" id="dash-study-btn">Study Now</button>` : ''}
              <button class="btn btn-secondary" id="dash-add-btn">Add Word</button>
            </div>
          </div>
        </div>

        <!-- Stats Cards -->
        <div class="grid grid-4-responsive stagger" style="margin-bottom:var(--space-10);">
          <div class="stat-card-modern animate-fade-in-up" style="border-left-color: #3B82F6;">
            <div class="stat-icon" style="background: linear-gradient(135deg, #3B82F6 0%, #dbeafe 100%); -webkit-mask: radial-gradient(circle, transparent 30%, black 70%);">📚</div>
            <div class="stat-value" style="color: #3B82F6;">${words.length}</div>
            <div class="stat-label">Total Words</div>
          </div>
          <div class="stat-card-modern animate-fade-in-up" style="border-left-color: #f59e0b;">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f59e0b 0%, #fef3c7 100%); -webkit-mask: radial-gradient(circle, transparent 30%, black 70%);">📋</div>
            <div class="stat-value" style="color: #f59e0b;">${dueWords.length}</div>
            <div class="stat-label">Due Today</div>
          </div>
          <div class="stat-card-modern animate-fade-in-up" style="border-left-color: #8b5cf6;">
            <div class="stat-icon" style="background: linear-gradient(135deg, #8b5cf6 0%, #ede9fe 100%); -webkit-mask: radial-gradient(circle, transparent 30%, black 70%);">✨</div>
            <div class="stat-value" style="color: #8b5cf6;">${studiedToday}</div>
            <div class="stat-label">Studied Today</div>
          </div>
          <div class="stat-card-modern animate-fade-in-up" style="border-left-color: #10b981;">
            <div class="stat-icon" style="background: linear-gradient(135deg, #10b981 0%, #d1fae5 100%); -webkit-mask: radial-gradient(circle, transparent 30%, black 70%);">🏆</div>
            <div class="stat-value" style="color: #10b981;">${mastery.Mastered}</div>
            <div class="stat-label">Mastered</div>
          </div>
        </div>

        <!-- Decks Section -->
        <div class="flex items-center justify-between" style="margin-bottom:var(--space-6);">
          <div>
            <h2 style="font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:#1f2937;margin-bottom:var(--space-1);">My Decks</h2>
            <p style="font-size:var(--font-size-sm);color:#6b7280;">Organize and manage your vocabulary decks</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="dash-view-decks">View All</button>
        </div>

        ${decks.length === 0 ? `
          <div class="card" style="text-align:center;padding:var(--space-10) var(--space-8);border:2px dashed #e5e7eb;">
            <div style="font-size:2.5rem;margin-bottom:var(--space-4);">📚</div>
            <h3 style="font-size:var(--font-size-lg);font-weight:600;color:#1f2937;margin-bottom:var(--space-2);">No decks yet</h3>
            <p style="color:#6b7280;margin-bottom:var(--space-6);max-width:400px;margin-left:auto;margin-right:auto;">Create your first deck to start organizing and learning vocabulary by topic.</p>
            <button class="btn btn-primary" id="dash-create-deck-btn">Create First Deck</button>
          </div>
        ` : `
          <div class="grid grid-3-responsive stagger">
            ${decks.slice(0, 6).map(deck => {
              const deckWords = words.filter(w => w.deck_id === deck.id);
              const deckDue = deckWords.filter(w => !w.next_review || new Date(w.next_review) <= now).length;
              const totalWords = deckWords.length;
              const mastered = deckWords.filter(w => (w.srs_level || 0) >= 5).length;
              const progress = percent(mastered, totalWords);
              return `
                <div class="deck-card-modern animate-fade-in-up" data-deck-id="${deck.id}">
                  <div class="deck-card-header">
                    <h3 class="deck-card-title">${escapeHtml(deck.name)}</h3>
                    ${deckDue > 0 ? `<span class="deck-badge-due">${deckDue}</span>` : `<span class="deck-badge-done">✓</span>`}
                  </div>
                  <p class="deck-card-description">${escapeHtml(deck.description || 'No description provided')}</p>
                  <div class="deck-card-footer">
                    <div class="deck-card-stats">
                      <span class="deck-card-stat">${totalWords} word${totalWords !== 1 ? 's' : ''}</span>
                      <span class="deck-card-progress">${progress}% done</span>
                    </div>
                    <div class="progress-bar">
                      <div class="progress-bar-fill" style="width:${progress}%;"></div>
                    </div>
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
      if (decks.length > 0) {
        // Just pick the first deck with due words for now
        const best = decks.find(d => words.some(w => w.deck_id === d.id && (!w.next_review || new Date(w.next_review) <= now))) || decks[0];
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

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-red-500">Error loading dashboard: ${err.message}</div>`;
  }
}
