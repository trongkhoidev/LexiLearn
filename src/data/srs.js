import { db } from '../utils/supabase.js';

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
 * Process a review and update the word's SRS data in the database.
 */
export async function processReview(wordId, rating) {
  const word = await db.words.getById(wordId);
  if (!word) return null;

  let srs_level = Number(word.srs_level) || 0;
  let ease_factor = Number(word.ease_factor) || 2.5;
  let review_count = Number(word.review_count) || 0;
  let again_count = Number(word.again_count) || 0;

  review_count++;

  let interval = 0;
  switch (rating) {
    case RATING.AGAIN:
      srs_level = 0;
      ease_factor = Math.max(1.3, ease_factor - 0.2);
      interval = BASE_INTERVALS[0];
      again_count++;
      break;

    case RATING.HARD:
      srs_level = Math.max(0, srs_level);
      ease_factor = Math.max(1.3, ease_factor - 0.15);
      interval = (BASE_INTERVALS[srs_level] || BASE_INTERVALS[5]) * 0.8;
      break;

    case RATING.GOOD:
      srs_level = Math.min(5, srs_level + 1);
      interval = (BASE_INTERVALS[srs_level] || BASE_INTERVALS[5]) * ease_factor / 2.5;
      break;

    case RATING.EASY:
      srs_level = Math.min(5, srs_level + 2);
      ease_factor = Math.min(3.0, ease_factor + 0.15);
      interval = (BASE_INTERVALS[Math.min(srs_level, 5)] || BASE_INTERVALS[5]) * ease_factor / 2.5 * 1.3;
      break;
  }

  const now = new Date();
  const nextReview = new Date(now.getTime() + interval * 60 * 1000).toISOString();

  const updated = {
    srs_level,
    ease_factor: Math.round(ease_factor * 100) / 100,
    next_review: nextReview,
    last_review: now.toISOString(),
    review_count,
    again_count,
  };

  return await db.words.update(wordId, updated);
}

/**
 * Get mastery level for a word.
 */
export function getMasteryLabel(srsLevel) {
  if (srsLevel >= 5) return 'Mastered';
  if (srsLevel >= 3) return 'Intermediate';
  if (srsLevel >= 1) return 'Learning';
  return 'New';
}

/**
 * Get mastery distribution from a list of words.
 */
export function getMasteryDistribution(words) {
  const dist = { New: 0, Learning: 0, Intermediate: 0, Mastered: 0 };
  words.forEach(w => {
    dist[getMasteryLabel(w.srs_level || 0)]++;
  });
  return dist;
}

/**
 * Format next review time.
 */
export function formatNextReview(nextReviewStr) {
  if (!nextReviewStr) return 'New';
  const nextReview = new Date(nextReviewStr).getTime();
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
