/* ============================================
   LexiLearn — Helper Utilities
   ============================================ */

/**
 * Debounce a function.
 */
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Format a timestamp to a readable date string.
 */
export function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a timestamp to relative time (e.g. "2 days ago").
 */
export function timeAgo(ts) {
  if (!ts) return 'Never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ts);
}

/**
 * Create a DOM element with attributes and children.
 */
export function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);

  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') element.className = val;
    else if (key === 'innerHTML') element.innerHTML = val;
    else if (key.startsWith('on')) {
      element.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(element.style, val);
    } else if (key === 'dataset') {
      for (const [dk, dv] of Object.entries(val)) element.dataset[dk] = dv;
    } else {
      element.setAttribute(key, val);
    }
  }

  children.flat(Infinity).forEach(child => {
    if (child === null || child === undefined) return;
    if (typeof child === 'string' || typeof child === 'number') {
      element.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  });

  return element;
}

/**
 * Set innerHTML and return the container.
 */
export function html(container, htmlStr) {
  container.innerHTML = htmlStr;
  return container;
}

/**
 * Get a percentage, clamped 0–100.
 */
export function percent(part, total) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * Truncate text.
 */
export function truncate(text, maxLen = 60) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

/**
 * Escape HTML.
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Get today's date key (YYYY-MM-DD).
 */
export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Get last N days keys.
 */
export function lastNDaysKeys(n) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

/**
 * Short day name from date key.
 */
export function shortDay(dateKey) {
  return new Date(dateKey + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

/**
 * Render a skeleton loader.
 */
export function renderSkeleton(type = 'card', count = 1) {
  const items = Array(count).fill(0).map(() => {
    if (type === 'table') {
      return `
        <div class="flex items-center gap-4 p-4 border-b">
          <div class="skeleton skeleton-avatar"></div>
          <div class="flex-1">
            <div class="skeleton skeleton-text" style="width: 40%"></div>
            <div class="skeleton skeleton-text" style="width: 25%"></div>
          </div>
          <div class="skeleton" style="width: 60px; height: 24px;"></div>
        </div>
      `;
    }
    if (type === 'list') {
      return `
        <div class="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
          <div class="skeleton skeleton-avatar" style="width: 32px; height: 32px;"></div>
          <div class="flex-1">
            <div class="skeleton skeleton-text" style="width: 60%"></div>
          </div>
        </div>
      `;
    }
    // Default Card
    return `
      <div class="card p-6">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text" style="width: 60%"></div>
        <div class="mt-4 flex gap-2">
          <div class="skeleton" style="width: 80px; height: 32px;"></div>
          <div class="skeleton" style="width: 80px; height: 32px;"></div>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="animate-fade-in">${items}</div>`;
}

/**
 * Render a rich empty state.
 */
export function renderEmptyState({ icon = '📂', title = 'No data found', message = 'There is nothing to show here yet.', actionHtml = '' }) {
  return `
    <div class="empty-state animate-fade-in">
      <div class="empty-state-icon">${icon}</div>
      <h3 class="empty-state-title">${title}</h3>
      <p class="empty-state-text">${message}</p>
      ${actionHtml ? `<div class="mt-2">${actionHtml}</div>` : ''}
    </div>
  `;
}
