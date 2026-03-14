/* ============================================
   LexiLearn — Settings Page
   ============================================
   Manage API keys and advanced preferences.
*/

export function renderSettings(container) {
  const settings = loadSettings();

  container.innerHTML = `
    <div class="animate-fade-in-up" style="max-width:720px;margin:0 auto;">
      <div class="page-header" style="margin-bottom:var(--space-8);">
        <h1 style="font-size:1.75rem;font-weight:700;">⚙️ Settings</h1>
        <p class="text-muted" style="max-width:560px;">
          Manage your Gemini API key used for Cambridge test parsing, word lookups, and other AI features.
          If you frequently see messages like "AI is currently busy" or missing Vietnamese meanings, adding your own key will help avoid shared rate limits.
        </p>
      </div>

      <div class="card" style="padding:var(--space-6);margin-bottom:var(--space-6);">
        <h2 style="font-size:1.1rem;font-weight:600;margin-bottom:var(--space-4);">Gemini API Key</h2>
        <label class="form-label" for="gemini-key-input">API Key</label>
        <input
          id="gemini-key-input"
          type="password"
          class="input"
          placeholder="Paste your Gemini API key..."
          value="${settings.geminiApiKey ? maskKey(settings.geminiApiKey) : ''}"
        />
        <p class="text-xs text-muted" style="margin-top:var(--space-2);">
          Stored securely in your browser's localStorage only. This key is never sent to our servers.
        </p>

        <div class="flex items-center gap-3" style="margin-top:var(--space-4);">
          <button class="btn btn-primary" id="save-settings-btn">Save</button>
          <button class="btn btn-ghost" id="clear-key-btn">Remove Key</button>
        </div>

        <div class="mt-4 text-sm text-muted">
          <strong>Tip:</strong> If you hit rate limits (HTTP 429) during Cambridge parsing or word lookup,
          you will see a warning message suggesting you add your own key here.
        </div>
      </div>
    </div>
  `;

  document.getElementById('save-settings-btn')?.addEventListener('click', () => {
    const input = document.getElementById('gemini-key-input');
    const raw = input.value.trim();
    const value = raw === maskKey(raw) ? settings.geminiApiKey : raw;

    const next = { ...settings, geminiApiKey: value || null };
    saveSettings(next);
    input.value = value ? maskKey(value) : '';
    alert('Settings saved. AI features will now use your personal Gemini key.');
  });

  document.getElementById('clear-key-btn')?.addEventListener('click', () => {
    if (!confirm('Remove your Gemini API key from this browser?')) return;
    const next = { ...settings, geminiApiKey: null };
    saveSettings(next);
    const input = document.getElementById('gemini-key-input');
    if (input) input.value = '';
    alert('Gemini API key removed. The app will fall back to the shared/demo key (more likely to hit rate limits).');
  });
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

