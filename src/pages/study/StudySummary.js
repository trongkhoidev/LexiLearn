/* ============================================
   LexiLearn — Study Summary Component
   ============================================
*/

import { navigateTo } from '../../router.js';
import { escapeHtml } from '../../utils/helpers.js';

export function renderSummary(container, { completedCardIds, wrongInSession, totalCards, cards }) {
  const wrongList = [...wrongInSession.entries()]
    .filter(([, n]) => n >= 1)
    .map(([id]) => cards.find(c => c.id === id)?.word)
    .filter(Boolean);
    
  const masteryXp = completedCardIds.size * 10;
  const accuracy = totalCards > 0 ? ((completedCardIds.size / (completedCardIds.size + wrongInSession.size)) * 100).toFixed(0) : 0;
  
  container.innerHTML = `
    <div class="animate-fade-in study-container max-w-xl mx-auto py-20 text-center">
      <div class="relative inline-block mb-10">
        <div class="w-24 h-24 bg-blue-600 text-white rounded-3xl flex-center mx-auto text-4xl shadow-glow animate-bounce">🎉</div>
        <div class="absolute -top-4 -right-4 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-lg shadow-sm border-2 border-white">+${masteryXp} XP</div>
      </div>
      
      <h1 class="text-4xl font-black text-gray-900 mb-4 tracking-tight">Session Complete!</h1>
      <p class="text-lg text-muted mb-12 leading-relaxed">
        Stellar effort! You've successfully reviewed <span class="font-black text-blue-600">${completedCardIds.size} cards</span> and earned <span class="font-black text-amber-600">${masteryXp} XP</span> towards your goal.
      </p>

      <div class="grid grid-2-responsive gap-4 mb-12">
        <div class="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
          <span class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Mastery Gain</span>
          <span class="text-2xl font-black text-green-600">+ ${(completedCardIds.size * 1.5).toFixed(0)}%</span>
        </div>
        <div class="p-6 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center">
          <span class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Session Accuracy</span>
          <span class="text-2xl font-black text-blue-600">${accuracy}%</span>
        </div>
      </div>

      ${wrongList.length > 0 ? `
        <div class="bg-amber-50 rounded-2xl p-6 border border-amber-100 text-left mb-8 animate-fade-in-up">
           <h3 class="text-xxs font-black text-amber-700 uppercase tracking-widest mb-3 flex items-center gap-2">
              <span class="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex-center text-[10px]">!</span> Focus Needed
           </h3>
           <p class="text-sm text-amber-900 font-medium">Consider extra practice for these words:</p>
           <div class="flex flex-wrap gap-2 mt-3">
              ${wrongList.map(w => `<span class="badge badge-amber text-[10px] font-black">${escapeHtml(w)}</span>`).join('')}
           </div>
        </div>
      ` : `
        <div class="bg-green-50 rounded-2xl p-6 border border-green-100 mb-8 animate-fade-in-up">
           <p class="text-sm text-green-700 font-bold">Flawless Session! Your mastery is increasing rapidly. 🔥</p>
        </div>
      `}

      <div class="flex flex-col gap-3">
         <button class="btn btn-primary py-4 font-black shadow-lg shadow-blue-200" id="study-finish-btn">Done for Now</button>
         <button class="btn btn-ghost text-muted text-xs font-bold" id="restart-study">Start Another Session</button>
      </div>
    </div>
  `;

  document.getElementById('study-finish-btn')?.addEventListener('click', () => navigateTo('/dashboard'));
  document.getElementById('restart-study')?.addEventListener('click', () => location.reload());
}
