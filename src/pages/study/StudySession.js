/* ============================================
   LexiLearn — Study Session Controller
   ============================================
*/

import { renderSummary } from './StudySummary.js';
import { renderFlipMode } from './modes/FlipMode.js';
import { renderRecallMode } from './modes/RecallMode.js';
import { renderMeaningMode } from './modes/MeaningMode.js';
import { renderSpeakingSetup } from './modes/SpeakingSetup.js';
import { speakWord } from './StudyUtils.js';

export function renderStudySession(container, { cards, mode, deckSlug }) {
  let currentIndex = 0;
  let isFlipped = false;
  const completedCardIds = new Set();
  const wrongInSession = new Map();

  const sessionState = {
    getCards: () => cards,
    getCurrentIndex: () => currentIndex,
    setFlipped: (val) => { isFlipped = val; },
    isFlipped: () => isFlipped,
    getCompletedIds: () => completedCardIds,
    getWrongMap: () => wrongInSession,
    markCorrect: (id) => completedCardIds.add(id),
    markWrong: (id) => wrongInSession.set(id, (wrongInSession.get(id) || 0) + 1),
  };

  const next = () => {
    if (currentIndex < cards.length - 1) {
      currentIndex++;
      isFlipped = false;
      renderCurrentCard();
    } else {
      finish();
    }
  };

  const prev = () => {
    if (currentIndex > 0) {
      currentIndex--;
      isFlipped = false;
      renderCurrentCard();
    }
  };

  const finish = () => {
    container._studyCleanup();
    renderSummary(container, { 
      completedCardIds, 
      wrongInSession, 
      totalCards: cards.length,
      cards 
    });
  };

  const renderCurrentCard = () => {
    const props = { container, sessionState, next, prev, finish };
    if (mode === 'flip') renderFlipMode(props);
    else if (mode === 'recall') renderRecallMode(props);
    else if (mode === 'meaning') renderMeaningMode(props);
  };

  // Keyboard Shortcuts
  const sessionKeys = (e) => {
    const card = cards[currentIndex];
    const inInput = e.target.closest('input') || e.target.closest('textarea');

    if (e.key === 'ArrowLeft' && !inInput) { e.preventDefault(); prev(); }
    if (e.key === 'ArrowRight' && !inInput) { e.preventDefault(); next(); }
    if (e.key === 'Shift') { e.preventDefault(); speakWord(card?.word); }
  };

  document.addEventListener('keydown', sessionKeys);

  container._studyCleanup = () => {
    document.removeEventListener('keydown', sessionKeys);
    if (container._modeCleanup) container._modeCleanup();
  };

  // Special Startup for Speaking Mode
  if (mode === 'speaking') {
    renderSpeakingSetup(container, { cards, deckSlug });
  } else {
    renderCurrentCard();
  }
}
