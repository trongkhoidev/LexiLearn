/* ============================================
   LexiLearn SRS — Spaced Repetition Engine
   ============================================
   SM-2 inspired algorithm with 6 levels.
   Ratings: 0 = Again, 1 = Hard, 2 = Good, 3 = Easy
*/

import { getWords, saveWord } from './store.js';

// Intervals in minutes for each level
const BASE_INTERVALS = [
  10,         // Level 0 → 10 minutes
  1440,       // Level 1 → 1 day
  4320,       // Level 2 → 3 days
  10080,      // Level 3 → 7 days
  20160,      // Level 4 → 14 days
  43200,      // Level 5 → 30 days
];

const RATING = { AGAIN: 0, HARD: 1, GOOD: 2, EASY: 3 };

export { RATING };

/**
 * Process a review and update the word's SRS data.
 * @param {string} wordId
 * @param {number} rating 0-3
 * @returns {object} updated word
 */
export function processReview(wordId, rating) {
  const words = getWords();
  const word = words.find(w => w.id === wordId);
  if (!word) return null;

  let { srsLevel = 0, easeFactor = 2.5, interval = 0, reviewCount = 0, againCount = 0 } = word;

  reviewCount++;

  switch (rating) {
    case RATING.AGAIN:
      srsLevel = 0;
      easeFactor = Math.max(1.3, easeFactor - 0.2);
      interval = BASE_INTERVALS[0];
      againCount++;
      break;

    case RATING.HARD:
      srsLevel = Math.max(0, srsLevel);
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      interval = (BASE_INTERVALS[srsLevel] || BASE_INTERVALS[5]) * 0.8;
      break;

    case RATING.GOOD:
      srsLevel = Math.min(5, srsLevel + 1);
      interval = (BASE_INTERVALS[srsLevel] || BASE_INTERVALS[5]) * easeFactor / 2.5;
      break;

    case RATING.EASY:
      srsLevel = Math.min(5, srsLevel + 2);
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      interval = (BASE_INTERVALS[Math.min(srsLevel, 5)] || BASE_INTERVALS[5]) * easeFactor / 2.5 * 1.3;
      break;
  }

  const now = Date.now();
  const nextReview = now + interval * 60 * 1000;

  const updated = {
    ...word,
    srsLevel,
    easeFactor: Math.round(easeFactor * 100) / 100,
    interval: Math.round(interval),
    nextReview,
    reviewCount,
    againCount,
    lastReview: now,
  };

  saveWord(updated);
  return updated;
}

/**
 * Get words due for review (nextReview <= now).
 * Optionally filter by deckId.
 */
export function getDueWords(deckId = null) {
  const now = Date.now();
  let words = getWords().filter(w => w.nextReview <= now);
  if (deckId) words = words.filter(w => w.deckId === deckId);
  // Sort: most overdue first
  words.sort((a, b) => a.nextReview - b.nextReview);
  return words;
}

/**
 * Get new words (never reviewed).
 */
export function getNewWords(deckId = null) {
  let words = getWords().filter(w => w.reviewCount === 0);
  if (deckId) words = words.filter(w => w.deckId === deckId);
  return words;
}

/**
 * Get difficult words (againCount >= 3 or easeFactor < 1.8).
 */
export function getDifficultWords() {
  return getWords().filter(w => w.againCount >= 3 || w.easeFactor < 1.8);
}

/**
 * Get mastery level for a word.
 */
export function getMasteryLabel(word) {
  if (word.srsLevel >= 5) return 'Mastered';
  if (word.srsLevel >= 3) return 'Intermediate';
  if (word.srsLevel >= 1) return 'Learning';
  return 'New';
}

/**
 * Get mastery distribution for all words.
 */
export function getMasteryDistribution() {
  const words = getWords();
  const dist = { New: 0, Learning: 0, Intermediate: 0, Mastered: 0 };
  words.forEach(w => {
    dist[getMasteryLabel(w)]++;
  });
  return dist;
}

/**
 * Get a human-readable next review string.
 */
export function formatNextReview(nextReview) {
  const now = Date.now();
  const diff = nextReview - now;

  if (diff <= 0) return 'Due now';

  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}
