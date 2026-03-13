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
