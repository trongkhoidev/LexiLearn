/* ============================================
   LexiLearn — Settings Page
   ============================================
   Manage profile + API keys and preferences.
*/

import { db, getCurrentUser } from '../utils/supabase.js';
import { showToast } from '../components/Toast.js';
import { escapeHtml } from '../utils/helpers.js';

export function renderSettings(container) {
  const settings = loadSettings();
  const user = getCurrentUser();

  container.innerHTML = `
    <div class="animate-fade-in-up" style="max-width:720px;margin:0 auto;">
      <div class="page-header" style="margin-bottom:var(--space-8);">
        <h1 style="font-size:1.75rem;font-weight:700;">👤 Profile</h1>
        <p class="text-muted" style="max-width:560px;">
          View and update your account details, classrooms, and learning progress. You can also set an optional Gemini API key override for AI features.
        </p>
      </div>

      ${user ? `
        <div class="card" style="padding:var(--space-6);margin-bottom:var(--space-6);">
          <h2 style="font-size:1.1rem;font-weight:600;margin-bottom:var(--space-4);">Profile</h2>
          <div class="grid grid-2 gap-4">
            <div class="input-group">
              <label class="form-label">Full name</label>
              <input id="profile-full-name" class="input" value="${escapeHtml(user.full_name || '')}" placeholder="Your name" />
            </div>
            <div class="input-group">
              <label class="form-label">Email</label>
              <input class="input" value="${escapeHtml(user.email || '')}" disabled />
            </div>
          </div>
          <div class="flex items-center gap-3" style="margin-top:var(--space-4);">
            <button class="btn btn-primary" id="save-profile-btn">Save Profile</button>
          </div>
          <div class="text-xxs text-muted mt-2">Profile changes are saved to the database (profiles table).</div>
        </div>

        <div class="card" style="padding:var(--space-6);margin-bottom:var(--space-6);">
          <div class="flex-between mb-4">
            <h2 style="font-size:1.1rem;font-weight:600;">My Learning</h2>
            <span class="badge badge-outline text-xxs">${escapeHtml(user.role || '')}</span>
          </div>
          <div id="profile-stats" class="grid grid-3 gap-4">
            <div class="p-4 bg-gray-50 rounded-xl">
              <div class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Classrooms</div>
              <div class="text-2xl font-black" id="stat-classes">–</div>
            </div>
            <div class="p-4 bg-gray-50 rounded-xl">
              <div class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Submissions</div>
              <div class="text-2xl font-black" id="stat-submissions">–</div>
            </div>
            <div class="p-4 bg-gray-50 rounded-xl">
              <div class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Topics done</div>
              <div class="text-2xl font-black" id="stat-topics-done">–</div>
            </div>
          </div>
          <div class="mt-5">
            <div class="font-bold mb-2">My Classrooms</div>
            <div id="profile-class-list" class="space-y-2 text-sm text-muted">Loading…</div>
          </div>
        </div>
      ` : `
        <div class="card" style="padding:var(--space-6);margin-bottom:var(--space-6);">
          <div class="text-sm text-muted">Sign in to edit your profile settings.</div>
        </div>
      `}

      <div class="card" style="padding:var(--space-6);margin-bottom:var(--space-6);">
        <h2 style="font-size:1.1rem;font-weight:600;margin-bottom:var(--space-2);">🤖 AI Provider Keys</h2>
        <p class="text-xs text-muted" style="margin-bottom:var(--space-4);">
          Keys are stored in your browser only. Add keys to unlock faster and smarter AI features.
        </p>

        <div style="display:grid;gap:var(--space-4);">
          <div class="input-group">
            <label class="form-label" for="groq-key-input">
              <strong>Groq</strong> <span class="text-xxs text-muted">(Vocab, Tooltips, Exercises — Speed)</span>
            </label>
            <input id="groq-key-input" type="password" class="input"
              placeholder="gsk_..." value="${settings.groqApiKey ? maskKey(settings.groqApiKey) : ''}" />
            <a href="https://console.groq.com/keys" target="_blank" class="text-xxs text-accent underline mt-1">Get free Groq key</a>
          </div>

          <div class="input-group">
            <label class="form-label" for="deepseek-key-input">
              <strong>DeepSeek</strong> <span class="text-xxs text-muted">(Writing & Speaking Grading — Reasoning)</span>
            </label>
            <input id="deepseek-key-input" type="password" class="input"
              placeholder="sk-..." value="${settings.deepseekApiKey ? maskKey(settings.deepseekApiKey) : ''}" />
            <a href="https://platform.deepseek.com/api_keys" target="_blank" class="text-xxs text-accent underline mt-1">Get free DeepSeek key</a>
          </div>

          <div class="input-group">
            <label class="form-label" for="gemini-key-input">
              <strong>Gemini</strong> <span class="text-xxs text-muted">(Cambridge PDF Parsing — Vision &amp; Fallback)</span>
            </label>
            <input id="gemini-key-input" type="password" class="input"
              placeholder="AIzaSy..." value="${settings.geminiApiKey ? maskKey(settings.geminiApiKey) : ''}" />
            <a href="https://ai.google.dev/gemini-api/docs/api-key?hl=vi" target="_blank" class="text-xxs text-accent underline mt-1">Get free Gemini key</a>
          </div>
        </div>

        <div class="flex items-center gap-3" style="margin-top:var(--space-4);">
          <button class="btn btn-primary" id="save-settings-btn">Save All Keys</button>
          <button class="btn btn-ghost" id="clear-key-btn">Remove All</button>
        </div>

        <div class="mt-4 text-sm text-muted">
          <strong>Tip:</strong> Groq handles speed-critical tasks (tooltips, vocab). DeepSeek handles deep grading. 
          Gemini is used as fallback and for PDF vision tasks.
        </div>
      </div>
    </div>
  `;

  document.getElementById('save-settings-btn')?.addEventListener('click', () => {
    const resolveKey = (inputId, settingsKey) => {
      const input = document.getElementById(inputId);
      const raw = input?.value?.trim() || '';
      return raw === maskKey(raw) ? settings[settingsKey] : (raw || null);
    };

    const groqVal = resolveKey('groq-key-input', 'groqApiKey');
    const deepseekVal = resolveKey('deepseek-key-input', 'deepseekApiKey');
    const geminiVal = resolveKey('gemini-key-input', 'geminiApiKey');

    const next = { ...settings, groqApiKey: groqVal, deepseekApiKey: deepseekVal, geminiApiKey: geminiVal };
    saveSettings(next);

    // Sync direct keys for services
    const syncKey = (name, val) => val ? localStorage.setItem(name, val) : localStorage.removeItem(name);
    syncKey('lexilearn_groq_key', groqVal);
    syncKey('lexilearn_deepseek_key', deepseekVal);
    syncKey('lexilearn_gemini_key', geminiVal);

    // Update input displays
    const groqInput = document.getElementById('groq-key-input');
    const deepseekInput = document.getElementById('deepseek-key-input');
    const geminiInput = document.getElementById('gemini-key-input');
    if (groqInput) groqInput.value = groqVal ? maskKey(groqVal) : '';
    if (deepseekInput) deepseekInput.value = deepseekVal ? maskKey(deepseekVal) : '';
    if (geminiInput) geminiInput.value = geminiVal ? maskKey(geminiVal) : '';

    showToast('All API keys saved successfully!', 'success');
  });

  document.getElementById('clear-key-btn')?.addEventListener('click', () => {
    if (!confirm('Remove ALL API keys from this browser?')) return;
    const next = { ...settings, groqApiKey: null, deepseekApiKey: null, geminiApiKey: null };
    saveSettings(next);
    localStorage.removeItem('lexilearn_groq_key');
    localStorage.removeItem('lexilearn_deepseek_key');
    localStorage.removeItem('lexilearn_gemini_key');
    ['groq-key-input', 'deepseek-key-input', 'gemini-key-input'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    showToast('All API keys removed. Falling back to demo mode.', 'info');
  });

  document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    if (!user) return;
    const fullName = document.getElementById('profile-full-name')?.value?.trim();
    if (!fullName) return showToast('Full name is required', 'error');
    try {
      await db.profiles.update(user.id, { full_name: fullName });
      const nextUser = { ...user, full_name: fullName };
      localStorage.setItem('lexilearn_user', JSON.stringify(nextUser));
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Load richer profile context (non-blocking)
  if (user) {
    loadProfileContext(user);
  }
}

async function loadProfileContext(user) {
  try {
    let classrooms = [];
    if (user.role === 'student') {
      const memberships = await db.classrooms.listForStudent(user.id).catch(() => []);
      classrooms = memberships.map(m => m.classrooms).filter(Boolean);
    } else if (user.role === 'teacher') {
      classrooms = await db.classrooms.listByTeacher(user.id).catch(() => []);
    }

    const submissions = user.role === 'student'
      ? await db.submissions.listByStudent(user.id).catch(() => [])
      : [];

    const topicProgress = user.role === 'student'
      ? await db.sharedDesks?.progress?.listByStudent?.(user.id).catch(() => [])
      : [];

    const doneCount = (topicProgress || []).filter(p => p.done_at).length;

    document.getElementById('stat-classes')?.replaceChildren(document.createTextNode(String(classrooms.length)));
    document.getElementById('stat-submissions')?.replaceChildren(document.createTextNode(String(submissions.length)));
    document.getElementById('stat-topics-done')?.replaceChildren(document.createTextNode(String(doneCount)));

    const list = document.getElementById('profile-class-list');
    if (list) {
      if (classrooms.length === 0) {
        list.innerHTML = `<div class="text-sm text-muted italic">No classrooms yet.</div>`;
      } else {
        list.innerHTML = classrooms.slice(0, 12).map(c => `
          <div class="p-3 bg-gray-50 rounded-xl flex-between">
            <div>
              <div class="font-bold text-sm">${escapeHtml(c.title || 'Classroom')}</div>
              ${c.level_band_min !== undefined ? `<div class="text-xxs text-muted">Band ${c.level_band_min}-${c.level_band_max}</div>` : ''}
            </div>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    // fail silently; settings page should still work
  }
}

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem('lexilearn_settings') || '{}');
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem('lexilearn_settings', JSON.stringify(settings));
  } catch {
    // ignore quota errors
  }
}

function maskKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 4)}****${key.slice(-4)}`;
}

