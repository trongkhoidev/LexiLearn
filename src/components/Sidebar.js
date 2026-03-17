/* ============================================
   LexiLearn — Sidebar Component
   ============================================ */

import { navigateTo, getCurrentRoute } from '../router.js';
import { db, getCurrentUser } from '../utils/supabase.js';

const NAV_ITEMS = [
  { label: 'HOME', items: [
    { icon: '🏠', text: 'Dashboard', route: '/dashboard' },
  ]},
  { label: 'TEACHER', role: 'teacher', items: [
    { icon: '🏫', text: 'Classrooms', route: '/classes' },
    { icon: '📂', text: 'Materials', route: '/materials' },
    { icon: '⚖️', text: 'Grading Hub', route: '/grading-hub' },
  ]},
  { label: 'MY LEARNING', role: 'student', items: [
    { icon: '📝', text: 'My Assignments', route: '/my-assignments' },
    { icon: '🖥️', text: 'Personal Desk', route: '/personal-desk' },
  ]},
  { label: 'STUDY', items: [
    { icon: '📚', text: 'My Decks', route: '/decks' },
    { icon: '📖', text: 'Quick Review', route: '/search' },
    { icon: '📄', text: 'Reading Practice', route: '/reading' },
    { icon: '🎯', text: 'Cambridge Tests', route: '/cambridge' },
  ]},
];

export async function renderSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const current = getCurrentRoute();
  
  // Initial render with loading or just base structure
  renderBase(sidebar, current, 0);

  try {
    const words = await db.words.list();
    const now = new Date();
    const dueCount = words.filter(w => !w.next_review || new Date(w.next_review) <= now).length;
    renderBase(sidebar, current, dueCount);
  } catch (err) {
    console.error('Sidebar error:', err);
  }
}

function renderBase(sidebar, current, dueCount) {
  sidebar.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-logo">L</div>
      <span class="sidebar-brand">LexiLearn</span>
    </div>
    <nav class="sidebar-nav">
      ${NAV_ITEMS
        .filter(section => !section.role || getCurrentUser()?.role === section.role)
        .map(section => `
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
      <div class="flex items-center justify-between" style="position:relative;">
        <div class="notification-bell" id="notif-bell">
          🔔
          <span class="notification-badge hidden" id="notif-badge">0</span>
          <div class="notification-dropdown" id="notif-dropdown">
            <div class="notification-header">
               <span>Notifications</span>
               <button class="text-xxs font-bold text-blue-500 hover:underline" id="mark-all-read-btn">Mark all read</button>
            </div>
            <div class="notification-list" id="notif-list">
              <div class="p-8 text-center text-xs text-muted">No new notifications</div>
            </div>
          </div>
        </div>
        <div class="text-right">
          <div style="font-weight:600;color:var(--color-text-primary);">${getCurrentUser()?.full_name || 'User'}</div>
          <div style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.05em;">${getCurrentUser()?.role || ''}</div>
        </div>
      </div>
      <div class="mt-4 pt-4 border-t border-gray-100 italic" style="font-size:0.6rem;">
        LexiLearn v1.0 — Learn Smart 🧠
      </div>
    </div>
  `;

  // Attach notification logic
  const bell = sidebar.querySelector('#notif-bell');
  const dropdown = sidebar.querySelector('#notif-dropdown');
  const badge = sidebar.querySelector('#notif-badge');
  const markAllBtn = sidebar.querySelector('#mark-all-read-btn');
  const user = getCurrentUser();

  if (user) {
    const refreshNotifs = async () => {
      try {
        const notifs = await db.notifications.listForUser(user.id);
        const unread = notifs.filter(n => !n.read_at);
        
        if (unread.length > 0) {
          badge.textContent = unread.length;
          badge.classList.remove('hidden');
        } else {
          badge.classList.add('hidden');
        }
        
        const list = sidebar.querySelector('#notif-list');
        if (notifs.length > 0) {
          list.innerHTML = notifs.map(n => `
            <div class="notification-item ${!n.read_at ? 'unread' : ''}" data-id="${n.id}">
              <div class="notification-item-title">${n.title}</div>
              <div class="notification-item-text">${n.body || ''}</div>
              <div class="notification-item-time">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          `).join('');

          list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', async (e) => {
               e.stopPropagation();
               const id = item.dataset.id;
               
               if (!item.classList.contains('unread')) {
                  return;
               }

               await db.notifications.markRead(id);
               item.classList.remove('unread');
               refreshNotifs(); // update badge
            });
          });
        }
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    };

    refreshNotifs();

    markAllBtn?.addEventListener('click', async (e) => {
       e.stopPropagation();
       try {
         const notifs = await db.notifications.listForUser(user.id);
         const unread = notifs.filter(n => !n.read_at);
         await Promise.all(unread.map(n => db.notifications.markRead(n.id)));
         refreshNotifs();
       } catch (err) {
         console.error('Mark all read failed:', err);
       }
    });
  }

  bell?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', () => dropdown?.classList.remove('open'));

  // Mobile header logic
  setupMobileHeader();

  // Attach listeners
  sidebar.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const route = link.getAttribute('data-route');
      navigateTo(route);
      sidebar.classList.remove('open');
      document.querySelector('.sidebar-overlay')?.classList.remove('visible');
    });
  });
}

function setupMobileHeader() {
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

  document.getElementById('hamburger-btn')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    overlay.classList.toggle('visible');
  });

  overlay.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    overlay.classList.remove('visible');
  });
}
