/* ============================================
   LexiLearn — Study Mode Selection Component
   ============================================
*/

const MODES = [
  { id: 'flip', label: 'Classic Flip', desc: 'Active recall via flashcards', short: 'Flip', icon: '🔄' },
  { id: 'recall', label: 'Recall Master', desc: 'Fill-in-the-blank contexts', short: 'Recall', icon: '✍️' },
  { id: 'meaning', label: 'Meaning Deep', desc: 'Guess the word from meaning', short: 'Guess', icon: '🧠' },
  { id: 'speaking', label: 'Mock Interview', desc: 'Full AI-simulated speaking test', short: 'Interview', icon: '🎙️' },
];

export function renderModeSelect(container, { cards, onSelect }) {
  container.innerHTML = `
    <div class="animate-fade-in-up study-container max-w-4xl mx-auto py-12">
      <div class="text-center mb-16">
        <h1 class="text-4xl font-black mb-4 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Choose Study Mode</h1>
        <p class="text-lg text-muted">Optimize your recall. You have <span class="font-black text-blue-600">${cards.length}</span> cards ready to master.</p>
      </div>
      <div class="grid grid-4-responsive gap-6">
        ${MODES.map((m, i) => `
          <div class="card card-interactive hover-lift group border-none shadow-premium bg-white p-8 cursor-pointer flex flex-col items-center text-center" data-mode="${m.id}" role="button" tabindex="0">
            <div class="w-16 h-16 rounded-2xl bg-gray-50 flex-center text-4xl mb-6 group-hover:scale-110 transition-transform shadow-sm">${m.icon}</div>
            <h3 class="text-xl font-black text-gray-900 mb-2">${m.label}</h3>
            <p class="text-xs text-muted leading-relaxed mb-6">${m.desc}</p>
            <div class="mt-auto pt-4 w-full border-t border-gray-100">
               <div class="text-[10px] font-black text-blue-600 uppercase tracking-widest flex-center gap-2">
                 Select Mode <span class="group-hover:translate-x-1 transition-transform">→</span>
               </div>
            </div>
            <div class="absolute top-4 left-4 w-6 h-6 rounded-lg bg-gray-100/50 flex-center text-[10px] font-black text-gray-500">${i + 1}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const handleModeKey = (e) => {
    if (e.key === '1') finalize('flip');
    if (e.key === '2') finalize('recall');
    if (e.key === '3') finalize('meaning');
    if (e.key === '4') finalize('speaking');
  };

  const finalize = (m) => {
    document.removeEventListener('keydown', handleModeKey);
    onSelect(m);
  };

  container.querySelectorAll('[data-mode]').forEach(el => {
    el.addEventListener('click', () => finalize(el.dataset.mode));
  });

  document.addEventListener('keydown', handleModeKey);
  
  // Cleanup listener on container removal
  container._studyCleanup = () => {
    document.removeEventListener('keydown', handleModeKey);
  };
}
