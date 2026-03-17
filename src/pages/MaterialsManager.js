import { db, getCurrentUser } from '../utils/supabase.js';
import { showToast } from '../components/Toast.js';

export async function renderMaterialsManager(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'teacher') {
    container.innerHTML = `<div class="card p-12 text-center">Please log in as a teacher.</div>`;
    return;
  }

  let currentFolderId = null;
  let breadcrumbs = [];

  async function refresh() {
    container.innerHTML = `
      <div class="flex items-center justify-center p-12">
        <div class="spinner"></div>
      </div>
    `;

    try {
      const [folders, materials] = await Promise.all([
        currentFolderId ? db.materialFolders.listChildren(currentFolderId) : db.materialFolders.listRootForTeacher(user.id),
        currentFolderId ? db.materials.listByFolder(currentFolderId) : Promise.resolve([])
      ]);

      renderUI(folders, materials);
    } catch (err) {
      container.innerHTML = `<div class="card p-8 text-red-600">Error: ${err.message}</div>`;
    }
  }

  function renderUI(folders, materials) {
    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1040px;margin:0 auto;">
        <div class="page-header">
          <h1>📂 Material Manager</h1>
          <p>Organize your teaching resources into folders and shared materials.</p>
        </div>

        <nav class="flex items-center gap-2 mb-6 text-sm">
          <button class="breadcrumb-item" data-id="null">Root</button>
          ${breadcrumbs.map(b => `
            <span class="text-muted">/</span>
            <button class="breadcrumb-item" data-id="${b.id}">${b.name}</button>
          `).join('')}
        </nav>

        <div class="flex items-center justify-between mb-6">
          <div class="flex gap-2">
            <button class="btn btn-secondary btn-sm" id="new-folder-btn">+ New Folder</button>
            ${currentFolderId ? `<button class="btn btn-primary btn-sm" id="new-material-btn">+ Add Material</button>` : ''}
          </div>
        </div>

        <div class="grid grid-3 gap-4">
          <!-- Folders -->
          ${folders.map(f => `
            <div class="card card-interactive material-folder-card" data-id="${f.id}" data-name="${f.name}">
              <div class="flex items-center gap-3">
                <span class="text-2xl">📁</span>
                <div class="flex-1 truncate">
                  <h3 class="font-bold text-sm truncate">${f.name}</h3>
                  <p class="text-xxs text-muted">Folder</p>
                </div>
              </div>
            </div>
          `).join('')}

          <!-- Materials -->
          ${materials.map(m => `
            <div class="card card-interactive material-item-card" data-id="${m.id}">
              <div class="flex items-center gap-3">
                <span class="text-2xl">${m.attachment_type === 'link' ? '🔗' : '📄'}</span>
                <div class="flex-1 truncate">
                  <h3 class="font-bold text-sm truncate">${m.title}</h3>
                  <p class="text-xxs text-muted">${m.attachment_type} · ${new Date(m.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        ${folders.length === 0 && materials.length === 0 ? `
          <div class="py-12 text-center text-muted">
            <p>This folder is empty.</p>
          </div>
        ` : ''}
      </div>
    `;

    // Events
    container.querySelectorAll('.breadcrumb-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id === 'null' ? null : btn.dataset.id;
        if (id === currentFolderId) return;
        
        if (id === null) {
          currentFolderId = null;
          breadcrumbs = [];
        } else {
          const idx = breadcrumbs.findIndex(b => b.id === id);
          if (idx !== -1) {
            breadcrumbs = breadcrumbs.slice(0, idx + 1);
            currentFolderId = id;
          }
        }
        refresh();
      });
    });

    container.querySelectorAll('.material-folder-card').forEach(card => {
      card.addEventListener('click', () => {
        currentFolderId = card.dataset.id;
        breadcrumbs.push({ id: currentFolderId, name: card.dataset.name });
        refresh();
      });
    });

    container.querySelector('#new-folder-btn')?.addEventListener('click', async () => {
      const name = prompt('Folder name:');
      if (!name) return;

      try {
        await db.materialFolders.create({
          teacher_id: user.id,
          parent_id: currentFolderId,
          name
        });
        showToast('Folder created', 'success');
        refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    container.querySelector('#new-material-btn')?.addEventListener('click', async () => {
      const title = prompt('Material title:');
      if (!title) return;
      const url = prompt('URL or Content link:');
      if (!url) return;

      try {
        await db.materials.create({
          folder_id: currentFolderId,
          teacher_id: user.id,
          title,
          attachment_url: url,
          attachment_type: 'link',
          visibility_scope: 'classroom',
          skill: 'mixed'
        });
        showToast('Material added', 'success');
        refresh();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  refresh();
}
