/* ============================================
   LexiLearn — Modal Component
   ============================================ */

export function showModal(title, contentHtml, { onClose, width } = {}) {
  const root = document.getElementById('modal-root');
  if (!root) return;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-content" style="${width ? `max-width:${width}px` : ''}">
      <div class="modal-header">
        <h2>${title}</h2>
        <button class="modal-close" id="modal-close-btn">✕</button>
      </div>
      <div class="modal-body">${contentHtml}</div>
    </div>
  `;

  const close = () => {
    backdrop.remove();
    if (onClose) onClose();
  };

  backdrop.querySelector('#modal-close-btn').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  root.appendChild(backdrop);

  return { close, element: backdrop };
}

export function closeAllModals() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}
