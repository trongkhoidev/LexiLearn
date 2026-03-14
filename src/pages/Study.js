import { db } from '../utils/supabase.js';
import { processReview, RATING } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/Toast.js';
import { validateAnswer } from '../utils/gemini.js';

const MODES = [
  { id: 'flip', label: '🔄 Basic Flip', desc: 'See word, flip to reveal meaning' },
  { id: 'recall', label: '✍️ Recall', desc: 'Fill in the blank from example sentence' },
  { id: 'meaning', label: '🧠 Meaning Recall', desc: 'See meaning, recall the word' },
];

export async function renderStudy(container, params) {
  const deckId = params.id === 'all' ? null : params.id;
  
  container.innerHTML = `<div class="flex flex-col items-center justify-center p-20"><div class="spinner"></div><p class="mt-4 text-muted">Loading cards...</p></div>`;

  try {
    const allWords = await db.words.list();
    let wordsInDeck = deckId ? allWords.filter(w => w.deck_id === deckId) : allWords;
    
    const now = new Date();
    let cards = wordsInDeck.filter(w => !w.next_review || new Date(w.next_review) <= now);
    
    if (cards.length === 0) {
      cards = wordsInDeck.filter(w => !w.review_count).slice(0, 10);
    }

    if (cards.length === 0) {
      container.innerHTML = `
        <div class="animate-fade-in-up study-container text-center p-20">
          <div class="text-6xl mb-6">🎉</div>
          <h2 class="text-2xl font-bold mb-4">All caught up!</h2>
          <p class="text-muted mb-8">No cards are due for review right now. Come back later or add more words.</p>
          <div class="flex gap-4 justify-center">
            <button class="btn btn-primary" id="back-to-dash">Dashboard</button>
            <button class="btn btn-secondary" id="add-more-btn">Add Words</button>
          </div>
        </div>
      `;
      document.getElementById('back-to-dash')?.addEventListener('click', () => navigateTo('/dashboard'));
      document.getElementById('add-more-btn')?.addEventListener('click', () => navigateTo('/add-word'));
      return;
    }

    let mode = 'flip';
    let currentIndex = 0;
    let isFlipped = false;
    let sessionResults = [];

    const renderModeSelect = () => {
      container.innerHTML = `
        <div class="animate-fade-in-up study-container max-w-2xl mx-auto">
          <div class="text-center mb-12">
            <h1 class="text-3xl font-bold mb-2">Choose Study Mode</h1>
            <p class="text-muted">You have ${cards.length} cards ready to review</p>
          </div>
          <div class="flex flex-col gap-4">
            ${MODES.map(m => `
              <div class="card card-interactive p-6 cursor-pointer border-l-4 border-blue-500 mode-option" data-mode="${m.id}">
                <div class="flex items-center gap-6">
                  <div class="text-4xl">${m.label.split(' ')[0]}</div>
                  <div class="flex-1">
                    <div class="font-bold text-lg">${m.label}</div>
                    <div class="text-muted">${m.desc}</div>
                  </div>
                  <div class="text-blue-500 text-2xl">→</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      container.querySelectorAll('.mode-option').forEach(el => {
        el.addEventListener('click', () => {
          mode = el.dataset.mode;
          renderCard();
        });
      });
    };

    const renderCard = () => {
      const card = cards[currentIndex];
      if (!card) return renderSummary();

      isFlipped = false;
      const progress = Math.round((currentIndex / cards.length) * 100);

      let front = '';
      let back = '';
      let hint = 'Click to reveal answer';

      const aiImage = `<div class="h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
        <img src="https://image.pollinations.ai/prompt/Minimalist%20illustration%20${encodeURIComponent(card.word)}?nologo=true" class="w-full h-full object-cover"/>
      </div>`;

      if (mode === 'flip') {
        front = `${aiImage}<div class="text-4xl font-bold">${escapeHtml(card.word)}</div><div class="text-muted font-medium">${card.pos || ''} ${card.phonetic || ''}</div>`;
        back = buildBack(card);
      } else if (mode === 'recall') {
        const sentence = card.example_sent || '____ is a very interesting word.';
        const obs = sentence.replace(new RegExp(card.word, 'gi'), '______');
        front = `<div class="text-muted mb-4">Complete the sentence:</div><div class="text-xl italic mb-6">"${escapeHtml(obs)}"</div><input id="ans-in" class="input text-center text-lg" placeholder="Type here..."><button id="check-btn" class="btn btn-primary w-full mt-4">Check</button>`;
        back = `<div id="feedback" class="mb-4"></div><div class="text-3xl font-bold">${escapeHtml(card.word)}</div>${buildBack(card)}`;
      } else {
        front = `<div class="text-muted mb-4">Translate to English:</div><div class="text-2xl font-bold mb-6">${escapeHtml(card.meaning)}</div><input id="ans-in" class="input text-center text-lg" placeholder="English word..."><button id="check-btn" class="btn btn-primary w-full mt-4">Check</button>`;
        back = `<div id="feedback" class="mb-4"></div><div class="text-3xl font-bold">${escapeHtml(card.word)}</div>${buildBack(card)}`;
      }

      container.innerHTML = `
        <div class="animate-fade-in study-container max-w-xl mx-auto">
          <div class="flex items-center justify-between mb-8">
            <button class="btn btn-ghost btn-sm text-red-500" id="exit">Exit</button>
            <div class="flex-1 mx-8 h-2 bg-gray-200 rounded-full overflow-hidden"><div class="h-full bg-blue-500" style="width:${progress}%"></div></div>
            <span class="badge badge-accent">${currentIndex + 1}/${cards.length}</span>
          </div>

          <div class="flashcard-wrapper">
            <div class="flashcard" id="fcard">
              <div class="flashcard-face flashcard-front">${front}<div class="mt-auto text-xs text-muted">${hint}</div></div>
              <div class="flashcard-face flashcard-back">${back}</div>
            </div>
          </div>

          <div id="ratings" class="rating-buttons mt-8 hidden">
            <button class="rating-btn again" data-r="0">Again</button>
            <button class="rating-btn hard" data-r="1">Hard</button>
            <button class="rating-btn good" data-r="2">Good</button>
            <button class="rating-btn easy" data-r="3">Easy</button>
          </div>
        </div>
      `;

      const fcard = document.getElementById('fcard');
      const showAnswer = () => {
        if (isFlipped) return;
        isFlipped = true;
        fcard.classList.add('flipped');
        document.getElementById('ratings').classList.remove('hidden');
      };

      if (mode === 'flip') fcard.addEventListener('click', showAnswer);
      
      document.getElementById('check-btn')?.addEventListener('click', () => {
        const val = document.getElementById('ans-in').value.trim().toLowerCase();
        const correct = val === card.word.toLowerCase();
        const fb = document.getElementById('feedback');
        fb.innerHTML = correct ? '<span class="text-green-500 font-bold text-lg">✅ Correct!</span>' : `<span class="text-red-500 font-bold text-lg">❌ Incorrect</span>`;
        showAnswer();
      });

      document.querySelectorAll('.rating-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const rating = parseInt(btn.dataset.r);
          await processReview(card.id, rating);
          await db.progress.logReview(card.id, rating, rating > 0);
          sessionResults.push({ word: card.word, rating: btn.dataset.r });
          currentIndex++;
          renderCard();
        });
      });

      document.getElementById('exit').addEventListener('click', () => window.history.back());
    };

    const renderSummary = () => {
      container.innerHTML = `
        <div class="study-container text-center p-20">
          <h1 class="text-4xl font-bold mb-4">Keep it up! 🚀</h1>
          <p class="text-muted mb-8 text-lg">You reviewed ${sessionResults.length} cards in this session.</p>
          <button class="btn btn-primary px-10" onclick="location.hash='#/dashboard'">Finish</button>
        </div>
      `;
    };

    renderModeSelect();

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-red-500">Error: ${err.message}</div>`;
  }

  function buildBack(c) {
    return `<div class="mt-4 border-t pt-4 text-left">
      <div class="font-bold text-lg text-blue-600 mb-2">${escapeHtml(c.meaning)}</div>
      <p class="text-muted italic mb-4">${escapeHtml(c.explanation || '')}</p>
      ${c.example_sent ? `<div class="p-3 bg-gray-50 rounded border-l-4 border-blue-500 italic">"${escapeHtml(c.example_sent)}"</div>` : ''}
    </div>`;
  }
}
