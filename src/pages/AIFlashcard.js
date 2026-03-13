import { el, escapeHtml } from '../utils/helpers.js';
import { getDecks, saveWord } from '../data/store.js';
import { showToast } from '../components/Toast.js';
import { extractVocabularyFromText } from '../utils/gemini.js';

export function renderAIFlashcard(container) {
  const content = el('div', { className: 'page-container' }, [
    el('div', { className: 'page-header' }, [
      el('h1', {}, '✨ AI Flashcard Maker'),
      el('p', { className: 'text-muted' }, 'Paste a text, article, or transcript. AI will extract the most useful vocabulary and create ready-to-study flashcards.'),
    ]),

    el('div', { className: 'grid grid-1-2 gap-4' }, [
      // Left side: Input form
      el('div', { className: 'card flex flex-col gap-4' }, [
        el('div', { className: 'form-group' }, [
          el('label', {}, 'Source Text'),
          el('textarea', {
            className: 'input',
            id: 'ai-source-text',
            placeholder: 'Paste the text you want to learn from...',
            rows: '10'
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
          el('label', {}, 'Target Deck for saving'),
          el('select', { className: 'input', id: 'ai-target-deck' }, [
            el('option', { value: '' }, 'Select a deck...'),
            ...getDecks().map(d => el('option', { value: d.id }, d.name))
          ])
        ]),
        // Container for generated cards
        el('div', { className: 'flex flex-col gap-2 relative', id: 'ai-results-container', style: { maxHeight: '500px', overflowY: 'auto' } }, [
          el('div', { className: 'empty-state p-4' }, [
            el('div', { className: 'text-4xl mb-2' }, '🤖'),
            el('p', { className: 'text-muted text-sm text-center' }, 'Generated cards will appear here.')
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
    if (!text) return showToast('Please enter some text first.', 'error');

    const originalBtnText = generateBtn.innerHTML;
    generateBtn.innerHTML = '⏳ Generating...';
    generateBtn.disabled = true;
    resultsContainer.innerHTML = '<div class="flex justify-center p-8"><span class="badge badge-outline">🤖 AI is thinking...</span></div>';
    saveAllBtn.style.display = 'none';
    generatedWords = [];

    try {
      const words = await extractVocabularyFromText(text);
      if (words.length === 0) {
        resultsContainer.innerHTML = '<p class="text-muted text-center p-4">No vocabulary found in this text.</p>';
        return;
      }

      generatedWords = words;
      resultsCount.textContent = `${words.length} words found`;
      resultsContainer.innerHTML = ''; // clear loading

      words.forEach((w) => {
        const cardElem = el('div', { className: 'p-3 border-b flex flex-col gap-1' }, [
          el('div', { className: 'flex justify-between align-center' }, [
            el('strong', { className: 'text-lg' }, w.word || 'Unknown'),
            el('span', { className: 'badge badge-outline text-xs' }, w.partOfSpeech || '')
          ]),
          el('div', { className: 'text-sm text-primary' }, w.meaning || ''),
          el('div', { className: 'text-sm text-muted mt-1' }, w.explanation || ''),
          el('div', { className: 'text-xs text-muted mt-1 italic' }, `"${w.example || ''}"`),
        ]);
        resultsContainer.appendChild(cardElem);
      });

      saveAllBtn.style.display = 'block';

    } catch (err) {
      resultsContainer.innerHTML = `<p class="text-red text-center p-4">Error: ${escapeHtml(err.message)}</p>`;
      showToast('Failed to generate flashcards.', 'error');
    } finally {
      generateBtn.innerHTML = originalBtnText;
      generateBtn.disabled = false;
    }
  });

  saveAllBtn.addEventListener('click', () => {
    const deckId = targetDeck.value;
    if (!deckId) return showToast('Please select a target deck first.', 'error');
    if (generatedWords.length === 0) return;

    let successCount = 0;
    generatedWords.forEach(w => {
      // Map AI fields to our app's word schema
      const newWord = {
        word: w.word,
        deckId: deckId,
        meaning: w.meaning,
        partOfSpeech: w.partOfSpeech || 'noun',
        phonetic: '', // Left blank as it requires dictionary API, or we could have asked Gemini
        explanation: w.explanation || '',
        example: w.example || '',
        synonyms: w.synonyms || '',
        antonyms: w.antonyms || '',
        notes: 'Generated by AI',
        tags: 'AI'
      };
      
      try {
        saveWord(newWord);
        successCount++;
      } catch (e) {
        console.error('Error saving word:', e);
      }
    });

    if (successCount > 0) {
      showToast(`Successfully saved ${successCount} words to deck.`, 'success');
      // clear form
      sourceText.value = '';
      generatedWords = [];
      resultsContainer.innerHTML = '<div class="empty-state p-4"><p class="text-muted text-sm text-center">Generated cards will appear here.</p></div>';
      saveAllBtn.style.display = 'none';
      resultsCount.textContent = '';
    }
  });

}
