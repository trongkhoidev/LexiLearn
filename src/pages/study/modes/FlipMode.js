/* ============================================
   LexiLearn — Flip Mode Component
   ============================================
*/

import { db } from '../../../utils/supabase.js';
import { processReview, RATING } from '../../../data/srs.js';
import { escapeHtml } from '../../../utils/helpers.js';
import { highlightWordInSentence, speakWord, fetchUsageAnalysis, parseSynonyms } from '../StudyUtils.js';

export function renderFlipMode({ container, sessionState, next, prev, finish }) {
  const cards = sessionState.getCards();
  const currentIndex = sessionState.getCurrentIndex();
  const card = cards[currentIndex];
  
  const progress = Math.round((currentIndex / cards.length) * 100);
  
  container.innerHTML = `
    <div class="animate-fade-in study-container study-mode-flip max-w-xl mx-auto py-12">
      <div class="flex-between mb-8">
        <button class="btn btn-ghost btn-sm text-muted font-bold" id="exit-session">← Quit Session</button>
        <div class="badge badge-outline text-[10px] font-black uppercase tracking-widest">Classic Flip</div>
      </div>

      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-12 shadow-inner">
         <div class="h-full bg-blue-500 transition-all duration-700" style="width:${progress}%"></div>
      </div>

      <div class="perspective-1000">
         <div class="flashcard-new shadow-premium bg-white rounded-3xl cursor-pointer select-none overflow-hidden relative group" id="fcard" style="min-height: 480px; transition: all 0.6s var(--transition-spring);">
            <div class="flashcard-inner h-full w-full relative">
               <div class="flashcard-face-front p-12 flex flex-col h-full bg-white animate-scale-in">
                  ${buildFront(card)}
               </div>
               <div class="flashcard-face-back p-12 flex flex-col h-full bg-slate-50 opacity-0 absolute inset-0 pointer-events-none transition-all duration-500 scale-95 flipped:scale-100">
                  ${buildBack(card)}
               </div>
            </div>
         </div>
      </div>

      <div id="flip-rating-area" class="invisible flex justify-center gap-4 mt-10 animate-fade-in">
         <button id="rate-hard" class="btn bg-red-50 text-red-600 border-none shadow-sm font-black px-8">Hard</button>
         <button id="rate-good" class="btn btn-primary px-10 font-black shadow-lg shadow-blue-200">Know It</button>
         <button id="rate-easy" class="btn bg-green-50 text-green-600 border-none shadow-sm font-black px-8">Easy</button>
      </div>

      <div class="flex-center gap-8 mt-12 text-muted text-[10px] font-black uppercase tracking-tighter opacity-50">
         <span class="flex items-center gap-2"><kbd class="bg-gray-100 p-1 px-2 rounded opacity-50">Space</kbd> Flip</span>
         <span class="flex items-center gap-2"><kbd class="bg-gray-100 p-1 px-2 rounded opacity-50">Shift</kbd> Pronounce</span>
         <span class="flex items-center gap-2"><kbd class="bg-gray-100 p-1 px-2 rounded opacity-50">← →</kbd> Navigation</span>
      </div>
    </div>
  `;

  const fcard = document.getElementById('fcard');
  const ratingArea = document.getElementById('flip-rating-area');

  const flip = () => {
    if (sessionState.isFlipped()) return;
    sessionState.setFlipped(true);
    fcard.classList.add('flipped');
    const faceBack = fcard.querySelector('.flashcard-face-back');
    faceBack.classList.remove('opacity-0', 'pointer-events-none');
    faceBack.classList.add('opacity-100');
    ratingArea.classList.remove('invisible');

    // Trigger AI analysis
    if (card.example_sent?.trim()) {
      fetchUsageAnalysis(card.word, card.example_sent, `#study-usage-${card.id}`);
    }
  };

  const handleRating = async (rating, score, isCorrect) => {
    try {
      await processReview(card.id, rating);
      await db.progress.logReview(card.id, score, isCorrect);
      if (isCorrect) sessionState.markCorrect(card.id);
      else sessionState.markWrong(card.id);
      next();
    } catch (e) {
      next();
    }
  };

  // Listeners
  fcard.addEventListener('click', flip);
  document.getElementById('rate-hard').addEventListener('click', () => handleRating(RATING.AGAIN, 0, false));
  document.getElementById('rate-good').addEventListener('click', () => handleRating(RATING.GOOD, 2, true));
  document.getElementById('rate-easy').addEventListener('click', () => handleRating(RATING.EASY || RATING.GOOD, 3, true));
  document.getElementById('exit-session').addEventListener('click', () => window.history.back());

  // Keyboard
  const flipKeys = (e) => {
    if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      flip();
    }
  };
  document.addEventListener('keydown', flipKeys);
  container._modeCleanup = () => {
    document.removeEventListener('keydown', flipKeys);
  };
}

function buildFront(card) {
  const wordEsc = escapeHtml(card.word);
  const posEsc = escapeHtml((card.pos || '').trim());
  const phoneticEsc = escapeHtml(card.phonetic || '');
  const exampleHighlighted = highlightWordInSentence(card.example_sent, card.word);
  
  return `
    <div class="flex flex-col items-center justify-center flex-1 text-center py-10">
      <h1 class="text-5xl font-black text-gray-900 tracking-tighter mb-6">${wordEsc}</h1>
      <div class="flex gap-3 mb-10">
         ${posEsc ? `<span class="badge badge-outline text-[10px] font-black uppercase tracking-widest opacity-50">${posEsc}</span>` : ''}
         ${phoneticEsc ? `<span class="text-sm font-bold text-muted opacity-50 italic">/${phoneticEsc}/</span>` : ''}
      </div>
      ${exampleHighlighted ? `<div class="px-8 text-lg font-medium text-gray-600 leading-relaxed italic opacity-80">"${exampleHighlighted}"</div>` : ''}
      <div class="mt-auto pt-10">
         <button type="button" class="w-14 h-14 rounded-2xl bg-gray-50 text-gray-400 flex-center hover:text-blue-600 transition-colors" onclick="event.stopPropagation(); speakWord('${wordEsc}')">🔊</button>
      </div>
    </div>
  `;
}

function buildBack(card) {
  const wordEsc = escapeHtml(card.word);
  const synonyms = parseSynonyms(card);
  const exampleHighlighted = highlightWordInSentence(card.example_sent, card.word);

  return `
    <div class="flex flex-col h-full overflow-y-auto custom-scrollbar pr-2">
      <div class="flex-between mb-6">
        <div class="text-2xl font-black text-gray-900">${escapeHtml(card.meaning || '')}</div>
        <button type="button" class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex-center" onclick="event.stopPropagation(); speakWord('${wordEsc}')">🔊</button>
      </div>

      <div class="flex gap-2 mb-8">
        ${card.pos ? `<span class="badge badge-blue text-[10px] font-black uppercase">${escapeHtml(card.pos)}</span>` : ''}
        ${card.phonetic ? `<span class="text-xs font-bold text-muted font-mono italic">/${escapeHtml(card.phonetic)}/</span>` : ''}
      </div>

      <div class="space-y-8">
         ${card.explanation ? `
           <div>
              <label class="text-[10px] font-black text-muted uppercase tracking-widest block mb-2">Nuance & Usage</label>
              <p class="text-sm text-gray-700 leading-relaxed font-medium">${escapeHtml(card.explanation)}</p>
           </div>
         ` : ''}

         ${exampleHighlighted ? `
           <div class="p-6 bg-gray-50 rounded-2xl border border-gray-100/50">
              <label class="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-3">Context Example</label>
              <p class="text-sm italic text-gray-800 leading-relaxed font-medium">"${exampleHighlighted}"</p>
           </div>
         ` : ''}

         <div>
            <label class="text-[10px] font-black text-muted uppercase tracking-widest block mb-2">Sentence Analysis</label>
            <div id="study-usage-${card.id}" class="text-xs text-muted leading-relaxed italic animate-pulse">Calculating AI context analysis...</div>
         </div>

         ${synonyms.length > 0 ? `
           <div>
              <label class="text-[10px] font-black text-muted uppercase tracking-widest block mb-3">Synonyms</label>
              <div class="flex flex-wrap gap-2">
                 ${synonyms.map((s) => `<span class="px-3 py-1 bg-white border border-gray-100 rounded-lg text-xs font-bold text-gray-600">${escapeHtml(s)}</span>`).join('')}
              </div>
           </div>
         ` : ''}
      </div>
    </div>
  `;
}
