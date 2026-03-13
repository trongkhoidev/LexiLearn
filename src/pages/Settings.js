import { el } from '../utils/helpers.js';
import { getApiKey, saveApiKey } from '../data/store.js';
import { showToast } from '../components/Toast.js';

export function renderSettings(container) {
  const currentKey = getApiKey() || '';

  const content = el('div', { className: 'page-container' }, [
    el('div', { className: 'page-header' }, [
      el('h1', {}, '⚙️ Settings'),
      el('p', { className: 'text-muted' }, 'Configure your LexiLearn experience and AI integrations.'),
    ]),

    el('div', { className: 'card' }, [
      el('h2', {}, 'AI Integration (Gemini API)'),
      el('p', { className: 'text-sm text-muted' }, 'To use advanced AI features (like auto-generating flashcards from text or AI conversation roleplay), you need a free Google Gemini API key.'),
      el('p', { className: 'text-sm text-muted' }, [
        'Get your free key at: ',
        el('a', { className: 'text-primary', href: 'https://aistudio.google.com/app/apikey', target: '_blank' }, 'Google AI Studio')
      ]),
      el('div', { className: 'form-group' }, [
        el('label', {}, 'Gemini API Key'),
        el('input', {
          className: 'input',
          type: 'password',
          id: 'settings-api-key',
          placeholder: 'AIzaSy...',
          value: currentKey
        }),
        el('p', { className: 'text-xs text-muted mt-2' }, 'Your key is stored locally in your browser and is never sent to our servers.')
      ]),
      el('div', { className: 'flex gap-2 mt-4' }, [
        el('button', { className: 'btn btn-primary', id: 'settings-save-btn' }, 'Save Settings'),
        el('button', { className: 'btn btn-outline', id: 'settings-clear-btn' }, 'Clear Key')
      ])
    ])
  ]);

  container.innerHTML = '';
  container.appendChild(content);

  // Event Listeners
  const saveBtn = document.getElementById('settings-save-btn');
  const clearBtn = document.getElementById('settings-clear-btn');
  const keyInput = document.getElementById('settings-api-key');

  saveBtn.addEventListener('click', () => {
    const val = keyInput.value.trim();
    saveApiKey(val);
    showToast('Settings saved successfully.', 'success');
  });

  clearBtn.addEventListener('click', () => {
    keyInput.value = '';
    saveApiKey('');
    showToast('API key cleared.', 'info');
  });
}
