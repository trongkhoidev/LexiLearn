import { db, getCurrentUser, signOut } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { renderIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/helpers.js';

export async function renderTopRightBar() {
  let host = document.getElementById('top-right-bar');
  if (!host) {
    host = document.createElement('div');
    host.id = 'top-right-bar';
    document.body.appendChild(host);
  }

  const user = getCurrentUser();
  if (!user) {
    host.innerHTML = '';
    return;
  }

  // Try to display classroom context (student: first active classroom)
  let subtitle = user.role?.toUpperCase?.() || '';
  try {
    if (user.role === 'student') {
      const memberships = await db.classrooms.listForStudent(user.id).catch(() => []);
      const first = memberships?.[0]?.classrooms;
      if (first?.title) subtitle = escapeHtml(first.title);
    } else if (user.role === 'teacher') {
      const classes = await db.classrooms.listByTeacher(user.id).catch(() => []);
      subtitle = classes.length > 0 ? `${classes.length} classes` : 'TEACHER';
    }
  } catch {}

  host.innerHTML = `
    <div class="trb">
      <div class="trb-notif" id="trb-notif">
        <button class="trb-icon-btn" id="trb-notif-btn" aria-label="Notifications">
          ${renderIcon('notification', 20)}
          <span class="trb-badge hidden" id="trb-notif-badge">0</span>
        </button>
        <div class="trb-dropdown" id="trb-notif-dropdown">
          <div class="trb-dd-header">
            <span class="trb-dd-title">Notifications</span>
            <button class="trb-dd-action" id="trb-mark-all">Mark all read</button>
          </div>
          <div class="trb-dd-list" id="trb-notif-list">
            <div class="trb-dd-empty">No notifications</div>
          </div>
        </div>
      </div>

      <div class="trb-user" id="trb-user">
        <button class="trb-user-btn" id="trb-user-btn" aria-label="User menu">
          <div class="trb-avatar">${escapeHtml((user.full_name || 'U').trim().slice(0, 1).toUpperCase())}</div>
          <div class="trb-user-meta">
            <div class="trb-user-name">${escapeHtml(user.full_name || 'User')}</div>
            <div class="trb-user-sub">${subtitle}</div>
          </div>
        </button>
        <div class="trb-dropdown" id="trb-user-dropdown">
          <button class="trb-dd-item" id="trb-profile">Profile</button>
          <button class="trb-dd-item" id="trb-logout">Log out</button>
        </div>
      </div>
    </div>
  `;

  const notifBtn = host.querySelector('#trb-notif-btn');
  const notifDropdown = host.querySelector('#trb-notif-dropdown');
  const notifBadge = host.querySelector('#trb-notif-badge');
  const notifList = host.querySelector('#trb-notif-list');
  const markAll = host.querySelector('#trb-mark-all');

  const userBtn = host.querySelector('#trb-user-btn');
  const userDropdown = host.querySelector('#trb-user-dropdown');

  const closeAll = () => {
    notifDropdown?.classList.remove('open');
    userDropdown?.classList.remove('open');
  };

  document.addEventListener('click', closeAll, { capture: true });
  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown?.classList.remove('open');
    notifDropdown?.classList.toggle('open');
  });
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown?.classList.remove('open');
    userDropdown?.classList.toggle('open');
  });

  host.querySelector('#trb-profile')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeAll();
    navigateTo('/settings');
  });
  host.querySelector('#trb-logout')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    closeAll();
    await signOut();
    navigateTo('/dashboard');
    window.location.reload();
  });

  const refreshNotifs = async () => {
    try {
      const notifs = await db.notifications.listForUser(user.id).catch(() => []);
      const unread = (notifs || []).filter(n => !n.read_at);
      if (unread.length > 0) {
        notifBadge.textContent = unread.length;
        notifBadge.classList.remove('hidden');
      } else {
        notifBadge.classList.add('hidden');
      }

      if (!notifs || notifs.length === 0) {
        notifList.innerHTML = `<div class="trb-dd-empty">No notifications</div>`;
        return;
      }

      notifList.innerHTML = notifs.slice(0, 20).map(n => `
        <div class="trb-dd-row ${!n.read_at ? 'unread' : ''}" data-id="${n.id}">
          <div class="trb-dd-row-title">${escapeHtml(n.title || '')}</div>
          <div class="trb-dd-row-body">${escapeHtml(n.body || '')}</div>
          <div class="trb-dd-row-time">${new Date(n.created_at).toLocaleString()}</div>
        </div>
      `).join('');

      notifList.querySelectorAll('.trb-dd-row').forEach(row => {
        row.addEventListener('click', async (e) => {
          e.stopPropagation();
          const id = row.dataset.id;
          if (row.classList.contains('unread')) {
            await db.notifications.markRead(id);
            row.classList.remove('unread');
            refreshNotifs();
          }
        });
      });
    } catch {}
  };

  markAll?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      const notifs = await db.notifications.listForUser(user.id).catch(() => []);
      const unread = (notifs || []).filter(n => !n.read_at);
      await Promise.all(unread.map(n => db.notifications.markRead(n.id)));
      refreshNotifs();
    } catch {}
  });

  refreshNotifs();
}

