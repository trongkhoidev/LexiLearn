/* ============================================
   LexiLearn — Recall Mode Component
   ============================================
*/

import { db } from '../../../utils/supabase.js';
import { processReview, RATING } from '../../../data/srs.js';
import { escapeHtml } from '../../../utils/helpers.js';
import { generateDistractors, validateAnswer } from '../../../utils/gemini.js';
import { highlightWordInSentence, speakWord, escapeRegex } from '../StudyUtils.js';

export function renderRecallMode({ container, sessionState, next, prev, finish }) {
  const cards = sessionState.getCards();
  const currentIndex = sessionState.getCurrentIndex();
  const card = cards[currentIndex];
  
  const progress = Math.round((currentIndex / cards.length) * 100);
  const sentence = card.example_sent || '____ is a very interesting word.';
  const blanked = sentence.replace(new RegExp(escapeRegex(card.word), 'gi'), '______');

  container.innerHTML = `
    <div class="animate-fade-in study-container study-mode-recall max-w-xl mx-auto py-12">
      <div class="flex-between mb-8">
        <button class="btn btn-ghost btn-sm text-muted font-bold" id="exit-session">← Quit Session</button>
        <div class="badge badge-purple text-[10px] font-black uppercase tracking-widest">Recall Master</div>
      </div>

      <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-12 shadow-inner">
         <div class="h-full bg-purple-500 transition-all duration-700" style="width:${progress}%"></div>
      </div>

      <div class="card p-12 shadow-premium bg-white rounded-3xl relative overflow-hidden flex flex-col min-h-[480px]">
         <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
         <div class="flex flex-col items-center justify-center flex-1 py-10">
            <span class="text-xxs font-black text-muted uppercase tracking-widest block mb-8">Recall Context</span>
            <div class="text-2xl font-black text-gray-900 leading-tight text-center mb-12 px-6 italic">"${escapeHtml(blanked)}"</div>
            <div id="ai-dynamic-content" class="w-full">
              <div class="flex-center flex-col py-10 opacity-30">
                 <div class="spinner-sm mb-4"></div>
                 <p class="text-[10px] font-black uppercase tracking-widest">Generating Options</p>
              </div>
            </div>
            <div id="feedback" class="mt-8 text-center"></div>
         </div>
      </div>

      <div id="post-check-next" class="hidden flex-center mt-10 animate-fade-in">
         <button class="btn btn-primary px-12 py-3 font-black shadow-xl shadow-purple-200">
            ${currentIndex < cards.length - 1 ? 'Next Card →' : 'Finish Session 🎉'}
         </button>
      </div>
    </div>
  `;

  const aiContainer = document.getElementById('ai-dynamic-content');
  const postCheck = document.getElementById('post-check-next');
  const feedbackEl = document.getElementById('feedback');

  const handleResult = async (isCorrect, feedbackText) => {
    feedbackEl.innerHTML = isCorrect
      ? `<div class="text-green-600 font-black text-lg mb-1">Perfect! ✨</div>`
      : `<div class="text-red-500 font-black text-lg mb-1">Oops!</div> <p class="text-xs text-red-700 font-medium">Answer: <span class="font-black">${escapeHtml(card.word)}</span></p>`;
    
    if (feedbackText && !isCorrect) {
      feedbackEl.innerHTML += `<p class="text-xxs mt-1 text-red-600 opacity-80">${escapeHtml(feedbackText)}</p>`;
    }

    try {
      await processReview(card.id, isCorrect ? RATING.GOOD : RATING.AGAIN);
      await db.progress.logReview(card.id, isCorrect ? 2 : 0, isCorrect);
      if (isCorrect) sessionState.markCorrect(card.id);
      else sessionState.markWrong(card.id);
    } catch (e) {}

    postCheck.classList.remove('hidden');
    container.querySelectorAll('.mc-option, input, button:not(#exit-session)').forEach(el => el.disabled = true);
  };

  const checkMultipleChoice = (val, btn) => {
    const isCorrect = val === card.word;
    container.querySelectorAll('.mc-option').forEach(b => {
      if (b.dataset.val === card.word) b.classList.add('correct');
      else if (b === btn && !isCorrect) b.classList.add('incorrect');
      b.disabled = true;
    });
    handleResult(isCorrect);
  };

  const checkInput = async () => {
    const input = document.getElementById('ans-in');
    const val = input.value.trim();
    if (!val) return;

    try {
      const validation = await validateAnswer(val, card.word, card.example_sent);
      handleResult(validation.isCorrect, validation.feedback);
    } catch (e) {
      handleResult(val.toLowerCase() === card.word.toLowerCase());
    }
  };

  // Logic startup
  generateDistractors(card.word, card.meaning, card.pos, 'recall').then(distractors => {
    const options = [...distractors, card.word].sort(() => Math.random() - 0.5);
    aiContainer.innerHTML = `
      <div class="mc-options animate-fade-in-up">
        ${options.map(opt => `<button class="mc-option" data-val="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
      </div>
    `;
    aiContainer.querySelectorAll('.mc-option').forEach(btn => {
      btn.addEventListener('click', () => checkMultipleChoice(btn.dataset.val, btn));
    });
  }).catch(() => {
    aiContainer.innerHTML = `
      <div class="flex flex-col gap-4 animate-fade-in">
        <input id="ans-in" class="input text-center text-lg shadow-inner" placeholder="Type the missing word..." autocomplete="off">
        <button id="check-btn" class="btn btn-primary py-3 font-black">Check Answer</button>
      </div>
    `;
    aiContainer.querySelector('#check-btn').addEventListener('click', checkInput);
    aiContainer.querySelector('#ans-in').addEventListener('keydown', (e) => { if(e.key === 'Enter') checkInput(); });
  });

  postCheck.addEventListener('click', next);
  document.getElementById('exit-session').addEventListener('click', () => window.history.back());
}
