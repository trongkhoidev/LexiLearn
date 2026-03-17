import { db, getCurrentUser } from '../utils/supabase.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';

/**
 * PersonalDesk Page
 * Allows students to view their collections and manage materials.
 */
export async function renderPersonalDesk(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'student') {
    container.innerHTML = `<div class="p-12 text-center text-muted">Please log in as a Student to access your Personal Desk.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="flex items-center justify-center p-12">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const desks = await (db.desks?.listByUser ? db.desks.listByUser(user.id) : Promise.resolve([]));
    const desk = desks[0] || { title: 'My Study Desk', id: 'default' };
    const items = await (db.deskItems?.listByDesk && desk.id !== 'default' ? db.deskItems.listByDesk(desk.id) : Promise.resolve([]));

    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1040px;margin:0 auto;">
        <div class="page-header" style="margin-bottom:var(--space-8);">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="flex items-center gap-3">
                <span style="font-size:2rem;">🖥️</span> My Personal Desk
              </h1>
              <p class="text-muted">Explore your collection of saved materials and vocabulary.</p>
            </div>
            <button class="btn btn-primary" id="add-desk-item-btn">Add to Desk</button>
          </div>
        </div>

        <div class="grid grid-3 gap-6">
          <div class="card p-6 flex flex-col items-center text-center justify-center border-dashed border-2" style="min-height:200px; cursor:pointer;" id="add-item-card">
            <div class="text-4xl mb-4">➕</div>
            <div class="font-bold">Add New Item</div>
            <div class="text-xxs text-muted mt-2">Save a link or note</div>
          </div>

          ${items.map(item => `
            <div class="card p-6 card-interactive desk-item" data-id="${item.id}">
              <div class="flex justify-between items-start mb-4">
                <div class="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl">
                  ${item.type === 'vocabulary' ? '📖' : '📄'}
                </div>
                <button class="text-muted hover:text-red-500 delete-item-btn" data-id="${item.id}">✕</button>
              </div>
              <h3 class="font-bold text-sm mb-1">${escapeHtml(item.title || 'Untitled Item')}</h3>
              <p class="text-xs text-muted line-clamp-2">${escapeHtml(item.content || '')}</p>
              <div class="mt-4 pt-4 border-t flex justify-between items-center">
                <span class="badge badge-outline text-xxs">${item.type}</span>
                <span class="text-xxs text-muted">${new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          `).join('')}
        </div>

        ${items.length === 0 ? `
          <div class="p-12 text-center text-muted bg-gray-50 rounded-xl mt-8">
            Your desk is empty. Save materials from your classrooms to see them here.
          </div>
        ` : ''}
      </div>
    `;

    setupEvents(container, user.id);
  } catch (err) {
    container.innerHTML = `<div class="p-12 text-center text-red-500">Error: ${err.message}</div>`;
  }
}

function setupEvents(container, userId) {
  container.querySelector('#add-item-card')?.addEventListener('click', () => {
    document.getElementById('add-desk-item-btn')?.click();
  });

  document.getElementById('add-desk-item-btn')?.addEventListener('click', async () => {
    const title = prompt('Item Title:');
    if (!title) return;
    const content = prompt('Content / URL:');
    const type = prompt('Type (vocabulary/material):', 'material') || 'material';

    try {
      await db.deskItems.create({
        student_id: userId,
        title,
        content,
        type,
        created_at: new Date().toISOString()
      });
      showToast('Item saved to your desk!', 'success');
      renderPersonalDesk(container);
    } catch (err) {
      showToast('Failed to save item', 'error');
    }
  });

  container.querySelectorAll('.delete-item-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Remove this item from your desk?')) return;
      try {
        await db.deskItems.delete(btn.dataset.id);
        showToast('Item removed', 'success');
        renderPersonalDesk(container);
      } catch (err) {
        showToast('Failed to delete item', 'error');
      }
    });
  });
}
