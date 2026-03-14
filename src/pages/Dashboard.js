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
      <div class="animate-fade-in-up">
        <!-- Hero Section -->
        <div class="card card-gradient" style="margin-bottom:var(--space-8);padding:var(--space-8);position:relative;overflow:hidden;border-left:4px solid #3B82F6;">
          <div class="flex items-center justify-between flex-wrap gap-6">
            <div style="flex:1;">
              <h1 style="font-size:var(--font-size-2xl);font-weight:var(--font-weight-bold);margin-bottom:var(--space-2);color:#1f2937;">
                Welcome back!
              </h1>
              <p style="color:#6b7280;font-size:var(--font-size-base);margin-bottom:var(--space-4);">
                ${dueWords.length > 0
                  ? `You have <strong style="color:#3B82F6;font-weight:600;">${dueWords.length} card${dueWords.length !== 1 ? 's' : ''}</strong> due for review today.`
                  : words.length > 0 ? 'All caught up! No cards due for review today.' : 'Start by creating a deck and adding some words to get learning!'
                }
              </p>
              ${streak > 0 ? `
                <div style="display:flex;align-items:center;gap:var(--space-2);background:#f0fdf4;padding:var(--space-2) var(--space-4);border-radius:var(--border-radius);width:fit-content;">
                  <span style="font-size:1.4rem;">🔥</span>
                  <span style="font-weight:600;color:#15803d;">Streak: ${streak} day${streak !== 1 ? 's' : ''}</span>
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
        <div class="grid grid-4 stagger" style="margin-bottom:var(--space-8);">
          <div class="card animate-fade-in-up" style="text-align:center;padding:var(--space-6);border-left:4px solid #3B82F6;">
            <div style="font-size:var(--font-size-3xl);font-weight:var(--font-weight-bold);color:#3B82F6;margin-bottom:var(--space-2);">${words.length}</div>
            <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Total Words</div>
          </div>
          <div class="card animate-fade-in-up" style="text-align:center;padding:var(--space-6);border-left:4px solid #f59e0b;">
            <div style="font-size:var(--font-size-3xl);font-weight:var(--font-weight-bold);color:#f59e0b;margin-bottom:var(--space-2);">${dueWords.length}</div>
            <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Due Today</div>
          </div>
          <div class="card animate-fade-in-up" style="text-align:center;padding:var(--space-6);border-left:4px solid #8b5cf6;">
            <div style="font-size:var(--font-size-3xl);font-weight:var(--font-weight-bold);color:#8b5cf6;margin-bottom:var(--space-2);">${studiedToday}</div>
            <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Studied Today</div>
          </div>
          <div class="card animate-fade-in-up" style="text-align:center;padding:var(--space-6);border-left:4px solid #10b981;">
            <div style="font-size:var(--font-size-3xl);font-weight:var(--font-weight-bold);color:#10b981;margin-bottom:var(--space-2);">${mastery.Mastered}</div>
            <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Mastered</div>
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
          <div class="grid grid-3 stagger">
            ${decks.slice(0, 6).map(deck => {
              const deckWords = words.filter(w => w.deck_id === deck.id);
              const deckDue = deckWords.filter(w => !w.next_review || new Date(w.next_review) <= now).length;
              const totalWords = deckWords.length;
              const mastered = deckWords.filter(w => (w.srs_level || 0) >= 5).length;
              const progress = percent(mastered, totalWords);
              return `
                <div class="card card-interactive animate-fade-in-up deck-card" data-deck-id="${deck.id}" style="display:flex;flex-direction:column;">
                  <div class="flex items-center justify-between" style="margin-bottom:var(--space-4);">
                    <h3 style="font-size:var(--font-size-md);font-weight:600;color:#1f2937;">${escapeHtml(deck.name)}</h3>
                    ${deckDue > 0 ? `<span class="badge badge-accent" style="font-size:11px;">${deckDue}</span>` : `<span style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;background:#ecfdf5;border-radius:50%;color:#10b981;font-weight:600;font-size:12px;">✓</span>`}
                  </div>
                  <p style="font-size:var(--font-size-sm);color:#6b7280;margin-bottom:var(--space-4);flex:1;line-height:1.5;">${escapeHtml(deck.description || 'No description provided')}</p>
                  <div style="border-top:1px solid #e5e7eb;padding-top:var(--space-4);">
                    <div class="flex items-center justify-between text-sm" style="margin-bottom:var(--space-3);">
                      <span style="color:#6b7280;font-size:var(--font-size-sm);">${totalWords} word${totalWords !== 1 ? 's' : ''}</span>
                      <span style="color:#3B82F6;font-weight:600;font-size:var(--font-size-sm);">${progress}% done</span>
                    </div>
                    <div class="progress-bar" style="height:4px;">
                      <div class="progress-bar-fill" style="width:${progress}%;background:linear-gradient(90deg, #3B82F6 0%, #06b6d4 100%);"></div>
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
