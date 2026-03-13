/* ============================================
   LexiLearn — Study (Flashcard) Page
   ============================================
   3 modes: Basic Flip, Recall (fill-in-blank), Meaning Recall
*/

import { getWords, recordStudySession } from '../data/store.js';
import { getDueWords, getNewWords, processReview, RATING, formatNextReview } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/Toast.js';

const MODES = [
  { id: 'flip', label: '🔄 Basic Flip', desc: 'See word, flip to reveal meaning' },
  { id: 'recall', label: '✍️ Recall', desc: 'Fill in the blank from example sentence' },
  { id: 'meaning', label: '🧠 Meaning Recall', desc: 'See meaning, recall the word' },
];

export function renderStudy(container, params) {
  const deckId = params.id === 'all' ? null : params.id;
  let cards = [...getDueWords(deckId), ...getNewWords(deckId).slice(0, 10)];

  // Deduplicate
  const seen = new Set();
  cards = cards.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  if (cards.length === 0) {
    container.innerHTML = `
      <div class="animate-fade-in-up study-container">
        <div class="empty-state card" style="margin-top:var(--space-16);">
          <div class="empty-state-icon">🎉</div>
          <div class="empty-state-title">All caught up!</div>
          <div class="empty-state-text">No cards are due for review right now. Come back later or add more words.</div>
          <div class="flex gap-3">
            <button class="btn btn-primary" id="back-to-dash">🏠 Dashboard</button>
            <button class="btn btn-secondary" id="add-more-btn">➕ Add Words</button>
          </div>
        </div>
      </div>
    `;
    container.querySelector('#back-to-dash')?.addEventListener('click', () => navigateTo('/dashboard'));
    container.querySelector('#add-more-btn')?.addEventListener('click', () => navigateTo('/add-word'));
    return;
  }

  // State
  let mode = 'flip';
  let currentIndex = 0;
  let isFlipped = false;
  let sessionNew = 0;
  let sessionReview = 0;
  let sessionResults = [];  // { word, rating }

  const renderModeSelect = () => {
    container.innerHTML = `
      <div class="animate-fade-in-up study-container" style="margin-top:var(--space-4);">
        <button class="btn btn-ghost btn-sm" id="study-back-btn" style="margin-bottom:var(--space-6);">← Back</button>
        <div style="text-align:center;margin-bottom:var(--space-8);">
          <h1 style="font-size:var(--font-size-2xl);font-weight:700;color:#1f2937;margin-bottom:var(--space-2);">Choose Study Mode</h1>
          <p style="color:#6b7280;font-size:var(--font-size-base);">You have ${cards.length} card${cards.length !== 1 ? 's' : ''} ready to study</p>
        </div>
        <div class="flex flex-col gap-3" style="max-width:600px;margin:0 auto;">
          ${MODES.map(m => `
            <div class="card card-interactive mode-option" data-mode="${m.id}" style="padding:var(--space-6);cursor:pointer;border-left:4px solid #3B82F6;transition:all 0.2s ease;">
              <div class="flex items-center gap-4">
                <div style="font-size:2rem;min-width:50px;display:flex;align-items:center;justify-content:center;">${m.label.split(' ')[0]}</div>
                <div style="flex:1;text-align:left;">
                  <div style="font-size:var(--font-size-base);font-weight:600;color:#1f2937;margin-bottom:var(--space-1);">${m.label}</div>
                  <div style="font-size:var(--font-size-sm);color:#6b7280;">${m.desc}</div>
                </div>
                <div style="color:#3B82F6;font-size:1.5rem;">→</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    container.querySelector('#study-back-btn').addEventListener('click', () => window.history.back());
    container.querySelectorAll('.mode-option').forEach(el => {
      el.addEventListener('click', () => {
        mode = el.dataset.mode;
        currentIndex = 0;
        isFlipped = false;
        renderCard();
      });
    });
  };

  const getCurrentCard = () => cards[currentIndex];

  const renderCard = () => {
    const card = getCurrentCard();
    if (!card) return renderSummary();

    isFlipped = false;

    const progressPct = Math.round((currentIndex / cards.length) * 100);

    let frontContent = '';
    let backContent = '';
    let hint = 'Click card to reveal';

    const getAiImageUrl = (item) => `https://image.pollinations.ai/prompt/Vector%20illustration%20of%20the%20word%20${encodeURIComponent(item.word)}?width=600&height=400&nologo=true`;
    const aiImageHtml = `
      <div class="flashcard-image-container" style="width:100%; height:180px; margin-bottom:var(--space-4); border-radius:var(--radius-md); overflow:hidden; background:var(--color-bg-secondary); position:relative;">
        <img src="${getAiImageUrl(card)}" alt="AI Gen" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.parentElement.style.display='none'" />
        <div style="position:absolute; bottom:5px; left:5px; background:rgba(0,0,0,0.6); color:#fff; font-size:10px; padding:2px 4px; border-radius:4px;">✨ Free AI Gen</div>
      </div>
    `;

    switch (mode) {
      case 'flip':
        frontContent = `
          ${aiImageHtml}
          <div class="flashcard-word">${escapeHtml(card.word)}</div>
          ${card.partOfSpeech ? `<div class="flashcard-pos">${escapeHtml(card.partOfSpeech)}</div>` : ''}
          ${card.phonetic ? `<div class="flashcard-phonetic">${escapeHtml(card.phonetic)}</div>` : ''}
        `;
        backContent = buildBackContent(card);
        break;

      case 'recall':
        const sentence = card.example || `Use the word: ____`;
        const blanked = card.example ? sentence.replace(new RegExp(escapeRegex(card.word), 'gi'), '______') : sentence;
        frontContent = `
          <div style="font-size:var(--font-size-lg);color:var(--color-text-secondary);margin-bottom:var(--space-4);">Fill in the blank:</div>
          <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-semibold);line-height:1.5;">${escapeHtml(blanked)}</div>
        `;
        backContent = `
          ${aiImageHtml}
          <div style="margin-bottom:var(--space-4);">
            <div class="text-sm text-muted" style="margin-bottom:var(--space-1);">Answer:</div>
            <div class="flashcard-word" style="font-size:var(--font-size-2xl);">${escapeHtml(card.word)}</div>
          </div>
          ${buildBackContent(card)}
        `;
        hint = 'Click to see the answer';
        break;

      case 'meaning':
        frontContent = `
          <div style="font-size:var(--font-size-lg);color:var(--color-text-secondary);margin-bottom:var(--space-4);">What word means:</div>
          <div style="font-size:var(--font-size-xl);font-weight:var(--font-weight-semibold);">${escapeHtml(card.meaning)}</div>
          ${card.explanation ? `<div class="text-sm text-muted" style="margin-top:var(--space-3);">${escapeHtml(card.explanation)}</div>` : ''}
        `;
        backContent = `
          ${aiImageHtml}
          <div style="margin-bottom:var(--space-4);">
            <div class="flashcard-word" style="font-size:var(--font-size-2xl);">${escapeHtml(card.word)}</div>
            ${card.partOfSpeech ? `<div class="flashcard-pos">${escapeHtml(card.partOfSpeech)}</div>` : ''}
          </div>
          ${buildBackContent(card)}
        `;
        hint = 'Click to reveal the word';
        break;
    }

    container.innerHTML = `
      <div class="animate-fade-in study-container">
        <div class="flex items-center justify-between" style="margin-bottom:var(--space-6);">
          <button class="btn btn-ghost btn-sm" id="exit-study" style="color:#ef4444;">Exit Study</button>
          <div style="text-align:center;">
            <div style="font-size:var(--font-size-sm);color:#6b7280;margin-bottom:var(--space-1);">Card <span style="font-weight:600;color:#1f2937;">${currentIndex + 1}</span> of <span style="font-weight:600;color:#1f2937;">${cards.length}</span></div>
            <div class="progress-bar" style="height:4px;width:200px;">
              <div class="progress-bar-fill" style="width:${progressPct}%;background:linear-gradient(90deg, #3B82F6 0%, #06b6d4 100%);"></div>
            </div>
          </div>
          <span style="background:#dbeafe;color:#1e40af;padding:var(--space-2) var(--space-3);border-radius:var(--border-radius);font-size:var(--font-size-xs);font-weight:600;">${MODES.find(m => m.id === mode).label}</span>
        </div>

        <!-- Flashcard -->
        <div class="flex items-center justify-center gap-6 w-full">
          <button class="btn btn-secondary btn-sm" id="side-prev-btn" style="font-size:18px; width:44px; height:44px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:8px;" ${currentIndex === 0 ? 'disabled' : ''}>←</button>
          
          <div class="flashcard-wrapper" style="flex:1; max-width:640px;">
            <div class="flashcard" id="flashcard" style="cursor:pointer;user-select:none;">
              <div class="flashcard-face flashcard-front">
                ${frontContent}
                <div class="flashcard-hint" style="margin-top:auto;">${hint}</div>
              </div>
              <div class="flashcard-face flashcard-back">
                ${backContent}
              </div>
            </div>
          </div>
          
          <button class="btn btn-secondary btn-sm" id="side-next-btn" style="font-size:18px; width:44px; height:44px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:8px;" ${currentIndex === cards.length - 1 ? 'disabled' : ''}>→</button>
        </div>

        <!-- Rating buttons (hidden until flipped) -->
        <div class="rating-buttons" id="rating-buttons" style="display:none;">
          <button class="rating-btn again" data-rating="0">
            Again
            <span class="rating-label">&lt; 10m</span>
          </button>
          <button class="rating-btn hard" data-rating="1">
            Hard
            <span class="rating-label">Review soon</span>
          </button>
          <button class="rating-btn good" data-rating="2">
            Good
            <span class="rating-label">Next level</span>
          </button>
          <button class="rating-btn easy" data-rating="3">
            Easy
            <span class="rating-label">Skip ahead</span>
          </button>
        </div>

        <!-- Audio (if available) -->
        ${card.audioUrl ? `<audio id="card-audio" src="${card.audioUrl}"></audio>` : ''}
      </div>
    `;

    // Nav functions
    const goPrev = () => { if (currentIndex > 0) { currentIndex--; renderCard(); } };
    const goNext = () => { if (currentIndex < cards.length - 1) { currentIndex++; renderCard(); } };

    // Flip card
    const flashcard = document.getElementById('flashcard');
    flashcard.addEventListener('click', () => {
      isFlipped = !isFlipped;
      if (isFlipped) {
        flashcard.classList.add('flipped');
        document.getElementById('rating-buttons').style.display = 'grid';
        // Play audio if available
        document.getElementById('card-audio')?.play().catch(() => {});
      } else {
        flashcard.classList.remove('flipped');
      }
    });

    // Rating buttons
    document.querySelectorAll('.rating-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rating = parseInt(btn.dataset.rating);
        const word = getCurrentCard();
        processReview(word.id, rating);

        if (word.reviewCount === 0) sessionNew++;
        else sessionReview++;

        sessionResults.push({ word: word.word, rating });

        currentIndex++;
        renderCard();
      });
    });

    // Exit
    document.getElementById('exit-study')?.addEventListener('click', () => {
      if (sessionNew + sessionReview > 0) {
        recordStudySession(sessionNew, sessionReview);
      }
      if (window._studyKeydownHandler) {
        document.removeEventListener('keydown', window._studyKeydownHandler);
      }
      window.history.back();
    });

    // Nav buttons
    document.getElementById('prev-card-btn')?.addEventListener('click', goPrev);
    document.getElementById('next-card-btn')?.addEventListener('click', goNext);
    document.getElementById('side-prev-btn')?.addEventListener('click', goPrev);
    document.getElementById('side-next-btn')?.addEventListener('click', goNext);

    // Keyboard navigation
    const handleKeydown = (e) => {
      // Clean up if we migrated away from page
      if (!document.getElementById('flashcard')) {
        document.removeEventListener('keydown', window._studyKeydownHandler);
        return;
      }
      // Don't intercept if user is typing
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        document.getElementById('flashcard')?.click();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
    };
    
    // Bind global listener safely
    if (window._studyKeydownHandler) {
      document.removeEventListener('keydown', window._studyKeydownHandler);
    }
    window._studyKeydownHandler = handleKeydown;
    document.addEventListener('keydown', handleKeydown);
  };

  const renderSummary = () => {
    recordStudySession(sessionNew, sessionReview);

    const ratingLabels = ['Again', 'Hard', 'Good', 'Easy'];
    const ratingColors = ['#ef4444', '#f59e0b', '#10b981', '#3B82F6'];

    container.innerHTML = `
      <div class="animate-fade-in-up study-container">
        <div class="card" style="margin-top:var(--space-12);padding:var(--space-8);text-align:center;">
          <div style="font-size:3rem;margin-bottom:var(--space-4);">🎉</div>
          <h1 style="font-size:var(--font-size-2xl);font-weight:700;color:#1f2937;margin-bottom:var(--space-2);">Session Complete!</h1>
          <p style="color:#6b7280;margin-bottom:var(--space-8);">Great job! You reviewed <strong style="color:#3B82F6;">${sessionNew + sessionReview}</strong> card${sessionNew + sessionReview !== 1 ? 's' : ''}</p>

          <div class="grid grid-2" style="max-width:320px;margin:0 auto var(--space-8);gap:var(--space-4);">
            <div style="padding:var(--space-6);background:#f0f9ff;border-radius:var(--border-radius);border-left:4px solid #3B82F6;">
              <div style="font-size:var(--font-size-2xl);font-weight:700;color:#3B82F6;margin-bottom:var(--space-2);">${sessionNew}</div>
              <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">New Cards</div>
            </div>
            <div style="padding:var(--space-6);background:#f9fafb;border-radius:var(--border-radius);border-left:4px solid #8b5cf6;">
              <div style="font-size:var(--font-size-2xl);font-weight:700;color:#8b5cf6;margin-bottom:var(--space-2);">${sessionReview}</div>
              <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Reviewed</div>
            </div>
          </div>

          ${sessionResults.length > 0 ? `
            <div style="text-align:left;max-height:200px;overflow-y:auto;margin-bottom:var(--space-6);">
              ${sessionResults.map(r => `
                <div class="flex items-center justify-between" style="padding:var(--space-2) 0;border-bottom:1px solid var(--color-border);">
                  <span>${escapeHtml(r.word)}</span>
                  <span style="color:${ratingColors[r.rating]};font-weight:var(--font-weight-semibold);font-size:var(--font-size-sm);">${ratingLabels[r.rating]}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="flex gap-3 justify-center">
            <button class="btn btn-primary" id="summary-dashboard">🏠 Dashboard</button>
            <button class="btn btn-secondary" id="summary-study-more">📖 Study More</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('summary-dashboard')?.addEventListener('click', () => navigateTo('/dashboard'));
    document.getElementById('summary-study-more')?.addEventListener('click', () => {
      sessionNew = 0;
      sessionReview = 0;
      sessionResults = [];
      currentIndex = 0;
      cards = [...getDueWords(deckId), ...getNewWords(deckId).slice(0, 10)];
      const seen2 = new Set();
      cards = cards.filter(c => { if (seen2.has(c.id)) return false; seen2.add(c.id); return true; });
      if (cards.length === 0) {
        showToast('No more cards to study!', 'info');
        navigateTo('/dashboard');
      } else {
        renderModeSelect();
      }
    });
  };

  renderModeSelect();
}

function buildBackContent(card) {
  let html = '';
  if (card.meaning) {
    html += `<div style="margin-bottom:var(--space-4);">
      <div class="text-sm text-muted" style="margin-bottom:var(--space-1);">Meaning</div>
      <div style="font-size:var(--font-size-md);font-weight:var(--font-weight-semibold);">${escapeHtml(card.meaning)}</div>
    </div>`;
  }
  if (card.explanation) {
    html += `<div style="margin-bottom:var(--space-4);">
      <div class="text-sm text-muted" style="margin-bottom:var(--space-1);">Explanation</div>
      <div>${escapeHtml(card.explanation)}</div>
    </div>`;
  }
  if (card.example) {
    html += `<div style="margin-bottom:var(--space-4);">
      <div class="text-sm text-muted" style="margin-bottom:var(--space-1);">Example</div>
      <div style="font-style:italic;">"${escapeHtml(card.example)}"</div>
      ${card.exampleMeaning ? `<div class="text-sm text-muted" style="margin-top:var(--space-1);">${escapeHtml(card.exampleMeaning)}</div>` : ''}
    </div>`;
  }
  if (card.synonyms) {
    html += `<div style="margin-bottom:var(--space-3);">
      <div class="text-sm text-muted" style="margin-bottom:var(--space-1);">Synonyms</div>
      <div class="flex flex-wrap gap-2">${card.synonyms.split(',').map(s => `<span class="tag">${escapeHtml(s.trim())}</span>`).join('')}</div>
    </div>`;
  }
  if (card.antonyms) {
    html += `<div>
      <div class="text-sm text-muted" style="margin-bottom:var(--space-1);">Antonyms</div>
      <div class="flex flex-wrap gap-2">${card.antonyms.split(',').map(s => `<span class="tag">${escapeHtml(s.trim())}</span>`).join('')}</div>
    </div>`;
  }
  return html;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
