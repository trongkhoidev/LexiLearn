/* ============================================
   LexiLearn — Speaking Setup Component
   ============================================
*/

import { showToast } from '../../../components/Toast.js';
import { escapeHtml } from '../../../utils/helpers.js';
import { renderSpeakingMode } from './SpeakingMode.js';

const SPEAKING_API_KEYS = [
  { id: '1', name: 'Gemini Key 1', key: 'AIzaSyDnScRM-sf-ZxRpXqtezIe8tVGQqYR-nCI' },
  { id: '2', name: 'Gemini Key 2', key: 'AIzaSyAhPPPcszeepv0NnVh6lB5QBXarYS2JdwE' },
  { id: '3', name: 'Gemini Key 3', key: 'AIzaSyDv5yQ04GH5gqZqIjYGUoSHuHBn-i5O-0M' },
  { id: '4', name: 'Gemini Key 4', key: 'AIzaSyDoTi1ezvmMPjl-XgIHviaRxcPUtFsNct4' },
  { id: '5', name: 'Gemini Key 5', key: 'AIzaSyA-85K3L3BiJjpcu4Siu-xxQT0-dYXKBO8' }
];

export function renderSpeakingSetup(container, { cards, deckSlug }) {
  const storageKey = `lexilearn_speaking_qs_${deckSlug}`;
  let currentQs = [""];
  
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved) && saved.length > 0) currentQs = saved;
  } catch(e) {}

  container.innerHTML = `
    <div class="animate-fade-in-up study-container max-w-2xl mx-auto py-8">
      <div class="flex-between mb-8">
        <button class="btn btn-ghost btn-sm text-muted font-bold" id="exit-setup">← Change Mode</button>
        <div class="badge badge-purple text-xxs font-black tracking-widest uppercase">Mock Interview</div>
      </div>

      <div class="card p-10 mb-8 border-none shadow-premium relative overflow-hidden bg-white">
         <h1 class="text-3xl font-black text-gray-900 mb-2">Speaking Setup</h1>
         <p class="text-muted text-sm mb-8">Enter questions you want to practice. Our AI Examiner will evaluate your fluency and vocabulary.</p>

         <div class="space-y-6">
            <div>
               <div class="flex-between mb-4">
                  <label class="text-xxs font-black text-muted uppercase tracking-widest">Question List</label>
                  <button id="add-q" class="btn btn-ghost btn-xs text-pink-600 font-bold">+ New Question</button>
               </div>
               <div id="qs-list" class="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar"></div>
            </div>

            <div class="divider"></div>

            <div>
               <label class="text-xxs font-black text-muted uppercase tracking-widest block mb-4">AI Examiner Model</label>
               <select id="speaking-key" class="input w-full bg-gray-50 font-bold text-sm">
                  ${SPEAKING_API_KEYS.map(k => `<option value="${k.key}">${k.name}</option>`).join('')}
               </select>
            </div>
         </div>
      </div>
      
      <button id="start-btn" class="btn btn-primary w-full py-4 text-lg font-black shadow-xl">
        Start Live Practice 🚀
      </button>
    </div>
  `;

  const qListEl = document.getElementById('qs-list');
  
  const save = () => localStorage.setItem(storageKey, JSON.stringify(currentQs.filter(q => q.trim())));

  const renderQs = () => {
    qListEl.innerHTML = '';
    currentQs.forEach((q, i) => {
      const row = document.createElement('div');
      row.className = 'flex gap-2 items-center';
      row.innerHTML = `
        <input type="text" class="input flex-1 text-sm q-in" value="${escapeHtml(q)}" placeholder="Type a question...">
        <button class="btn btn-sm btn-ghost text-red-400 del-q" data-idx="${i}">✕</button>
      `;
      qListEl.appendChild(row);
    });

    qListEl.querySelectorAll('.q-in').forEach((input, i) => {
       input.addEventListener('input', (e) => { currentQs[i] = e.target.value; save(); });
    });
    qListEl.querySelectorAll('.del-q').forEach(btn => {
       btn.addEventListener('click', () => {
         if (currentQs.length > 1) { currentQs.splice(btn.dataset.idx, 1); renderQs(); save(); }
       });
    });
  };

  renderQs();

  document.getElementById('add-q').addEventListener('click', () => { currentQs.push(""); renderQs(); });
  document.getElementById('start-btn').addEventListener('click', () => {
    const final = currentQs.filter(q => q.trim());
    if (!final.length) return showToast('Add a question first!', 'error');
    renderSpeakingMode(container, { questions: final, apiKey: document.getElementById('speaking-key').value, cards });
  });
  document.getElementById('exit-setup').addEventListener('click', () => location.reload());
}
