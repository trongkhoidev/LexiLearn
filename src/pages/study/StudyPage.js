/* ============================================
   LexiLearn — Study Page (Refactored)
   ============================================
*/

import { db } from '../../utils/supabase.js';
import { renderSkeleton, renderEmptyState } from '../../utils/helpers.js';
import { navigateTo } from '../../router.js';

// Components (To be created)
import { renderModeSelect } from './StudyModeSelect.js';
import { renderStudySession } from './StudySession.js';

export async function renderStudy(container, params) {
  const deckSlug = params.slug;
  const isAll = deckSlug === 'all';
  
  // Clear previous cleanup if any
  if (container._studyCleanup) {
    container._studyCleanup();
    container._studyCleanup = null;
  }

  // Initial Skeleton
  container.innerHTML = `
    <div class="animate-fade-in flex-center flex-col p-20">
      ${renderSkeleton('card', 1)}
      <div class="skeleton mt-6" style="width: 200px; height: 20px;"></div>
    </div>
  `;

  try {
    let deckId = null;
    if (!isAll) {
      const deck = await db.decks.getBySlug(deckSlug);
      if (!deck) throw new Error('Deck not found');
      deckId = deck.id;
    }
    
    // Use service to fetch words
    const allWords = await db.words.list();
    let wordsInDeck = deckId ? allWords.filter(w => w.deck_id === deckId) : allWords;
    
    const now = new Date();
    let cards = wordsInDeck.filter(w => !w.next_review || new Date(w.next_review) <= now);
    
    // If no due cards, show some new ones
    if (cards.length === 0) {
      cards = wordsInDeck.filter(w => !w.review_count).slice(0, 10);
    }

    if (cards.length === 0) {
      container.innerHTML = renderEmptyState({
        icon: '🎉',
        title: 'All caught up!',
        message: 'No cards are due for review right now. Come back later or explore other collections.',
        actionHtml: `
          <div class="flex gap-3">
            <button class="btn btn-primary" id="go-dashboard">Dashboard</button>
            <button class="btn btn-secondary" id="go-decks">See All Decks</button>
          </div>
        `
      });
      container.querySelector('#go-dashboard')?.addEventListener('click', () => navigateTo('/dashboard'));
      container.querySelector('#go-decks')?.addEventListener('click', () => navigateTo('/decks'));
      return;
    }

    // Start with Mode Selection
    renderModeSelect(container, {
      cards,
      deckSlug,
      onSelect: (mode) => {
        renderStudySession(container, { cards, mode, deckSlug });
      }
    });

  } catch (err) {
    container.innerHTML = `
      <div class="p-20 text-center">
         <div class="text-4xl mb-4">😰</div>
         <h2 class="text-xl font-bold text-red-600 mb-2">Something went wrong</h2>
         <p class="text-muted text-sm mb-6">${err.message}</p>
         <button class="btn btn-primary" id="error-go-back">Back to Dashboard</button>
      </div>
    `;
    container.querySelector('#error-go-back')?.addEventListener('click', () => navigateTo('/dashboard'));
  }
}
