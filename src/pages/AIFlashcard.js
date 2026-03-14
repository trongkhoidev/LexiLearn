import { el, escapeHtml } from '../utils/helpers.js';
import { db } from '../utils/supabase.js';
import { showToast } from '../components/Toast.js';
import { extractVocabularyFromText } from '../utils/gemini.js';

export async function renderAIFlashcard(container) {
  // Show loading state while fetching decks
  container.innerHTML = `<div class="flex items-center justify-center p-12"><div class="spinner"></div></div>`;

  let decks = [];
  try {
    decks = await db.decks.list();
  } catch (err) {
    console.error('Error fetching decks:', err);
    showToast('Failed to load decks', 'error');
  }

  const content = el('div', { className: 'page-container animate-fade-in' }, [
    el('div', { className: 'page-header' }, [
      el('h1', {}, '✨ AI Flashcard Maker'),
      el('p', { className: 'text-muted' }, 'Paste a text, article, or transcript. AI will extract the most valuable vocabulary and create ready-to-study flashcards.'),
    ]),

    el('div', { className: 'grid grid-1-2 gap-6' }, [
      // Left side: Input form
      el('div', { className: 'card flex flex-col gap-4' }, [
        el('div', { className: 'form-group' }, [
          el('label', {}, 'Source Text'),
          el('textarea', {
            className: 'input',
            id: 'ai-source-text',
            placeholder: 'Paste the text you want to learn from (news article, book excerpt, subtitles...)',
            rows: '12',
            style: { resize: 'vertical' }
          }),
        ]),
        el('button', { className: 'btn btn-primary', id: 'ai-generate-btn' }, '✨ Generate Flashcards')
      ]),

      // Right side: Results & Add to Deck
      el('div', { className: 'card flex flex-col gap-4' }, [
        el('div', { className: 'flex align-center justify-between' }, [
          el('h3', {}, 'Extracted Vocabulary'),
          el('div', { className: 'text-sm text-muted', id: 'ai-results-count' })
        ]),
        el('div', { className: 'form-group' }, [
          el('label', {}, 'Target Deck'),
          el('select', { className: 'input', id: 'ai-target-deck' }, [
            el('option', { value: '' }, 'Select a deck...'),
            ...decks.map(d => el('option', { value: d.id }, d.name))
          ])
        ]),
        // Container for generated cards
        el('div', { className: 'flex flex-col gap-3 relative', id: 'ai-results-container', style: { maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' } }, [
          el('div', { className: 'empty-state p-8' }, [
            el('div', { className: 'text-4xl mb-3' }, '🤖'),
            el('p', { className: 'text-muted text-sm text-center' }, 'Generated cards will appear here after you paste text and click Generate.')
          ])
        ]),
        el('button', { className: 'btn btn-primary w-full', id: 'ai-save-all-btn', style: { display: 'none' } }, 'Save All to Deck')
      ])
    ])
  ]);

  container.innerHTML = '';
  container.appendChild(content);

  // Logic
  const generateBtn = document.getElementById('ai-generate-btn');
  const sourceText = document.getElementById('ai-source-text');
  const resultsContainer = document.getElementById('ai-results-container');
  const resultsCount = document.getElementById('ai-results-count');
  const targetDeck = document.getElementById('ai-target-deck');
  const saveAllBtn = document.getElementById('ai-save-all-btn');

  let generatedWords = [];

  generateBtn.addEventListener('click', async () => {
    const text = sourceText.value.trim();
    if (!text) return showToast('Please enter some text first.', 'info');

    const originalBtnText = generateBtn.innerHTML;
    generateBtn.innerHTML = '<div class="spinner-sm"></div> Generating...';
    generateBtn.disabled = true;
    resultsContainer.innerHTML = '<div class="flex flex-col items-center justify-center p-12 gap-3"><div class="spinner"></div><p class="text-sm text-muted animate-pulse">AI is analyzing your text...</p></div>';
    saveAllBtn.style.display = 'none';
    generatedWords = [];

    try {
      const words = await extractVocabularyFromText(text);
      if (words.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state p-8">
            <div class="text-3xl mb-2">🤔</div>
            <p class="text-muted text-sm text-center">No vocabulary found in this text. Try a different passage.</p>
          </div>`;
        return;
      }

      generatedWords = words;
      resultsCount.textContent = `${words.length} items found`;
      resultsContainer.innerHTML = ''; 

      words.forEach((w) => {
        const cardElem = el('div', { className: 'card p-4 flex flex-col gap-2' }, [
          el('div', { className: 'flex justify-between align-center' }, [
            el('strong', { className: 'text-lg' }, w.word || 'Unknown'),
            el('span', { className: 'badge badge-outline' }, w.partOfSpeech || 'noun')
          ]),
          el('div', { className: 'text-md font-medium text-primary' }, w.meaning || ''),
          el('div', { className: 'text-sm text-muted' }, w.explanation || ''),
          el('div', { className: 'text-xs text-muted italic p-2 bg-slate-50 rounded-md border-l-2 border-slate-300' }, `"${w.example || ''}"`),
        ]);
        resultsContainer.appendChild(cardElem);
      });

      saveAllBtn.style.display = 'block';

    } catch (err) {
      resultsContainer.innerHTML = `<div class="card p-6 border-red-200 bg-red-50 text-red-600 text-center">${escapeHtml(err.message)}</div>`;
      showToast('AI Generation failed', 'error');
    } finally {
      generateBtn.innerHTML = originalBtnText;
      generateBtn.disabled = false;
    }
  });

  saveAllBtn.addEventListener('click', async () => {
    const deckId = targetDeck.value;
    if (!deckId) return showToast('Please select a target deck.', 'info');
    if (generatedWords.length === 0) return;

    saveAllBtn.disabled = true;
    saveAllBtn.innerHTML = '<div class="spinner-sm"></div> Saving...';

    let successCount = 0;
    try {
      // Loop with awaits or use Promise.all
      const promises = generatedWords.map(w => {
        const newWord = {
          word: w.word,
          deck_id: deckId,
          meaning: w.meaning,
          pos: w.partOfSpeech || 'noun',
          explanation: w.explanation || '',
          example_sent: w.example || '',
          synonyms: Array.isArray(w.synonyms) ? w.synonyms : (w.synonyms ? w.synonyms.split(',').map(s => s.trim()) : []),
          antonyms: Array.isArray(w.antonyms) ? w.antonyms : (w.antonyms ? w.antonyms.split(',').map(s => s.trim()) : []),
          srs_level: 0,
          next_review: new Date().toISOString()
        };
        return db.words.create(newWord);
      });

      await Promise.all(promises);
      successCount = generatedWords.length;
      
      showToast(`Successfully saved ${successCount} words to deck!`, 'success');
      
      // Reset
      sourceText.value = '';
      generatedWords = [];
      resultsContainer.innerHTML = '<div class="empty-state p-8"><p class="text-muted text-sm text-center">New vocabulary saved successfully.</p></div>';
      saveAllBtn.style.display = 'none';
      resultsCount.textContent = '';
      
    } catch (e) {
      console.error('Error saving words:', e);
      showToast('Failed to save some words to the database.', 'error');
    } finally {
      saveAllBtn.disabled = false;
      saveAllBtn.innerHTML = 'Save All to Deck';
    }
  });
}
