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
        <div class="animate-fade-in-up study-container max-w-4xl mx-auto">
          <div class="text-center mb-16">
            <h1 class="text-4xl font-extrabold mb-4" style="background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Choose Study Mode</h1>
            <p class="text-lg text-muted">You have <span class="font-bold text-accent">${cards.length}</span> cards ready to review</p>
          </div>
          <div class="grid grid-3-responsive gap-6">
            ${MODES.map(m => `
              <div class="mode-card cursor-pointer" data-mode="${m.id}">
                <div class="mode-card-inner">
                  <div class="mode-icon">${m.label.split(' ')[0]}</div>
                  <h3 class="mode-label">${m.label}</h3>
                  <p class="mode-desc">${m.desc}</p>
                  <div class="mode-arrow">→</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      container.querySelectorAll('.mode-card').forEach(el => {
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

      const front = buildFront(card, mode);
      const back = mode === 'flip' 
        ? buildBack(card) 
        : `<div id="feedback" class="mb-4"></div><div class="text-3xl font-bold">${escapeHtml(card.word)}</div>${buildBack(card)}`;
      const hint = mode === 'flip' ? 'Click to reveal answer' : 'Check your answer';

      container.innerHTML = `
        <div class="animate-fade-in study-container max-w-xl mx-auto">
          <div class="flashcard-progress-bar">
            <button class="btn btn-ghost btn-sm text-red-500" id="exit">← Exit</button>
            <div class="progress-container">
              <div class="progress-bar-wrapper">
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width:${progress}%"></div>
                </div>
              </div>
              <span class="progress-counter">${currentIndex + 1}/${cards.length}</span>
            </div>
          </div>

          <div class="flashcard-wrapper">
            <div class="flashcard" id="fcard">
              <div class="flashcard-face flashcard-front">${front}<div class="mt-auto text-xs text-muted">${hint}</div></div>
              <div class="flashcard-face flashcard-back">${back}</div>
            </div>
          </div>

          <div id="ratings" class="rating-buttons mt-8 hidden">
            <button class="rating-btn again" data-r="0">
              <span class="rating-emoji">🔴</span>
              <span class="rating-label">Again</span>
            </button>
            <button class="rating-btn hard" data-r="1">
              <span class="rating-emoji">🟡</span>
              <span class="rating-label">Hard</span>
            </button>
            <button class="rating-btn good" data-r="2">
              <span class="rating-emoji">🟢</span>
              <span class="rating-label">Good</span>
            </button>
            <button class="rating-btn easy" data-r="3">
              <span class="rating-emoji">🔵</span>
              <span class="rating-label">Easy</span>
            </button>
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

  // Helper function to build the back side of flashcard
  function buildBack(card) {
    const meaning = escapeHtml(card.meaning || '');
    const explanation = escapeHtml(card.explanation || '');
    const example = escapeHtml(card.example_sent || '');
    
    let backContent = `<div class="mt-4 border-t pt-4 text-left">
      <div class="font-bold text-lg text-accent mb-2">${meaning}</div>`;
    
    if (explanation) {
      backContent += `<p class="text-muted italic mb-4">${explanation}</p>`;
    }
    
    if (example) {
      backContent += `<div class="p-3 bg-accent-light rounded border-l-4 border-accent italic">"${example}"</div>`;
    }
    
    backContent += '</div>';
    return backContent;
  }

  // Helper function to render front side based on study mode
  function buildFront(card, mode) {
    const aiImage = `<div class="h-48 bg-gray-100 rounded-lg mb-4 flex items-center justify-center overflow-hidden">
      <img src="https://image.pollinations.ai/prompt/Minimalist%20illustration%20${encodeURIComponent(card.word)}?nologo=true" class="w-full h-full object-cover" alt="${card.word}"/>
    </div>`;

    if (mode === 'flip') {
      return `${aiImage}<div class="text-4xl font-bold">${escapeHtml(card.word)}</div><div class="text-muted font-medium">${card.pos || ''} ${card.phonetic || ''}</div>`;
    } else if (mode === 'recall') {
      const sentence = card.example_sent || '____ is a very interesting word.';
      const blanked = sentence.replace(new RegExp(card.word, 'gi'), '______');
      return `<div class="text-muted mb-4">Complete the sentence:</div><div class="text-xl italic mb-6">"${escapeHtml(blanked)}"</div><input id="ans-in" class="input text-center text-lg" placeholder="Type here..."><button id="check-btn" class="btn btn-primary w-full mt-4">Check</button>`;
    } else {
      return `<div class="text-muted mb-4">Translate to English:</div><div class="text-2xl font-bold mb-6">${escapeHtml(card.meaning)}</div><input id="ans-in" class="input text-center text-lg" placeholder="English word..."><button id="check-btn" class="btn btn-primary w-full mt-4">Check</button>`;
    }
  }
}
