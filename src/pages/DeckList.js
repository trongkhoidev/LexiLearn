import { db } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { showModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { percent } from '../utils/helpers.js';

export async function renderDeckList(container) {
  container.innerHTML = `<div class="flex items-center justify-center" style="min-height:200px;"><div class="spinner"></div></div>`;

  const render = async () => {
    try {
      const decks = await db.decks.list();

      container.innerHTML = `
        <div class="animate-fade-in-up">
          <div class="flex items-center justify-between" style="margin-bottom:var(--space-8);">
            <div>
              <h1 style="font-size:var(--font-size-2xl);font-weight:700;color:#1f2937;margin-bottom:var(--space-2);">My Decks</h1>
              <p style="color:#6b7280;font-size:var(--font-size-base);">Manage ${decks.length} deck${decks.length !== 1 ? 's' : ''} — organized in the cloud</p>
            </div>
            <button class="btn btn-primary" id="create-deck-btn">Create Deck</button>
          </div>

          ${decks.length === 0 ? `
            <div class="card" style="text-align:center;padding:var(--space-12) var(--space-8);border:2px dashed #e5e7eb;">
              <div style="font-size:2.5rem;margin-bottom:var(--space-4);">📂</div>
              <h2 style="font-size:var(--font-size-lg);font-weight:600;color:#1f2937;margin-bottom:var(--space-2);">No decks yet</h2>
              <p style="color:#6b7280;margin-bottom:var(--space-6);max-width:450px;margin-left:auto;margin-right:auto;">Start by creating your first deck. Everything you create is automatically saved to the database.</p>
              <button class="btn btn-primary" id="empty-create-btn">Create First Deck</button>
            </div>
          ` : `
            <div class="grid grid-3 stagger">
              ${decks.map(deck => {
                const totalWords = deck.word_count || 0;
                const progress = 0; // Simplified for now, will add aggregate stats later
                return `
                  <div class="card card-interactive animate-fade-in-up" data-deck-id="${deck.id}" style="cursor:pointer;display:flex;flex-direction:column;">
                    <div class="flex items-center justify-between" style="margin-bottom:var(--space-4);">
                      <div>
                        <h3 style="font-size:var(--font-size-md);font-weight:600;color:#1f2937;margin-bottom:var(--space-1);">${deck.name}</h3>
                      </div>
                      <div class="flex gap-2">
                        <button class="btn btn-ghost btn-sm edit-deck-btn" data-id="${deck.id}" style="width:32px;height:32px;padding:0;">✏️</button>
                        <button class="btn btn-ghost btn-sm delete-deck-btn" data-id="${deck.id}" style="width:32px;height:32px;padding:0;">🗑️</button>
                      </div>
                    </div>
                    <p style="font-size:var(--font-size-sm);color:#6b7280;margin-bottom:var(--space-4);flex:1;line-height:1.5;">${deck.description || 'No description'}</p>
                    <div style="border-top:1px solid #e5e7eb;padding-top:var(--space-4);">
                      <div class="flex items-center justify-between text-sm">
                        <div><span style="color:#6b7280;font-size:var(--font-size-xs);">Words:</span> <strong>${totalWords}</strong></div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>
      `;

      setupEvents(decks);
    } catch (err) {
      container.innerHTML = `<div class="card" style="padding:2rem;text-align:center;"><h3 style="color:#ef4444;">Error loading decks</h3><p>${err.message}</p></div>`;
    }
  };

  const setupEvents = (decks) => {
    container.querySelectorAll('[data-deck-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.edit-deck-btn') || e.target.closest('.delete-deck-btn')) return;
        navigateTo(`/deck/${card.dataset.deckId}`);
      });
    });

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

      document.getElementById('save-deck-btn')?.addEventListener('click', async () => {
        const name = document.getElementById('deck-name-input')?.value?.trim();
        if (!name) return showToast('Please enter a deck name', 'error');
        try {
          await db.decks.create({ name, description: document.getElementById('deck-desc-input')?.value?.trim() });
          modal.close();
          showToast(`Deck "${name}" created!`);
          render();
        } catch (e) { showToast(e.message, 'error'); }
      });
    };

    container.querySelector('#create-deck-btn')?.addEventListener('click', openCreateModal);
    container.querySelector('#empty-create-btn')?.addEventListener('click', openCreateModal);

    container.querySelectorAll('.edit-deck-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const deckId = btn.dataset.id;
        const deck = decks.find(d => d.id === deckId);
        const modal = showModal('Edit Deck', `
          <div class="flex flex-col gap-4">
            <div class="input-group">
              <label>Deck Name *</label>
              <input class="input" id="edit-deck-name" value="${deck.name}">
            </div>
            <button class="btn btn-primary" id="update-deck-btn">Update</button>
          </div>
        `);
        document.getElementById('update-deck-btn').onclick = async () => {
          await db.decks.update(deckId, { name: document.getElementById('edit-deck-name').value });
          modal.close(); render();
        };
      });
    });

    container.querySelectorAll('.delete-deck-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Are you sure?')) {
          db.decks.delete(btn.dataset.id).then(render);
        }
      });
    });
  };

  render();
}
