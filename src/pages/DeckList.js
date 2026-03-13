/* ============================================
   LexiLearn — Deck List Page
   ============================================ */

import { getDecks, saveDeck, deleteDeck, getWords } from '../data/store.js';
import { getDueWords } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { showModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { percent } from '../utils/helpers.js';

export function renderDeckList(container) {
  const render = () => {
    const decks = getDecks();
    const words = getWords();

    container.innerHTML = `
      <div class="animate-fade-in-up">
        <div class="page-header flex items-center justify-between">
          <div>
            <h1>📚 My Decks</h1>
            <p>${decks.length} deck${decks.length !== 1 ? 's' : ''} — organize your vocabulary by topic</p>
          </div>
          <button class="btn btn-primary" id="create-deck-btn">➕ New Deck</button>
        </div>

        ${decks.length === 0 ? `
          <div class="empty-state card" style="margin-top:var(--space-8);">
            <div class="empty-state-icon">📂</div>
            <div class="empty-state-title">No decks yet</div>
            <div class="empty-state-text">Create your first deck to start organizing vocabulary by topic — IELTS, Business, Academic, and more.</div>
            <button class="btn btn-primary" id="empty-create-btn">📚 Create First Deck</button>
          </div>
        ` : `
          <div class="grid grid-3 stagger">
            ${decks.map(deck => {
              const deckWords = words.filter(w => w.deckId === deck.id);
              const deckDue = getDueWords(deck.id).length;
              const totalWords = deckWords.length;
              const mastered = deckWords.filter(w => w.srsLevel >= 5).length;
              const progress = percent(mastered, totalWords);
              return `
                <div class="card card-interactive animate-fade-in-up" data-deck-id="${deck.id}" style="cursor:pointer;">
                  <div class="flex items-center justify-between" style="margin-bottom:var(--space-3);">
                    <h3 style="font-size:var(--font-size-md);font-weight:var(--font-weight-semibold);">${deck.name}</h3>
                    <div class="flex gap-2">
                      <button class="btn btn-ghost btn-sm edit-deck-btn" data-id="${deck.id}" title="Edit">✏️</button>
                      <button class="btn btn-ghost btn-sm delete-deck-btn" data-id="${deck.id}" title="Delete">🗑️</button>
                    </div>
                  </div>
                  <p class="text-sm text-muted" style="margin-bottom:var(--space-4);min-height:36px;">${deck.description || 'No description'}</p>
                  <div class="flex gap-4 text-sm" style="margin-bottom:var(--space-4);">
                    <div><strong>${totalWords}</strong> <span class="text-muted">words</span></div>
                    <div><strong class="text-accent">${deckDue}</strong> <span class="text-muted">due</span></div>
                    <div><strong style="color:var(--color-green)">${mastered}</strong> <span class="text-muted">mastered</span></div>
                  </div>
                  <div class="flex items-center justify-between text-sm" style="margin-bottom:var(--space-2);">
                    <span class="text-muted">Progress</span>
                    <span class="font-semibold">${progress}%</span>
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

    // Navigate to deck detail
    container.querySelectorAll('[data-deck-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.edit-deck-btn') || e.target.closest('.delete-deck-btn')) return;
        navigateTo(`/deck/${card.dataset.deckId}`);
      });
    });

    // Create deck
    const openCreateModal = () => {
      const modal = showModal('Create New Deck', `
        <div class="flex flex-col gap-4">
          <div class="input-group">
            <label>Deck Name *</label>
            <input class="input" id="deck-name-input" placeholder="e.g. IELTS Vocabulary" required>
          </div>
          <div class="input-group">
            <label>Description</label>
            <textarea class="textarea" id="deck-desc-input" placeholder="What this deck is about..." rows="3"></textarea>
          </div>
          <button class="btn btn-primary" id="save-deck-btn" style="margin-top:var(--space-2);">Create Deck</button>
        </div>
      `);

      document.getElementById('save-deck-btn')?.addEventListener('click', () => {
        const name = document.getElementById('deck-name-input')?.value?.trim();
        if (!name) return showToast('Please enter a deck name', 'error');
        const desc = document.getElementById('deck-desc-input')?.value?.trim();
        saveDeck({ name, description: desc });
        modal.close();
        showToast(`Deck "${name}" created!`);
        render();
      });

      setTimeout(() => document.getElementById('deck-name-input')?.focus(), 100);
    };

    container.querySelector('#create-deck-btn')?.addEventListener('click', openCreateModal);
    container.querySelector('#empty-create-btn')?.addEventListener('click', openCreateModal);

    // Edit deck
    container.querySelectorAll('.edit-deck-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const deck = getDecks().find(d => d.id === btn.dataset.id);
        if (!deck) return;

        const modal = showModal('Edit Deck', `
          <div class="flex flex-col gap-4">
            <div class="input-group">
              <label>Deck Name *</label>
              <input class="input" id="edit-deck-name" value="${deck.name}">
            </div>
            <div class="input-group">
              <label>Description</label>
              <textarea class="textarea" id="edit-deck-desc" rows="3">${deck.description || ''}</textarea>
            </div>
            <button class="btn btn-primary" id="update-deck-btn">Update Deck</button>
          </div>
        `);

        document.getElementById('update-deck-btn')?.addEventListener('click', () => {
          const name = document.getElementById('edit-deck-name').value.trim();
          if (!name) return showToast('Name is required', 'error');
          saveDeck({ ...deck, name, description: document.getElementById('edit-deck-desc').value.trim() });
          modal.close();
          showToast('Deck updated!');
          render();
        });
      });
    });

    // Delete deck
    container.querySelectorAll('.delete-deck-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const deck = getDecks().find(d => d.id === btn.dataset.id);
        if (!deck) return;
        const modal = showModal('Delete Deck', `
          <p style="margin-bottom:var(--space-6);">Are you sure you want to delete <strong>"${deck.name}"</strong>? Words in this deck will be unassigned but not deleted.</p>
          <div class="flex gap-3">
            <button class="btn btn-danger" id="confirm-delete-btn" style="flex:1;">Delete</button>
            <button class="btn btn-secondary" id="cancel-delete-btn" style="flex:1;">Cancel</button>
          </div>
        `);

        document.getElementById('confirm-delete-btn').addEventListener('click', () => {
          deleteDeck(deck.id);
          modal.close();
          showToast('Deck deleted');
          render();
        });
        document.getElementById('cancel-delete-btn').addEventListener('click', () => modal.close());
      });
    });
  };

  render();
}
