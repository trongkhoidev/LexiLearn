import { db, getCurrentUser } from '../utils/supabase.js';
import { escapeHtml, renderEmptyState } from '../utils/helpers.js';
import { showToast } from '../components/Toast.js';
import { showModal } from '../components/Modal.js';

export async function renderSharedDeskManager(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'teacher') {
    container.innerHTML = `<div class="p-12 text-center text-muted">Teacher access only.</div>`;
    return;
  }

  container.innerHTML = `<div class="p-12 text-center"><div class="spinner"></div></div>`;

  try {
    const [desks, classes] = await Promise.all([
      db.sharedDesks.listByTeacher(user.id).catch(() => []),
      db.classrooms.listByTeacher(user.id).catch(() => [])
    ]);

    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1100px;margin:0 auto;">
        <div class="page-header mb-8">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h1 class="text-3xl font-bold">📚 Shared Desk Topics</h1>
              <p class="text-muted">Build shared topics for students to learn. Students mark a topic as done when they finish the last card.</p>
            </div>
            <button class="btn btn-primary" id="create-shared-desk-btn">+ New Shared Desk</button>
          </div>
        </div>

        ${desks.length === 0
          ? renderEmptyState({ icon: '🧱', title: 'No shared desks yet', message: 'Create a shared desk, map it to classrooms, then add topics and cards.' })
          : `
            <div class="grid grid-2 gap-6" id="shared-desks-grid">
              ${desks.map(d => `
                <div class="card p-6 card-interactive shared-desk-card" data-id="${d.id}">
                  <div class="flex-between mb-3">
                    <h3 class="font-bold">${escapeHtml(d.title)}</h3>
                    <span class="badge badge-outline text-xxs">Shared</span>
                  </div>
                  <p class="text-xs text-muted line-clamp-2">${escapeHtml(d.description || '')}</p>
                  <div class="mt-5 pt-4 border-t flex-between">
                    <span class="text-xxs text-muted">Created ${new Date(d.created_at).toLocaleDateString()}</span>
                    <button class="btn btn-secondary btn-xs open-desk-btn" data-id="${d.id}">Manage →</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `
        }
      </div>
    `;

    document.getElementById('create-shared-desk-btn')?.addEventListener('click', () => {
      const modal = showModal('Create Shared Desk', `
        <form id="create-shared-desk-form" class="space-y-4">
          <div class="input-group">
            <label class="form-label">Title *</label>
            <input class="input" id="sd-title" placeholder="e.g. Band 6.0 Reading Topics" required autofocus />
          </div>
          <div class="input-group">
            <label class="form-label">Description</label>
            <textarea class="input w-full p-4 h-24" id="sd-desc" placeholder="What is this desk for?"></textarea>
          </div>
          <div class="input-group">
            <label class="form-label">Share to classrooms</label>
            <div class="grid grid-2 gap-2 max-h-48 overflow-auto p-3 bg-gray-50 rounded-lg border">
              ${classes.map(c => `
                <label class="flex items-center gap-2 text-xs">
                  <input type="checkbox" class="sd-class" value="${c.id}" />
                  <span class="font-bold">${escapeHtml(c.title)}</span>
                  <span class="text-muted">Band ${c.level_band_min}-${c.level_band_max}</span>
                </label>
              `).join('')}
              ${classes.length === 0 ? `<div class="text-xs text-muted italic">Create a classroom first.</div>` : ''}
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="btn btn-ghost" id="sd-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>
      `);

      document.getElementById('sd-cancel')?.addEventListener('click', () => modal.close());
      document.getElementById('create-shared-desk-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('sd-title')?.value?.trim();
        const description = document.getElementById('sd-desc')?.value?.trim();
        if (!title) return;

        const classroomIds = [...document.querySelectorAll('.sd-class:checked')].map(x => x.value);
        try {
          const createdRows = await db.sharedDesks.create({ teacher_id: user.id, title, description });
          const desk = createdRows?.[0];
          if (desk?.id && classroomIds.length > 0) {
            await db.sharedDesks.setClassrooms(desk.id, classroomIds);
          }
          showToast('Shared desk created', 'success');
          modal.close();
          renderSharedDeskManager(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('.open-desk-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await renderDeskDetail(container, btn.dataset.id, user, classes);
      });
    });

  } catch (err) {
    container.innerHTML = `<div class="p-12 text-center text-red-500">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function renderDeskDetail(container, deskId, user, classes) {
  container.innerHTML = `<div class="p-12 text-center"><div class="spinner"></div></div>`;
  const [desk, topics, mappings, progress] = await Promise.all([
    db.sharedDesks.get(deskId),
    db.sharedDesks.topics.listByDesk(deskId).catch(() => []),
    db.sharedDesks.listClassrooms(deskId).catch(() => []),
    db.sharedDesks.progress.listByDesk(deskId).catch(() => [])
  ]);

  const mappedSet = new Set((mappings || []).map(m => m.classroom_id));

  container.innerHTML = `
    <div class="animate-fade-in-up" style="max-width:1100px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" id="back-shared-desks">← Back</button>

      <div class="page-header mt-4 mb-6">
        <div class="flex-between gap-4">
          <div>
            <h1 class="text-3xl font-bold">${escapeHtml(desk?.title || 'Shared Desk')}</h1>
            <p class="text-muted">${escapeHtml(desk?.description || '')}</p>
          </div>
          <button class="btn btn-primary" id="new-topic-btn">+ New Topic</button>
        </div>
      </div>

      <div class="grid grid-2-1 gap-8">
        <div class="card p-6">
          <h3 class="font-bold mb-4">Topics</h3>
          ${topics.length === 0 ? `<div class="text-sm text-muted italic">No topics yet.</div>` : `
            <div class="space-y-2">
              ${topics.map(t => `
                <div class="p-4 bg-gray-50 rounded-xl flex-between gap-3">
                  <div>
                    <div class="font-bold text-sm">${escapeHtml(t.title)}</div>
                    <div class="text-xxs text-muted">Order ${t.order_index}</div>
                  </div>
                  <button class="btn btn-secondary btn-xs manage-topic-btn" data-id="${t.id}">Manage</button>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <div class="card p-6">
          <h3 class="font-bold mb-4">Shared to classrooms</h3>
          <div class="space-y-2 max-h-80 overflow-auto">
            ${classes.map(c => `
              <label class="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                <div>
                  <div class="font-bold text-xs">${escapeHtml(c.title)}</div>
                  <div class="text-xxs text-muted">Band ${c.level_band_min}-${c.level_band_max}</div>
                </div>
                <input type="checkbox" class="map-classroom" value="${c.id}" ${mappedSet.has(c.id) ? 'checked' : ''} />
              </label>
            `).join('')}
          </div>
          <div class="flex justify-end mt-4">
            <button class="btn btn-primary btn-sm" id="save-mappings-btn">Save Sharing</button>
          </div>
        </div>
      </div>

      <div class="card p-6 mt-8">
        <div class="flex-between mb-4">
          <h3 class="font-bold">Progress Overview</h3>
          <span class="text-xxs text-muted">Done is recorded when student presses Done on last card.</span>
        </div>
        ${(!progress || progress.length === 0) ? `
          <div class="text-sm text-muted italic">No progress yet.</div>
        ` : `
          <div class="grid grid-3 gap-3">
            ${progress.slice(0, 12).map(p => `
              <div class="p-4 bg-gray-50 rounded-xl">
                <div class="text-xxs font-black text-blue-500 uppercase tracking-widest mb-1">Topic</div>
                <div class="font-bold text-sm">${escapeHtml(p.topic?.title || p.topic_id)}</div>
                <div class="mt-3 flex-between">
                  <span class="badge ${p.done_at ? 'badge-green' : 'badge-yellow'} text-xxs">${p.done_at ? 'Done' : 'Not done'}</span>
                  <span class="text-xxs text-muted">${p.done_at ? new Date(p.done_at).toLocaleDateString() : ''}</span>
                </div>
              </div>
            `).join('')}
          </div>
          ${progress.length > 12 ? `<div class="text-xxs text-muted mt-4 italic">Showing latest 12 progress records.</div>` : ''}
        `}
      </div>
    </div>
  `;

  document.getElementById('back-shared-desks')?.addEventListener('click', () => renderSharedDeskManager(container));

  document.getElementById('save-mappings-btn')?.addEventListener('click', async () => {
    const ids = [...document.querySelectorAll('.map-classroom:checked')].map(x => x.value);
    try {
      await db.sharedDesks.setClassrooms(deskId, ids);
      showToast('Sharing updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('new-topic-btn')?.addEventListener('click', () => {
    const modal = showModal('Create Topic', `
      <form id="create-topic-form" class="space-y-4">
        <div class="input-group">
          <label class="form-label">Title *</label>
          <input class="input" id="topic-title" placeholder="e.g. Environment vocabulary" required autofocus />
        </div>
        <div class="input-group">
          <label class="form-label">Order</label>
          <input class="input" id="topic-order" type="number" value="0" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" id="topic-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Create</button>
        </div>
      </form>
    `);

    document.getElementById('topic-cancel')?.addEventListener('click', () => modal.close());
    document.getElementById('create-topic-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('topic-title')?.value?.trim();
      const order = parseInt(document.getElementById('topic-order')?.value || '0', 10);
      if (!title) return;
      try {
        await db.sharedDesks.topics.create({ desk_id: deskId, title, order_index: Number.isFinite(order) ? order : 0 });
        showToast('Topic created', 'success');
        modal.close();
        renderDeskDetail(container, deskId, user, classes);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('.manage-topic-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await renderTopicDetail(container, deskId, btn.dataset.id, user, classes);
    });
  });
}

async function renderTopicDetail(container, deskId, topicId, user, classes) {
  container.innerHTML = `<div class="p-12 text-center"><div class="spinner"></div></div>`;
  const [topic, items] = await Promise.all([
    db.sharedDesks.topics.get(topicId),
    db.sharedDesks.items.listByTopic(topicId).catch(() => [])
  ]);

  container.innerHTML = `
    <div class="animate-fade-in-up" style="max-width:1100px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" id="back-desk-detail">← Back to Desk</button>
      <div class="page-header mt-4 mb-6">
        <div class="flex-between gap-4">
          <div>
            <h1 class="text-2xl font-bold">🧩 ${escapeHtml(topic?.title || 'Topic')}</h1>
            <p class="text-muted">Add cards. Students will mark “Done” when they reach the last card.</p>
          </div>
          <button class="btn btn-primary" id="add-card-btn">+ Add Card</button>
        </div>
      </div>

      <div class="card p-6">
        ${items.length === 0 ? `<div class="text-sm text-muted italic">No cards yet.</div>` : `
          <div class="space-y-3">
            ${items.map((it, idx) => `
              <div class="p-4 bg-gray-50 rounded-xl">
                <div class="flex-between mb-2">
                  <div class="text-xxs font-black text-blue-500 uppercase tracking-widest">Card ${idx + 1}</div>
                  <button class="btn btn-ghost btn-xs text-red-500 delete-card-btn" data-id="${it.id}">Delete</button>
                </div>
                <div class="font-bold text-sm">${escapeHtml(it.payload?.front || 'Front')}</div>
                <div class="text-xs text-muted mt-1">${escapeHtml(it.payload?.back || '')}</div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    </div>
  `;

  document.getElementById('back-desk-detail')?.addEventListener('click', () => renderDeskDetail(container, deskId, user, classes));

  document.getElementById('add-card-btn')?.addEventListener('click', () => {
    const modal = showModal('Add Card', `
      <form id="add-card-form" class="space-y-4">
        <div class="input-group">
          <label class="form-label">Front *</label>
          <input class="input" id="card-front" placeholder="Prompt / term" required autofocus />
        </div>
        <div class="input-group">
          <label class="form-label">Back</label>
          <textarea class="input w-full p-4 h-24" id="card-back" placeholder="Explanation / meaning"></textarea>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" id="card-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary">Add</button>
        </div>
      </form>
    `);

    document.getElementById('card-cancel')?.addEventListener('click', () => modal.close());
    document.getElementById('add-card-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const front = document.getElementById('card-front')?.value?.trim();
      const back = document.getElementById('card-back')?.value?.trim();
      if (!front) return;
      try {
        await db.sharedDesks.items.create({
          topic_id: topicId,
          item_type: 'card',
          payload: { front, back }
        });
        showToast('Card added', 'success');
        modal.close();
        renderTopicDetail(container, deskId, topicId, user, classes);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  container.querySelectorAll('.delete-card-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this card?')) return;
      try {
        await db.sharedDesks.items.delete(btn.dataset.id);
        showToast('Card deleted', 'success');
        renderTopicDetail(container, deskId, topicId, user, classes);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

