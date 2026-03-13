/* ============================================
   LexiLearn — Sidebar Component
   ============================================ */

import { navigateTo, getCurrentRoute } from '../router.js';
import { getDueWords } from '../data/srs.js';

const NAV_ITEMS = [
  { label: 'HOME', items: [
    { icon: '🏠', text: 'Dashboard', route: '/dashboard' },
  ]},
  { label: 'STUDY', items: [
    { icon: '📚', text: 'My Decks', route: '/decks' },
    { icon: '📖', text: 'Quick Review', route: '/search' },
    { icon: '✨', text: 'AI Flashcard', route: '/ai-flashcard' },
  ]},
  { label: 'MANAGE', items: [
    { icon: '➕', text: 'Add Word', route: '/add-word' },
  ]},
  { label: 'INSIGHTS', items: [
    { icon: '📊', text: 'Statistics', route: '/stats' },
  ]},
];

export function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const dueCount = getDueWords().length;
  const current = getCurrentRoute();

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">L</div>
      <span class="sidebar-brand">LexiLearn</span>
    </div>
    <nav class="sidebar-nav">
      ${NAV_ITEMS.map(section => `
        <div class="nav-section-label">${section.label}</div>
        ${section.items.map(item => `
          <a class="nav-link ${current === item.route ? 'active' : ''}"
             data-route="${item.route}" href="#${item.route}">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.text}</span>
            ${item.route === '/dashboard' && dueCount > 0 ? `<span class="badge badge-accent" style="margin-left:auto">${dueCount}</span>` : ''}
          </a>
        `).join('')}
      `).join('')}
    </nav>
    <div class="sidebar-footer">
      LexiLearn v1.0 — Learn Smart 🧠
    </div>
  `;

  // Mobile header
  let mobileHeader = document.querySelector('.mobile-header');
  if (!mobileHeader) {
    mobileHeader = document.createElement('div');
    mobileHeader.className = 'mobile-header';
    mobileHeader.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="sidebar-logo" style="width:32px;height:32px;font-size:0.9rem;">L</div>
        <span class="sidebar-brand" style="font-size:1rem;">LexiLearn</span>
      </div>
      <button class="hamburger" id="hamburger-btn">☰</button>
    `;
    document.body.appendChild(mobileHeader);
  }

  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  // Event listeners
  sidebar.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.getAttribute('data-route');
      navigateTo(route);
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  });

  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('visible');
  });

  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
  });
}
