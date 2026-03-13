/* ============================================
   LexiLearn Data Store — localStorage wrapper
   ============================================ */

const KEYS = {
  WORDS: 'lexilearn_words',
  DECKS: 'lexilearn_decks',
  STATS: 'lexilearn_stats',
  SETTINGS: 'lexilearn_settings',
};

function load(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('store-change', { detail: { key } }));
}

// ---------- Words ----------

export function getWords() {
  return load(KEYS.WORDS, []);
}

export function getWordById(id) {
  return getWords().find(w => w.id === id) || null;
}

export function saveWord(word) {
  const words = getWords();
  const idx = words.findIndex(w => w.id === word.id);
  if (idx >= 0) {
    words[idx] = { ...words[idx], ...word, updatedAt: Date.now() };
  } else {
    words.push({
      ...word,
      id: word.id || uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      // SRS defaults
      srsLevel: 0,
      easeFactor: 2.5,
      interval: 0,
      nextReview: Date.now(),
      reviewCount: 0,
      againCount: 0,
      lastReview: null,
    });
  }
  save(KEYS.WORDS, words);
  return words;
}

export function deleteWord(id) {
  const words = getWords().filter(w => w.id !== id);
  save(KEYS.WORDS, words);
  return words;
}

export function importWords(wordArray) {
  const words = getWords();
  wordArray.forEach(w => {
    words.push({
      ...w,
      id: w.id || uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      srsLevel: 0,
      easeFactor: 2.5,
      interval: 0,
      nextReview: Date.now(),
      reviewCount: 0,
      againCount: 0,
      lastReview: null,
    });
  });
  save(KEYS.WORDS, words);
}

// ---------- Decks ----------

export function getDecks() {
  return load(KEYS.DECKS, []);
}

export function getDeckById(id) {
  return getDecks().find(d => d.id === id) || null;
}

export function saveDeck(deck) {
  const decks = getDecks();
  const idx = decks.findIndex(d => d.id === deck.id);
  if (idx >= 0) {
    decks[idx] = { ...decks[idx], ...deck, updatedAt: Date.now() };
  } else {
    decks.push({
      ...deck,
      id: deck.id || uid(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  save(KEYS.DECKS, decks);
  return decks;
}

export function deleteDeck(id) {
  // Also remove deckId from words in that deck
  const words = getWords().map(w => {
    if (w.deckId === id) return { ...w, deckId: null };
    return w;
  });
  save(KEYS.WORDS, words);
  const decks = getDecks().filter(d => d.id !== id);
  save(KEYS.DECKS, decks);
  return decks;
}

// ---------- Stats ----------

export function getStats() {
  return load(KEYS.STATS, {
    dailySessions: {},  // { '2026-03-13': { studied: 10, new: 3, reviewed: 7 } }
    streak: 0,
    lastStudyDate: null,
    totalWordsStudied: 0,
  });
}

export function recordStudySession(newCount, reviewCount) {
  const stats = getStats();
  const today = todayKey();
  if (!stats.dailySessions[today]) {
    stats.dailySessions[today] = { studied: 0, newWords: 0, reviewed: 0 };
  }
  stats.dailySessions[today].studied += newCount + reviewCount;
  stats.dailySessions[today].newWords += newCount;
  stats.dailySessions[today].reviewed += reviewCount;
  stats.totalWordsStudied += newCount + reviewCount;

  // Streak calculation
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = dateKey(yesterday);

  if (stats.lastStudyDate === today) {
    // Already studied today, no change
  } else if (stats.lastStudyDate === yesterdayStr || !stats.lastStudyDate) {
    stats.streak += 1;
  } else {
    stats.streak = 1;
  }
  stats.lastStudyDate = today;

  save(KEYS.STATS, stats);
}

// ---------- Settings ----------

export function getSettings() {
  return load(KEYS.SETTINGS, {
    geminiApiKey: '',
  });
}

export function saveSettings(settings) {
  const current = getSettings();
  const updated = { ...current, ...settings };
  save(KEYS.SETTINGS, updated);
  return updated;
}

export function getApiKey() {
  return getSettings().geminiApiKey;
}

export function saveApiKey(key) {
  saveSettings({ geminiApiKey: key });
}

// ---------- Helpers ----------

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function todayKey() {
  return dateKey(new Date());
}

function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

export function onStoreChange(cb) {
  window.addEventListener('store-change', cb);
  return () => window.removeEventListener('store-change', cb);
}

export { uid, todayKey, dateKey };
