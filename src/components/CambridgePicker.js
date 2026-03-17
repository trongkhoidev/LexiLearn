import { db } from '../utils/supabase.js';
import { escapeHtml } from '../utils/helpers.js';

/**
 * CambridgePicker component
 * Renders an overlay for selecting a book, test, or section from the Cambridge library.
 */
export async function openCambridgePicker(container, onSelect) {
  let books = [];
  let viewState = { book: null, test: null }; // home -> book -> test

  const overlay = document.createElement('div');
  overlay.className = 'fixed-overlay flex items-center justify-center';
  overlay.style.zIndex = '1000';
  overlay.innerHTML = `
    <div class="card animate-fade-in-up" style="width:90%; max-width:800px; max-height:80vh; overflow:hidden; display:flex; flex-direction:column; padding:0; border:none; box-shadow:var(--shadow-xl);">
      <div class="modal-header flex items-center justify-between p-6 border-b" style="background:#f9fafb;">
        <div>
          <h2 class="font-bold text-lg" id="picker-title">Select Cambridge Material</h2>
          <div id="picker-breadcrumbs" class="text-xs text-muted mt-1"></div>
        </div>
        <button class="btn btn-ghost btn-sm" id="close-picker-btn" style="font-size:1.5rem; line-height:1;">&times;</button>
      </div>
      <div id="picker-content" class="p-6 overflow-auto bg-white" style="flex:1;">
        <div class="flex items-center justify-center p-12">
          <div class="spinner"></div>
        </div>
      </div>
      <div class="modal-footer p-4 border-t bg-gray-50 flex justify-end gap-3">
        <button class="btn btn-secondary btn-sm" id="cancel-picker-btn">Cancel</button>
      </div>
    </div>
  `;

  container.appendChild(overlay);

  const close = () => {
    overlay.classList.add('animate-fade-out');
    setTimeout(() => container.removeChild(overlay), 200);
  };

  overlay.querySelector('#close-picker-btn').addEventListener('click', close);
  overlay.querySelector('#cancel-picker-btn').addEventListener('click', close);

  const fetchBooks = async () => {
    try {
      books = await db.books.list();
      render();
    } catch (err) {
      overlay.querySelector('#picker-content').innerHTML = `<p class="text-red-500 p-4">Error loading books: ${err.message}</p>`;
    }
  };

  const render = () => {
    const content = overlay.querySelector('#picker-content');
    const title = overlay.querySelector('#picker-title');
    const breadcrumbs = overlay.querySelector('#picker-breadcrumbs');

    // Breadcrumbs
    let bcHtml = `<span class="picker-bc-link cursor-pointer hover:underline" data-view="home">All Books</span>`;
    if (viewState.book) bcHtml += ` <span class="mx-1">/</span> <span class="picker-bc-link cursor-pointer hover:underline" data-view="book">${escapeHtml(viewState.book.title)}</span>`;
    breadcrumbs.innerHTML = bcHtml;

    breadcrumbs.querySelectorAll('.picker-bc-link').forEach(link => {
      link.addEventListener('click', () => {
        if (link.dataset.view === 'home') viewState = { book: null, test: null };
        else if (link.dataset.view === 'book') viewState.test = null;
        render();
      });
    });

    if (!viewState.book) {
      title.innerText = 'Select a Book';
      content.innerHTML = `
        <div class="grid grid-3 gap-4">
          ${books.map(b => `
            <div class="card card-interactive p-4 flex items-center gap-3 picker-book-card" data-id="${b.id}">
              <div class="w-10 h-10 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold">${b.book_num || 'C'}</div>
              <div class="text-sm font-bold">${escapeHtml(b.title)}</div>
            </div>
          `).join('')}
        </div>
      `;
      content.querySelectorAll('.picker-book-card').forEach(card => {
        card.addEventListener('click', async () => {
          content.innerHTML = `<div class="flex items-center justify-center p-12"><div class="spinner"></div></div>`;
          const fullBook = await db.books.getTree(card.dataset.id);
          viewState.book = fullBook;
          render();
        });
      });
    } else if (!viewState.test) {
      title.innerText = `Tests in ${viewState.book.title}`;
      content.innerHTML = `
        <div class="grid grid-2 gap-4">
          ${(viewState.book.tests || []).map(t => `
            <div class="card p-4 picker-test-card" data-id="${t.id}">
              <h3 class="font-bold mb-3">${escapeHtml(t.title)}</h3>
              <div class="space-y-2">
                <button class="btn btn-primary btn-xs w-full assign-test-btn" data-tid="${t.id}" data-title="${escapeHtml(t.title)}">Assign Full Test</button>
                <div class="text-xxs text-muted text-center py-1">OR SELECT MODULE</div>
                <button class="btn btn-outline btn-xs w-full view-sections-btn" data-tid="${t.id}">Browse Sections →</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
      content.querySelectorAll('.assign-test-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          onSelect({ type: 'test', id: btn.dataset.tid, title: btn.dataset.title });
          close();
        });
      });
      content.querySelectorAll('.view-sections-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          content.innerHTML = `<div class="flex items-center justify-center p-12"><div class="spinner"></div></div>`;
          const test = await db.tests.get(btn.dataset.tid);
          viewState.test = test;
          render();
        });
      });
    } else {
      title.innerText = `Sections in ${viewState.test.title}`;
      content.innerHTML = `
        <div class="space-y-3">
          ${(viewState.test.passages || []).map(p => `
            <div class="card p-4 flex items-center justify-between">
              <div>
                <div class="font-bold">${escapeHtml(p.title)}</div>
                <div class="text-xxs text-muted">Module: ${p.module} · Section ${p.section_num}</div>
              </div>
              <button class="btn btn-primary btn-sm assign-section-btn" data-sid="${p.id}" data-title="${escapeHtml(viewState.test.title)} - ${escapeHtml(p.title)}">Assign Section</button>
            </div>
          `).join('')}
        </div>
      `;
      content.querySelectorAll('.assign-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          onSelect({ type: 'section', id: btn.dataset.sid, title: btn.dataset.title });
          close();
        });
      });
    }
  };

  fetchBooks();
}
