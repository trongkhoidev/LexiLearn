import { db } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { showModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { renderSkeleton, renderEmptyState, escapeHtml } from '../utils/helpers.js';
import { toSlug } from '../utils/url.js';
import { renderIcon } from '../utils/icons.js';

export async function renderDeckList(container) {
  // Initial skeleton state
  container.innerHTML = `
    <div class="animate-fade-in" style="max-width:1100px;margin:0 auto;">
      <div class="page-header flex-between mb-8">
        <div>
          <div class="skeleton skeleton-title" style="width: 200px;"></div>
          <div class="skeleton skeleton-text" style="width: 300px;"></div>
        </div>
        <div class="skeleton" style="width: 140px; height: 44px; border-radius: 12px;"></div>
      </div>
      <div class="grid grid-3 gap-6">
        ${renderSkeleton('card', 6)}
      </div>
    </div>
  `;

  const render = async () => {
    try {
      const [decks, words] = await Promise.all([
        db.decks.list(),
        db.words.list()
      ]);

      container.innerHTML = `
        <div class="animate-fade-in-up" style="max-width:1100px;margin:0 auto;">
          <div class="page-header flex-between flex-wrap gap-4 mb-8">
            <div>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <div style="color: var(--color-accent);">${renderIcon('decks', 28)}</div>
                <h1 style="margin: 0;">Vocabulary Decks</h1>
              </div>
              <p>Manage your word collections and track your mastery progress.</p>
            </div>
            <button class="btn btn-primary shadow-lg" id="create-deck-btn">+ Create New Deck</button>
          </div>

          <div class="divider"></div>

          ${decks.length === 0 ? renderEmptyState({
            icon: renderIcon('materials', 32),
            title: 'No decks found',
            message: 'Start by creating your first deck. Your collections are synced across all your devices.',
            actionHtml: `<button class="btn btn-primary" id="empty-create-btn">Create Your First Deck</button>`
          }) : `
            <div class="grid grid-3">
              ${decks.map(deck => {
                const totalWords = words.filter(w => w.deck_id === deck.id).length;
                const masteredCount = words.filter(w => w.deck_id === deck.id && w.srs_level >= 5).length;
                const progress = totalWords > 0 ? (masteredCount / totalWords) * 100 : 0;
                
                return `
                  <div class="card card-interactive hover-lift flex flex-col justify-between h-full" data-deck-slug="${toSlug(deck.name)}">
                    <div>
                      <div class="flex-between mb-4">
                        <div class="w-10 h-10 rounded-xl bg-blue-50 flex-center shadow-sm" style="color: var(--color-blue);">${renderIcon('decks', 20)}</div>
                        <div class="flex gap-1">
                          <button class="btn btn-ghost btn-xs edit-deck-btn p-1" data-id="${deck.id}" title="Edit Name" style="color: var(--color-blue);">${renderIcon('edit', 16)}</button>
                          <button class="btn btn-ghost btn-xs delete-deck-btn p-1" data-id="${deck.id}" title="Delete Deck" style="color: var(--color-red);">${renderIcon('delete', 16)}</button>
                        </div>
                      </div>
                      <h3 class="text-lg font-bold mb-2">${escapeHtml(deck.name)}</h3>
                      <p class="text-xs text-muted leading-relaxed line-clamp-2 mb-6">${escapeHtml(deck.description || 'No description provided.')}</p>
                    </div>

                    <div class="pt-4 border-t border-gray-50">
                      <div class="flex-between mb-2">
                        <span class="text-xxs font-black text-muted uppercase tracking-widest">${totalWords} Words</span>
                        <span class="text-xxs font-black text-blue-600 uppercase tracking-widest">${masteredCount} Mastered</span>
                      </div>
                      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="h-full bg-blue-500 transition-all duration-1000" style="width: ${progress}%"></div>
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
      container.innerHTML = `<div class="p-12 text-center text-red-500 card m-8 shadow-xl">
        <h2 class="font-bold mb-2">Failed to load decks</h2>
        <p class="text-sm opacity-70 mb-6">${err.message}</p>
        <button class="btn btn-primary btn-sm" onclick="window.location.reload()">Retry Now</button>
      </div>`;
    }
  };

  const setupEvents = (decks) => {
    container.querySelectorAll('.card-interactive').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.edit-deck-btn') || e.target.closest('.delete-deck-btn')) return;
        navigateTo(`/deck/${card.dataset.deckSlug}`);
      });
    });

    const handleCreate = () => {
      const content = `
        <form id="create-deck-form" class="space-y-4">
          <div class="input-group">
            <label>Deck Name</label>
            <input type="text" id="deck-name-input" class="input" placeholder="e.g. IELTS Writing Essential Collocations" required autofocus>
          </div>
          <div class="input-group">
            <label>Description</label>
            <textarea id="deck-desc-input" class="textarea" placeholder="What will you learn in this deck?" rows="3"></textarea>
          </div>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" class="btn btn-ghost modal-close-btn" id="cancel-create">Cancel</button>
            <button type="submit" class="btn btn-primary px-8">Create Deck</button>
          </div>
        </form>
      `;

      const modal = showModal('Create New Deck', content, { width: 450 });
      
      const form = modal.element.querySelector('#create-deck-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        const name = form.querySelector('#deck-name-input').value.trim();
        const description = form.querySelector('#deck-desc-input').value.trim();

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner-xs"></div> Creating...';

        try {
          await db.decks.create({ name, description });
          modal.close();
          showToast(`Deck "${name}" created!`, 'success');
          render();
        } catch (e) { 
          showToast(e.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Deck';
        }
      });

      modal.element.querySelector('#cancel-create').addEventListener('click', () => modal.close());
    };

    container.querySelector('#create-deck-btn')?.addEventListener('click', handleCreate);
    container.querySelector('#empty-create-btn')?.addEventListener('click', handleCreate);

    container.querySelectorAll('.edit-deck-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const deckId = btn.dataset.id;
        const deck = decks.find(d => d.id === deckId);
        
        const content = `
          <form id="edit-deck-form" class="space-y-4">
            <div class="input-group">
              <label>Deck Name</label>
              <input type="text" id="edit-deck-name" class="input" value="${escapeHtml(deck.name)}" required autofocus>
            </div>
            <div class="mt-6 flex justify-end gap-3">
              <button type="button" class="btn btn-ghost modal-close-btn" id="cancel-edit">Cancel</button>
              <button type="submit" class="btn btn-primary px-8">Update Deck</button>
            </div>
          </form>
        `;

        const modal = showModal('Edit Deck', content, { width: 400 });
        
        const form = modal.element.querySelector('#edit-deck-form');
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const submitBtn = form.querySelector('button[type="submit"]');
          const name = form.querySelector('#edit-deck-name').value.trim();

          submitBtn.disabled = true;
          submitBtn.innerHTML = '<div class="spinner-xs"></div> Updating...';

          try {
            await db.decks.update(deckId, { name });
            modal.close(); 
            showToast('Deck updated!', 'success');
            render();
          } catch (e) {
            showToast(e.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Deck';
          }
        });

        modal.element.querySelector('#cancel-edit').addEventListener('click', () => modal.close());
      });
    });

    container.querySelectorAll('.delete-deck-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this deck and all its words permanently?')) {
          try {
            await db.decks.delete(btn.dataset.id);
            showToast('Deck deleted');
            render();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  };

  render();
}

