import { db } from '../utils/supabase.js';
import { processReview, RATING } from '../data/srs.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/Toast.js';
import { generateDistractors, generateSpeakingPrompt, evaluateCustomSpeaking, validateAnswer } from '../utils/gemini.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightWordInSentence(sentence, word) {
  if (!sentence || !word) return escapeHtml(sentence || '');
  const escaped = escapeRegex(word);
  const regex = new RegExp(`(${escaped})`, 'gi');
  return escapeHtml(sentence).replace(regex, '<span class="study-word-highlight">$1</span>');
}

function speakWord(word) {
  if (!word || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word.trim());
  u.lang = 'en-US';
  u.rate = 0.9;
  speechSynthesis.speak(u);
}

async function fetchUsageAnalysis(word, sentence, cardId, targetSelector) {
  const el = document.querySelector(targetSelector);
  if (!el || !sentence?.trim()) return;
  try {
    const apiKey = (() => { try { return JSON.parse(localStorage.getItem('lexilearn_settings') || '{}').geminiApiKey; } catch { return ''; } })() || 'AIzaSyDv5yQ04GH5gqZqIjYGUoSHuHBn-i5O-0M';
    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Word: "${word}". Example: "${sentence}". In one short Vietnamese sentence, explain how "${word}" is used in this example. Reply with only that explanation, no quotes or preamble.` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 150 }
      })
    });
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text && document.querySelector(targetSelector)) document.querySelector(targetSelector).innerHTML = escapeHtml(text);
  } catch {
    if (document.querySelector(targetSelector)) document.querySelector(targetSelector).innerHTML = '<span class="text-muted">Không thể tải phân tích.</span>';
  }
}

const MODES = [
  { id: 'flip', label: 'Basic Flip', desc: 'Xem từ, lật thẻ để xem nghĩa', short: 'Flip', icon: '🔄' },
  { id: 'recall', label: 'Recall', desc: 'Chọn từ còn thiếu vào câu ví dụ', short: 'Recall', icon: '✍️' },
  { id: 'meaning', label: 'Meaning Recall', desc: 'Hiểu nghĩa, đoán từ tiếng Anh', short: 'Meaning', icon: '🧠' },
  { id: 'speaking', label: 'Speaking', desc: 'Phát âm và luyện nói từ vựng', short: 'Speak', icon: '🎙️' },
];

export async function renderStudy(container, params) {
  const deckSlug = params.slug;
  const isAll = deckSlug === 'all';
  
  container.innerHTML = `<div class="flex flex-col items-center justify-center p-20"><div class="spinner"></div><p class="mt-4 text-muted">Loading cards...</p></div>`;

  try {
    let deckId = null;
    if (!isAll) {
      const deck = await db.decks.getBySlug(deckSlug);
      if (!deck) throw new Error('Deck not found');
      deckId = deck.id;
    }
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
    const completedCardIds = new Set();
    const wrongInSession = new Map();
    let currentOptions = []; // Holds AI generated MC options
    
    // Speaking mode states
    let recognition = null;
    let isRecording = false;
    let isPaused = false;
    let speakingTranscript = '';
    let savedTranscriptChunks = [];
    let customSpeakingQuestions = [];
    let customSpeakingApiKey = '';
    let currentCustomQIndex = 0;

    // Define core functions in renderStudy scope for keydown access
    const flipToBack = () => {
      const card = cards[currentIndex];
      const fcard = document.getElementById('fcard');
      if (!card || !fcard || isFlipped) return;
      isFlipped = true;
      fcard.classList.add('flipped');
      if (card.example_sent?.trim()) {
        const usageId = `#study-usage-${(card.id || '').toString().replace(/\s/g, '-')}`;
        fetchUsageAnalysis(card.word, card.example_sent, card.id, usageId);
      }
      if (mode === 'flip') {
        setTimeout(() => {
          const ratingArea = document.getElementById('flip-rating-area');
          if (ratingArea) ratingArea.style.display = 'flex';
        }, 350);
      }
    };

    const flipToFront = () => {
      const fcard = document.getElementById('fcard');
      if (!fcard || !isFlipped) return;
      isFlipped = false;
      fcard.classList.remove('flipped');
      const ratingArea = document.getElementById('flip-rating-area');
      if (ratingArea) ratingArea.style.display = 'none';
      if (recognition && isRecording) { toggleRecording(); } // Stop recording if flipping back
    };

    const toggleFlip = () => {
      if (isFlipped) flipToFront();
      else flipToBack();
    };

    const handleAnswerResult = (isCorrect, feedbackHtml, rawWord) => {
      const card = cards[currentIndex];
      const fb = document.getElementById('feedback');
      if (fb) fb.innerHTML = isCorrect
        ? `<span class="text-green-600 font-bold text-lg">✅ Đúng rồi!</span> ${feedbackHtml ? `<p class="text-sm mt-1 text-green-700">${feedbackHtml}</p>` : ''}`
        : `<span class="text-red-600 font-bold text-lg">❌ Đáp án: <em>${escapeHtml(rawWord)}</em></span> ${feedbackHtml ? `<p class="text-sm mt-1 text-red-700">${feedbackHtml}</p>` : ''}`;
        
      const fcard = document.getElementById('fcard');
      if (fcard) fcard.classList.add(isCorrect ? 'correct-glow' : 'incorrect-glow');
        
      if (isCorrect) {
        processReview(card.id, RATING.GOOD).catch(() => {});
        db.progress.logReview(card.id, 2, true).catch(() => {});
        completedCardIds.add(card.id);
      } else {
        processReview(card.id, RATING.AGAIN).catch(() => {});
        db.progress.logReview(card.id, 0, false).catch(() => {});
        wrongInSession.set(card.id, (wrongInSession.get(card.id) || 0) + 1);
      }
      flipToBack();
      const nextArea = document.getElementById('post-check-next');
      if (nextArea) nextArea.style.display = 'flex';
      
      // Disable inputs based on mode
      const inputEl = document.getElementById('ans-in');
      if (inputEl) inputEl.disabled = true;
      const checkBtn = document.getElementById('check-btn');
      if (checkBtn) checkBtn.disabled = true;
      document.querySelectorAll('.mc-option').forEach(btn => btn.disabled = true);
      const micBtn = document.getElementById('mic-btn');
      if (micBtn) micBtn.disabled = true;
    };

    const runMultipleChoiceCheck = (selectedVal, btnEl) => {
      const card = cards[currentIndex];
      if (!card) return;
      
      const isCorrect = (mode === 'recall' && selectedVal === card.word) || 
                        (mode === 'meaning' && selectedVal === card.meaning);
      
      document.querySelectorAll('.mc-option').forEach(btn => {
        if (btn.dataset.val === (mode === 'recall' ? card.word : card.meaning)) {
          btn.classList.add('correct');
        } else if (btn === btnEl && !isCorrect) {
          btn.classList.add('incorrect');
        }
      });
      
      handleAnswerResult(isCorrect, '', mode === 'recall' ? card.word : card.meaning);
    };

    const runCheck = async () => {
      const card = cards[currentIndex];
      const inputEl = document.getElementById('ans-in');
      if (!card || !inputEl) return;
      
      const val = inputEl.value.trim();
      const checkBtn = document.getElementById('check-btn');
      if (checkBtn) { checkBtn.disabled = true; checkBtn.innerHTML = '<div class="spinner-sm"></div> AI Checking...'; }
      
      try {
        const context = mode === 'recall' ? card.example_sent : card.meaning;
        const validation = await validateAnswer(val, card.word, context || '');
        handleAnswerResult(validation.isCorrect, escapeHtml(validation.feedback), card.word);
      } catch (err) {
        // Fallback
        const isCorrect = val.toLowerCase() === card.word.toLowerCase();
        handleAnswerResult(isCorrect, '', card.word);
      }
    };
    
    // Speaking mode functions
    const initSpeechRecognition = () => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        return null; // Not supported
      }
      const SpeechReg = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechReg();
      rec.continuous = true; // Set to true to allow natural pauses
      rec.interimResults = true;
      rec.lang = 'en-US';
      return rec;
    };
    
    let silenceTimer = null;

    const stopRecordingSequence = () => {
      if (!isRecording) return;
      if (silenceTimer) clearTimeout(silenceTimer);
      if (recognition) recognition.stop();
      isRecording = false;
      isPaused = false; // Reset pause state
      
      const micBtn = document.getElementById('mic-btn');
      if (micBtn) micBtn.classList.remove('recording');
      
      const pauseBtn = document.getElementById('pause-btn');
      if (pauseBtn) { pauseBtn.classList.add('hidden'); pauseBtn.innerHTML = '⏸️'; pauseBtn.classList.remove('bg-pink-100'); }
      
      const statusEl = document.getElementById('recording-status');
      if (statusEl) statusEl.classList.add('hidden');

      // Submit the transcript. We add a slight delay to let Web Speech finalize.
      setTimeout(() => evaluateSpeakingAnswer(), 500);
    };

    const toggleRecording = () => {
      const micBtn = document.getElementById('mic-btn');
      const pauseBtn = document.getElementById('pause-btn');
      const statusEl = document.getElementById('recording-status');
      const transcriptEl = document.getElementById('transcript');
      
      if (isRecording) {
        stopRecordingSequence();
      } else {
        if (!recognition) recognition = initSpeechRecognition();
        
        if (!recognition) {
          showToast('Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng thử Chrome/Edge.', 'error');
          return;
        }
        
        speakingTranscript = '';
        if (!isPaused) {
          savedTranscriptChunks = []; // Clean state if NEW recording
        }
        
        if (transcriptEl && !isPaused) transcriptEl.textContent = 'Đang nghe...';
        if (pauseBtn) pauseBtn.classList.remove('hidden');
        if (statusEl) {
          statusEl.classList.remove('hidden');
          statusEl.innerHTML = '🔴 RECORDING';
        }
        
        recognition.onresult = (event) => {
          if (silenceTimer) clearTimeout(silenceTimer);
          
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              speakingTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          
          const fullText = (speakingTranscript + interimTranscript).trim().toLowerCase();
          
          if (transcriptEl) {
            transcriptEl.textContent = fullText;
            transcriptEl.classList.remove('empty');
          }

          // Smart Stop Phrases
          const stopPhrases = ["i'm done", "i am done", "that's it", "that is it", "that's all", "thank you", "i have finished"];
          const endsWithStop = stopPhrases.some(phrase => fullText.endsWith(phrase));
          
          if (endsWithStop) {
            console.log("Stop phrase detected. Auto-stopping recording.");
            stopRecordingSequence();
            return;
          }

          // Set silence timeout (stop if no new words for 4 seconds)
          if (fullText.length > 0) {
            silenceTimer = setTimeout(() => {
              console.log("Silence limit reached. Auto-stopping recording.");
              stopRecordingSequence();
            }, 4000);
          }
        };
        
        recognition.onerror = (event) => {
          console.error("Speech recognition error", event.error);
          isRecording = false;
          if (micBtn) micBtn.classList.remove('recording');
          if (transcriptEl && !speakingTranscript) transcriptEl.textContent = '(Lỗi mic, thử lại nhé)';
        };
        
        recognition.onend = () => {
          // In continuous mode, Chrome might stop unexpectedly.
          // We only process if it was an explicit stop or a silence auto-stop handled above.
          // But if it naturally ends without our explicit stop trigger and we have text, we submit.
          if (isRecording) {
            stopRecordingSequence();
          }
        };

        try {
          recognition.start();
          isRecording = true;
          if (micBtn) micBtn.classList.add('recording');
        } catch (e) {
          console.error(e);
          showToast('Lỗi truy cập Microphone.', 'error');
        }
      }
    };

    const evaluateSpeakingAnswer = async () => {
      const fbContainer = document.getElementById('speaking-feedback-container');
      const nextArea = document.getElementById('post-check-next');
      
      const fullTranscript = [...savedTranscriptChunks, speakingTranscript].join(' ').trim();
      
      if (!fullTranscript) {
        showToast('Bạn chưa nói gì cả!', 'info');
        return;
      }
      
      if (fbContainer) {
        fbContainer.innerHTML = `<div class="ai-loading"><div class="spinner-large"></div><p>Examiner AI đang chấm điểm...</p></div>`;
      }
      
      try {
        const question = customSpeakingQuestions[currentCustomQIndex];
        const deckVocabFull = cards.map(c => c.word);
        const result = await evaluateCustomSpeaking(fullTranscript, question, customSpeakingApiKey, deckVocabFull);
        
        let overallBand = result.overall || 'N/A';
        const c = result.criteria || {};

        if (overallBand === 'N/A' && c.FC?.score) {
          const avg = (parseFloat(c.FC.score || 0) + parseFloat(c.LR?.score || 0) + parseFloat(c.GRA?.score || 0) + parseFloat(c.P?.score || 0)) / 4;
          overallBand = avg.toFixed(1);
        }

        const icons = { FC: '🗣️', LR: '📚', GRA: '✍️', P: '🎤' };

        if (fbContainer) {
          fbContainer.innerHTML = `
            <div class="speaking-feedback-card animate-fade-in-up mt-4 bg-white rounded-2xl p-6 shadow-lg border border-pink-100">
              <div class="flex items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-red-400 text-white flex items-center justify-center font-extrabold text-xl shadow-md border-2 border-white shrink-0">
                  ${overallBand}
                </div>
                <div>
                  <h3 class="font-bold text-gray-800 text-lg flex items-center gap-1">IELTS Overall Score</h3>
                  <p class="text-xs text-muted">Báo cáo chi tiết từ Examiner AI</p>
                </div>
              </div>
              
              <!-- Criteria Grid -->
              <div class="grid grid-2-responsive gap-3 mb-6">
                ${['FC', 'LR', 'GRA', 'P'].map(key => {
                  const item = c[key] || { score: 0, feedback: '' };
                  const label = key === 'FC' ? 'Sự trôi chảy' : key === 'LR' ? 'Từ vựng' : key === 'GRA' ? 'Ngữ pháp' : 'Phát âm';
                  return `
                    <div class="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-sm transition-shadow">
                      <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-gray-700 text-xs flex items-center gap-1">${icons[key] || '📊'} ${label}</span>
                        <span class="text-xs font-bold px-2 py-0.5 bg-pink-50 text-pink-600 rounded border border-pink-100">${item.score}/9.0</span>
                      </div>
                      <p class="text-xxs text-gray-500 leading-relaxed mt-1" style="font-size: 0.75rem;">${escapeHtml(item.feedback)}</p>
                    </div>
                  `;
                }).join('')}
              </div>

              <!-- Vocab Checklist -->
              ${result.vocab_used?.length > 0 ? `
                <div class="mb-4">
                  <h4 class="text-xs font-bold text-green-600 mb-2 flex items-center gap-1">✅ Từ vựng Máy thẻ được dùng:</h4>
                  <div class="flex flex-wrap gap-1">
                    ${result.vocab_used.map(v => `<span class="px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-xs font-medium border border-green-100">${escapeHtml(v)}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              <!-- Expansion 5W1H Advice -->
              ${result.expansion_5w1h?.length > 0 ? `
                <div class="bg-gradient-to-r from-pink-50 to-white rounded-xl p-4 border border-pink-100 mb-4">
                  <h4 class="text-xs font-bold text-pink-700 mb-2 flex items-center gap-1">💡 Gợi ý phát triển ý (5W1H):</h4>
                  <ul class="list-disc list-inside space-y-1 text-xs text-pink-900 leading-relaxed">
                    ${result.expansion_5w1h.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}

              <!-- Retry Container -->
              <div class="flex justify-center pt-3 border-t border-gray-50">
                <button id="retry-speaking-btn" class="btn btn-sm btn-ghost text-pink-600 hover:bg-pink-50 font-bold flex items-center gap-1 text-xs">
                  🔄 Luyện lại câu này
                </button>
              </div>
              
            </div>
          `;

          // Attach listener immediately
          document.getElementById('retry-speaking-btn')?.addEventListener('click', () => {
             speakingTranscript = '';
             savedTranscriptChunks = [];
             isPaused = false;
             if (fbContainer) fbContainer.innerHTML = '';
             const micBtn = document.getElementById('mic-btn');
             if (micBtn) { micBtn.style.display = 'flex'; micBtn.classList.remove('recording'); }
             const pauseBtn = document.getElementById('pause-btn');
             if (pauseBtn) { pauseBtn.classList.add('hidden'); pauseBtn.innerHTML = '⏸️'; }
             const statusEl = document.getElementById('recording-status');
             if (statusEl) statusEl.classList.add('hidden');
             const transcriptEl = document.getElementById('transcript');
             if (transcriptEl) { transcriptEl.textContent = 'Transcript sẽ hiện ở đây...'; transcriptEl.classList.add('empty'); }
             if (nextArea) nextArea.style.display = 'none';
          });
        }
        
        // Hide mic, show next button
        const micBtn = document.getElementById('mic-btn');
        if (micBtn) micBtn.style.display = 'none';
        
        const pauseBtn = document.getElementById('pause-btn');
        if (pauseBtn) pauseBtn.style.display = 'none';

        if (nextArea) nextArea.style.display = 'flex';
        // Auto stop TTS if playing
        speechSynthesis.cancel();
        
      } catch (err) {
        console.error(err);
        if (err.message && err.message.includes('Quota')) {
           markKeyFailed(customSpeakingApiKey);
           if (fbContainer) {
              fbContainer.innerHTML = `
                <div class="speaking-feedback-card flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 text-center animate-fade-in-up mt-4">
                  <div class="text-2xl mb-2">😭</div>
                  <h3 class="text-lg font-bold text-red-600 mb-2">Hết Quota Máy Chấm</h3>
                  <p class="text-sm text-red-700 leading-relaxed max-w-sm mb-4">
                    API Key bạn đang dùng đã hết lượt sử dụng (Lỗi 429). Hệ thống đã đánh dấu lỗi Key này.
                  </p>
                  <button class="btn btn-sm btn-primary px-6" onclick="document.getElementById('exit-interview').click()">
                    Quay lại chọn Key Khác →
                  </button>
                </div>
              `;
           }
        } else {
           if (fbContainer) fbContainer.innerHTML = `<p class="text-red-500 font-medium text-center">Lỗi: ${escapeHtml(err.message)}</p>`;
        }
        if (nextArea) nextArea.style.display = 'flex';
      }
    };

    const goPrev = () => {
      if (currentIndex <= 0) return;
      currentIndex--;
      if (recognition && isRecording) toggleRecording();
      renderCard();
    };

    const goNext = () => {
      const card = cards[currentIndex];
      if (currentIndex >= cards.length - 1) return;
      if (mode === 'flip' && isFlipped && card) {
        processReview(card.id, RATING.GOOD).catch(() => {});
        db.progress.logReview(card.id, 2, true).catch(() => {});
        completedCardIds.add(card.id);
      }
      currentIndex++;
      if (recognition && isRecording) toggleRecording();
      renderCard();
    };

    const studyNavKeys = (e) => {
      const inInput = e.target.closest('input') || e.target.closest('textarea');
      const card = cards[currentIndex];
      if (!card) return;

      if (inInput) {
        if (e.key === 'Enter') {
          e.preventDefault();
          runCheck();
        }
        return;
      }

      if (e.key === 'ArrowLeft') { goPrev(); e.preventDefault(); return; }
      if (e.key === 'ArrowRight') { goNext(); e.preventDefault(); return; }
      if (e.key === 'Escape') { flipToFront(); e.preventDefault(); return; }
      if (e.key === 'Shift' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { 
        speakWord(card.word); 
        // Visual feedback
        document.querySelectorAll('.study-speak-btn').forEach(btn => {
          btn.classList.add('pulse-active');
          setTimeout(() => btn.classList.remove('pulse-active'), 300);
        });
        e.preventDefault(); 
        return; 
      }
      
      if (e.key === 'Backspace' || e.key === 'Enter' || e.key === ' ') {
        // Prevent default button activation for Space/Enter
        e.preventDefault();
        
        // Handle flipping generic across all modes
        if (isFlipped && e.key === 'Backspace') {
           flipToFront();
        } else if (!isFlipped && (e.key === 'Enter' || e.key === ' ')) {
           if (mode === 'flip') {
               flipToBack();
           } else if (mode === 'recall' || mode === 'meaning' || mode === 'speaking') {
               // Ignore Enter/Space flipping for meaning/recall/speaking on the front side
               // User needs to either click an option or wait for evaluation
           }
        } else if (isFlipped && (e.key === 'Enter' || e.key === ' ')) {
           if (mode === 'flip') {
               flipToFront();
           }
        }
      }
    };

    if (container._studyNavKeys) {
      document.removeEventListener('keydown', container._studyNavKeys);
    }
    container._studyNavKeys = studyNavKeys;
    document.addEventListener('keydown', studyNavKeys);

    const renderModeSelect = () => {
      container.innerHTML = `
        <div class="animate-fade-in-up study-container max-w-4xl mx-auto">
          <div class="text-center mb-16">
            <h1 class="text-4xl font-extrabold mb-4" style="background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">Choose Study Mode</h1>
            <p class="text-lg text-muted">You have <span class="font-bold text-accent">${cards.length}</span> cards ready to review. Nhấn <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> để chọn chế độ.</p>
          </div>
          <div class="grid grid-3-responsive gap-6">
            ${MODES.map((m, i) => `
              <div class="mode-card mode-card-${m.id} cursor-pointer" data-mode="${m.id}" role="button" tabindex="0">
                <div class="mode-card-inner">
                  <span class="mode-card-num">${i + 1}</span>
                  <div class="mode-icon">${m.icon}</div>
                  <h3 class="mode-label">${m.label}</h3>
                  <p class="mode-desc">${m.desc}</p>
                  <div class="mode-arrow">→</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      const handleModeKey = (e) => {
        if (e.key === '1') { mode = 'flip'; document.removeEventListener('keydown', handleModeKey); renderCard(); }
        if (e.key === '2') { mode = 'recall'; document.removeEventListener('keydown', handleModeKey); renderCard(); }
        if (e.key === '3') { mode = 'meaning'; document.removeEventListener('keydown', handleModeKey); renderCard(); }
        if (e.key === '4') { mode = 'speaking'; document.removeEventListener('keydown', handleModeKey); renderSpeakingSetup(); }
      };

      container.querySelectorAll('.mode-card').forEach(el => {
        el.addEventListener('click', () => {
          document.removeEventListener('keydown', handleModeKey);
          mode = el.dataset.mode;
          if (mode === 'speaking') {
            renderSpeakingSetup();
          } else {
            renderCard();
          }
        });
      });
      document.addEventListener('keydown', handleModeKey);
    };

    const SPEAKING_API_KEYS = [
      { id: '1', name: 'Gemini Key 1', key: 'AIzaSyDnScRM-sf-ZxRpXqtezIe8tVGQqYR-nCI' },
      { id: '2', name: 'Gemini Key 2', key: 'AIzaSyAhPPPcszeepv0NnVh6lB5QBXarYS2JdwE' },
      { id: '3', name: 'Gemini Key 3', key: 'AIzaSyDv5yQ04GH5gqZqIjYGUoSHuHBn-i5O-0M' },
      { id: '4', name: 'Gemini Key 4', key: 'AIzaSyDoTi1ezvmMPjl-XgIHviaRxcPUtFsNct4' },
      { id: '5', name: 'Gemini Key 5', key: 'AIzaSyA-85K3L3BiJjpcu4Siu-xxQT0-dYXKBO8' }
    ];

    const getFailedKeys = () => {
      try {
        return JSON.parse(localStorage.getItem('lexilearn_failed_keys') || '[]');
      } catch (e) {
        return [];
      }
    };

    const markKeyFailed = (apiKey) => {
      const failed = getFailedKeys();
      if (!failed.includes(apiKey)) {
        failed.push(apiKey);
        localStorage.setItem('lexilearn_failed_keys', JSON.stringify(failed));
      }
    };

    const renderSpeakingSetup = () => {
      const failedKeys = getFailedKeys();
      const optionsHtml = SPEAKING_API_KEYS.map(k => {
        const isFailed = failedKeys.includes(k.key);
        const failText = isFailed ? ' (Lỗi/Hết Quota)' : ' (Sẵn sàng)';
        return `<option value="${k.key}" ${isFailed ? 'disabled' : ''}>${k.name}${failText}</option>`;
      }).join('');

      container.innerHTML = `
        <div class="animate-fade-in-up study-container max-w-2xl mx-auto">
          <div class="mb-8">
            <button class="btn btn-ghost btn-sm text-red-500 mb-4" id="exit-setup">← Back to Modes</button>
            <h1 class="text-3xl font-extrabold mb-2 text-pink-600">🎙️ Mock Interview Setup</h1>
            <p class="text-muted">Nhập danh sách câu hỏi Speaking bạn muốn luyện tập hôm nay theo định dạng chuẩn.</p>
          </div>
          
          <div class="card p-6 mb-6">
            <div class="flex justify-between items-end mb-4">
              <label class="form-label font-bold text-gray-800 m-0">Danh sách câu hỏi phỏng vấn</label>
              <div class="flex gap-2">
                <button id="import-bulk-btn" class="btn btn-sm btn-outline text-gray-600 hover:bg-gray-100">📋 Nhập hàng loạt</button>
                <button id="add-question-btn" class="btn btn-sm btn-ghost text-pink-500 hover:bg-pink-50">+ Thêm câu hỏi</button>
              </div>
            </div>
            
            <!-- Bulk Import Area -->
            <div id="bulk-import-area" class="hidden mb-4 bg-gray-50 p-4 rounded-xl border border-gray-200 animate-fade-in-down">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-bold text-gray-700">Dán danh sách câu hỏi (Mỗi câu 1 dòng)</span>
                <button id="close-bulk-btn" class="text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
              </div>
              <p class="text-xs text-info mb-2">Hệ thống sẽ **tự động thêm vào** cuối danh sách hiện tại khi bạn dán văn bản.</p>
              <textarea id="bulk-textarea" class="input w-full p-3 text-sm" rows="5" placeholder="Ví dụ:&#10;1. Let's talk about your hometown.&#10;2. What do you like about it?"></textarea>
            </div>

            <div id="questions-list" class="space-y-3">
              <!-- Rendered via JS -->
            </div>
          </div>
          
          <div class="card p-6 mb-6 bg-gray-50 border border-gray-100">
            <label class="form-label font-bold text-gray-800 flex items-center gap-2">
              Chọn API Key Chấm Điểm 
              <span class="text-xs font-normal text-muted bg-gray-200 px-2 py-0.5 rounded">Tự động báo nếu hết Quota</span>
            </label>
            <p class="text-xs text-muted mb-3">Các key sẽ bị khóa ở lựa chọn máy của bạn nếu hệ thống phát hiện hết Token.</p>
            <select id="speaking-api-key" class="input w-full bg-white font-medium">
              ${optionsHtml}
            </select>
          </div>
          
          <button id="start-interview-btn" class="btn btn-primary w-full text-lg py-3 shadow-lg hover:shadow-xl transition-all" style="background: linear-gradient(135deg, #ec4899, #8b5cf6); border: none;">
            Bắt đầu Phỏng vấn 🚀
          </button>
        </div>
      `;

      // Dynamic questions logic
      const qListEl = document.getElementById('questions-list');
      const bulkArea = document.getElementById('bulk-import-area');
      const bulkTextarea = document.getElementById('bulk-textarea');
      
      // Load from localStorage if exists for this deck
      const storageKey = `lexilearn_speaking_qs_${deckSlug}`;
      let currentQs = customSpeakingQuestions.length > 0 ? [...customSpeakingQuestions] : [""];
      
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey));
        if (saved && Array.isArray(saved) && saved.length > 0) {
          currentQs = saved;
        }
      } catch(e) {}

      const parseImportedQuestions = (text) => {
        return text.split('\n')
          .map(line => line.trim())
          // Bắt các pattern như: "1.", "1)", "- ", "* ", "Q1:", "Bài 1:"
          .map(line => line.replace(/^(?:\d+[\.\)]\s*|-\s*|\*\s*|[qQ]\d+[\.\:]\s*|Câu\s*\d+[\.\:]\s*)/i, '').trim())
          .filter(line => line.length > 2);
      };

      const saveQs = () => {
        localStorage.setItem(storageKey, JSON.stringify(currentQs.filter(q => q.trim().length > 0)));
      };

      const renderQuestionInputs = () => {
        qListEl.innerHTML = '';
        if (currentQs.length === 0) currentQs = [""]; // Always at least 1
        
        currentQs.forEach((q, index) => {
          const row = document.createElement('div');
          row.className = 'flex gap-2 items-center animate-fade-in';
          row.innerHTML = `
            <div class="w-8 h-8 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center font-bold text-sm shrink-0">
              Q${index + 1}
            </div>
            <input type="text" class="input flex-1 speaking-q-input" value="${escapeHtml(q)}" placeholder="Ví dụ: What is your favorite book?">
            <button class="btn btn-sm btn-ghost text-red-400 hover:bg-red-50 px-2 delete-q-btn" data-index="${index}" title="Xóa">✕</button>
          `;
          qListEl.appendChild(row);
        });

        saveQs();

        // Attach listeners
        qListEl.querySelectorAll('.speaking-q-input').forEach((input, idx) => {
          input.addEventListener('input', (e) => {
            currentQs[idx] = e.target.value;
            saveQs();
          });
          // Also support paste logic on individual inputs (smart split)
          input.addEventListener('paste', (e) => {
            const pasteData = (e.clipboardData || window.clipboardData).getData('text');
            if (pasteData.includes('\n')) {
              e.preventDefault();
              const parsedQs = parseImportedQuestions(pasteData);
              if (parsedQs.length > 0) {
                currentQs.splice(idx, 1, ...parsedQs); // Replace current input with pasted array
                renderQuestionInputs();
              }
            }
          });
        });

        qListEl.querySelectorAll('.delete-q-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.dataset.index, 10);
            if (currentQs.length > 1) {
              currentQs.splice(idx, 1);
              renderQuestionInputs();
            } else {
              currentQs[0] = "";
              renderQuestionInputs();
              showToast('Phải có ít nhất 1 câu hỏi.', 'info');
            }
          });
        });
      };

      document.getElementById('add-question-btn').addEventListener('click', () => {
        currentQs.push("");
        renderQuestionInputs();
        // Focus latest input
        setTimeout(() => {
          const inputs = qListEl.querySelectorAll('.speaking-q-input');
          if (inputs.length) inputs[inputs.length - 1].focus();
        }, 50);
      });

      // Bulk Import Event Listeners Real-time
      let bulkDebounce = null;
      bulkTextarea.addEventListener('input', () => {
        if (bulkDebounce) clearTimeout(bulkDebounce);
        bulkDebounce = setTimeout(() => {
          const rawText = bulkTextarea.value;
          const parsed = parseImportedQuestions(rawText);
          if (parsed.length > 0) {
            // Append Mode
            if (currentQs.length === 1 && currentQs[0].trim() === '') {
              currentQs = parsed;
            } else {
              currentQs = [...currentQs, ...parsed];
            }
            bulkTextarea.value = ''; // Clear after reading
            renderQuestionInputs();
            showToast(`Đã tự động thêm ${parsed.length} câu hỏi!`, 'success');
          }
        }, 300); // Wait 300ms for user to finish typing/pasting
      });

      document.getElementById('import-bulk-btn').addEventListener('click', () => {
        bulkArea.classList.toggle('hidden');
        if (!bulkArea.classList.contains('hidden')) bulkTextarea.focus();
      });

      document.getElementById('close-bulk-btn').addEventListener('click', () => {
        bulkArea.classList.add('hidden');
      });

      // Initial render
      renderQuestionInputs();

      // Try to select the first available working key or cached key
      try {
        const selectEl = document.getElementById('speaking-api-key');
        const cachedKey = localStorage.getItem('lexilearn_speaking_key');
        if (cachedKey && !failedKeys.includes(cachedKey)) {
          selectEl.value = cachedKey;
        } else {
          // Select first available non-failed key
          const firstWorking = SPEAKING_API_KEYS.find(k => !failedKeys.includes(k.key));
          if (firstWorking) selectEl.value = firstWorking.key;
        }
      } catch (e) {}

      document.getElementById('exit-setup')?.addEventListener('click', renderModeSelect);

      document.getElementById('start-interview-btn').addEventListener('click', () => {
        const finalQs = currentQs.map(q => q.trim()).filter(Boolean);
        if (finalQs.length === 0) {
          showToast('Vui lòng nhập ít nhất 1 câu hỏi nhé.', 'error');
          return;
        }
        
        const key = document.getElementById('speaking-api-key').value;
        if (!key) {
          showToast('Vui lòng chọn một API Key chấm điểm.', 'error');
          return;
        }
        
        localStorage.setItem('lexilearn_speaking_key', key);
        customSpeakingQuestions = finalQs;
        customSpeakingApiKey = key;
        currentCustomQIndex = 0;
        renderSpeakingCard();
      });
    };
    const renderSpeakingCard = () => {
      const question = customSpeakingQuestions[currentCustomQIndex];
      if (!question) {
        renderSummary();
        return;
      }
      
      const progress = Math.round((currentCustomQIndex / customSpeakingQuestions.length) * 100);
      
      container.innerHTML = `
        <div class="animate-fade-in study-container study-mode-speaking max-w-xl mx-auto">
          <div class="flashcard-progress-bar">
            <button class="btn btn-ghost btn-sm text-red-500" id="exit-interview">← Exit</button>
            <span class="study-mode-badge" style="background:#fce7f3;color:#be185d;">🎙️ Mock Interview</span>
            <div class="progress-container">
              <div class="progress-bar-wrapper">
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width:${progress}%; background: linear-gradient(90deg, #ec4899, #f472b6);"></div>
                </div>
              </div>
              <span class="progress-counter">${currentCustomQIndex + 1}/${customSpeakingQuestions.length}</span>
            </div>
          </div>
          
          <div class="flashcard mt-8" style="min-height: 400px; padding: var(--space-8); display: flex; flex-direction: column; align-items: center; justify-content: flex-start; background: linear-gradient(to bottom right, #ffffff, #fdf2f8);">
            <div class="text-center w-full mb-8">
              <span class="text-xs uppercase tracking-widest font-bold text-pink-400 mb-2 block">Question ${currentCustomQIndex + 1}</span>
              <h2 class="text-2xl font-bold text-gray-800 leading-tight">"${escapeHtml(question)}"</h2>
              <button class="btn btn-ghost btn-sm mt-4 text-pink-600" id="replay-tts">🔊 Nghe lại</button>
            </div>
            
            <div class="flex items-center gap-4 mt-auto mb-4 scale-110">
              <button id="pause-btn" class="btn btn-circle bg-gray-100 border border-gray-200 shadow-sm hidden" title="Bài tạm dừng (Phím tắt: P hoặc Space)">⏸️</button>
              <button id="mic-btn" class="speaking-mic-btn" type="button" style="box-shadow: 0 10px 25px -5px rgba(236, 72, 153, 0.4);">🎙️</button>
            </div>
            
            <div id="recording-status" class="text-xs text-pink-400 font-bold mb-1 text-center hidden">🔴 RECORDING</div>
            <div class="text-sm text-pink-600 font-medium mb-4 text-center">
              <span class="bg-gray-100 px-2 py-1 rounded text-gray-600 text-xs">Phím tắt Space: Chạy/Tạm dừng</span>
              <br/>Nói <span class="text-gray-800 font-bold">"I'm Done"</span> hoặc im lặng 4s để nộp bài
            </div>
            <div id="transcript" class="speaking-transcript empty w-full text-center">Transcript sẽ hiện ở đây...</div>
            
            <div id="speaking-feedback-container" class="w-full mt-6"></div>
            
            <div id="post-check-next" style="display:none;justify-content:center;margin-top:var(--space-6);width:100%;">
              <button class="btn btn-primary w-full text-lg shadow-md" style="background:#db2777;border:none;">
                ${currentCustomQIndex < customSpeakingQuestions.length - 1 ? 'Câu kế tiếp →' : 'Kết thúc Phỏng vấn 🎉'}
              </button>
            </div>
          </div>
        </div>
      `;

      isPaused = false;
      savedTranscriptChunks = [];

      const togglePause = () => {
        if (!isRecording) return;
        const pauseBtn = document.getElementById('pause-btn');
        const statusEl = document.getElementById('recording-status');
        
        if (!isPaused) {
          isPaused = true;
          pauseBtn.innerHTML = '▶️';
          pauseBtn.classList.add('bg-pink-100');
          if (statusEl) statusEl.innerHTML = '⏸️ PAUSED';
          if (recognition) recognition.stop(); // Stop current speech session
          if (speakingTranscript.trim()) {
            savedTranscriptChunks.push(speakingTranscript);
            speakingTranscript = ''; // Reset for next chunk
          }
          showToast('Đã tạm dừng. Nhấn Space để tiếp tục.', 'info');
        } else {
          isPaused = false;
          pauseBtn.innerHTML = '⏸️';
          pauseBtn.classList.remove('bg-pink-100');
          if (statusEl) statusEl.innerHTML = '🔴 RECORDING';
          if (recognition) {
            try { recognition.start(); } catch(e) {}
          }
        }
      };

      // Auto-play TTS for the question
      setTimeout(() => {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(question);
        u.lang = 'en-US';
        u.rate = 0.95;
        speechSynthesis.speak(u);
      }, 500);

      document.getElementById('replay-tts')?.addEventListener('click', () => {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(question);
        u.lang = 'en-US';
        u.rate = 0.95;
        speechSynthesis.speak(u);
      });

      document.getElementById('mic-btn')?.addEventListener('click', toggleRecording);
      document.getElementById('pause-btn')?.addEventListener('click', togglePause);
      
      const interviewKeys = (e) => {
        if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault();
          if (!isRecording) {
            toggleRecording();
          } else {
            togglePause();
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (isRecording) stopRecordingSequence();
        }
      };
      
      document.addEventListener('keydown', interviewKeys);

      document.getElementById('post-check-next')?.addEventListener('click', () => {
        document.removeEventListener('keydown', interviewKeys);
        if (currentCustomQIndex < customSpeakingQuestions.length - 1) {
          currentCustomQIndex++;
          renderSpeakingCard();
        } else {
          renderSummary();
        }
      });
      
      document.getElementById('exit-interview')?.addEventListener('click', () => {
        document.removeEventListener('keydown', interviewKeys);
        speechSynthesis.cancel();
        if (isRecording) { stopRecordingSequence(); } // stop mic
        renderModeSelect();
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
        : buildBackReveal(card) + buildBack(card);
      const modeInfo = MODES.find(m => m.id === mode) || MODES[0];
      const hint = mode === 'flip'
        ? 'Shift: phát âm · Enter / Space / Backspace: lật thẻ · ← →: đổi thẻ'
        : 'Shift: phát âm · Enter / Space / Backspace: lật thẻ · Gõ xong nhấn Enter để kiểm tra · ← →: đổi thẻ';
      const canPrev = currentIndex > 0;
      const canNext = currentIndex < cards.length - 1;
      const doneCount = completedCardIds.size;
      const wrongWords = [...wrongInSession.entries()].filter(([, n]) => n >= 1).map(([id]) => cards.find(c => c.id === id)?.word).filter(Boolean);
      const statusLine = wrongWords.length > 0
        ? `Đã xong: ${doneCount} · Sai trong phiên: ${wrongWords.join(', ')}`
        : `Đã xong: ${doneCount} / ${cards.length}`;

      container.innerHTML = `
        <div class="animate-fade-in study-container study-mode-${mode} max-w-xl mx-auto">
          <div class="flashcard-progress-bar">
            <button class="btn btn-ghost btn-sm text-red-500" id="exit">← Exit</button>
            <span class="study-mode-badge study-mode-badge-${mode}">${modeInfo.icon} ${modeInfo.short}</span>
            <div class="progress-container">
              <div class="progress-bar-wrapper">
                <div class="progress-bar">
                  <div class="progress-bar-fill" style="width:${progress}%"></div>
                </div>
              </div>
              <span class="progress-counter">${currentIndex + 1}/${cards.length}</span>
            </div>
          </div>
          <div class="study-status-line" style="font-size:var(--font-size-xs);color:var(--color-text-secondary);margin-top:var(--space-2);margin-bottom:var(--space-2);">${escapeHtml(statusLine)}</div>

          <div class="flex items-center justify-center gap-2 my-4">
            <button class="btn btn-ghost btn-sm" id="nav-prev" ${!canPrev ? 'disabled' : ''} title="Thẻ trước (←)">← Trước</button>
            <span class="text-muted text-sm px-2">${currentIndex + 1} / ${cards.length}</span>
            <button class="btn btn-ghost btn-sm" id="nav-next" ${!canNext ? 'disabled' : ''} title="Thẻ sau (→)">Sau →</button>
          </div>

          <div class="flashcard-nav-wrapper" style="display:flex;align-items:center;justify-content:center;gap:var(--space-4);margin-bottom:var(--space-4);">
            <button class="flashcard-arrow flashcard-arrow-left" id="arrow-prev" ${!canPrev ? 'disabled' : ''} title="Thẻ trước" aria-label="Thẻ trước">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div class="flashcard-wrapper" style="flex:1;max-width:420px;">
              <div class="flashcard" id="fcard" tabindex="0" role="button" aria-label="Flashcard. Press Enter or Space to flip. Use arrow keys to navigate.">
                <div class="flashcard-face flashcard-front">${front}</div>
                <div class="flashcard-face flashcard-back">${back}</div>
              </div>
            </div>
            <button class="flashcard-arrow flashcard-arrow-right" id="arrow-next" ${!canNext ? 'disabled' : ''} title="Thẻ sau" aria-label="Thẻ sau">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>

          ${mode === 'flip' ? `
            <div id="flip-rating-area" style="display:none;justify-content:center;gap:var(--space-3);margin-top:var(--space-4);">
              <button id="rate-hard" class="btn" style="background:#fef2f2;color:#dc2626;border:1.5px solid #fecaca;min-width:90px;">😰 Khó</button>
              <button id="rate-good" class="btn btn-primary" style="min-width:90px;">👍 Biết</button>
              <button id="rate-easy" class="btn" style="background:#f0fdf4;color:#16a34a;border:1.5px solid #bbf7d0;min-width:90px;">⭐ Dễ</button>
            </div>
          ` : `
            <div id="post-check-next" style="display:none;justify-content:center;margin-top:var(--space-4);">
              <button class="btn btn-primary" style="min-width:150px;">${currentIndex < cards.length - 1 ? 'Tiếp theo →' : 'Kết thúc 🎉'}</button>
            </div>
          `}
        </div>
      `;

      const fcard = document.getElementById('fcard');

      fcard.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target.closest('input') || e.target.closest('button')) return;
        
        // Only allow clicking to flip if we are in flip mode, 
        // OR if we are on the back of the card (isFlipped === true) to go back.
        if (mode === 'flip' || isFlipped) {
            toggleFlip();
        }
        
        fcard.focus();
      });

      container.querySelectorAll('.study-speak-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { 
          e.stopPropagation(); 
          speakWord(btn.dataset.word); 
        });
      });

      document.getElementById('nav-prev')?.addEventListener('click', goPrev);
      document.getElementById('nav-next')?.addEventListener('click', goNext);
      document.getElementById('arrow-prev')?.addEventListener('click', () => { if (currentIndex > 0) goPrev(); });
      document.getElementById('arrow-next')?.addEventListener('click', () => { if (currentIndex < cards.length - 1) goNext(); });
      document.getElementById('check-btn')?.addEventListener('click', runCheck);
      document.getElementById('mic-btn')?.addEventListener('click', toggleRecording);
      
      // Load AI data asynchronously for Recall and Meaning Meaning
      if (mode === 'recall' || mode === 'meaning') {
        const aiContainer = document.getElementById('ai-dynamic-content');
        if (aiContainer) {
          generateDistractors(card.word, card.meaning, card.pos, mode).then(distractors => {
            const correctAns = mode === 'recall' ? card.word : card.meaning;
            const options = [...distractors, correctAns].sort(() => Math.random() - 0.5);
            aiContainer.innerHTML = `
              <div class="mc-options animate-fade-in-up">
                ${options.map(opt => `<button class="mc-option" data-val="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`).join('')}
              </div>
            `;
            aiContainer.querySelectorAll('.mc-option').forEach(btn => {
              btn.addEventListener('click', () => runMultipleChoiceCheck(btn.dataset.val, btn));
            });
          }).catch(() => {
            // Fallback to text input
            aiContainer.innerHTML = `
              <input id="ans-in" class="input text-center text-lg mt-4" placeholder="Gõ câu trả lời..." autocomplete="off">
              <button type="button" id="check-btn" class="btn btn-primary w-full mt-4">Kiểm tra</button>
            `;
            aiContainer.querySelector('#check-btn').addEventListener('click', runCheck);
          });
        }
      } else if (mode === 'speaking') {
        const aiContainer = document.getElementById('ai-speaking-prompt');
        if (aiContainer) {
          generateSpeakingPrompt(card.word, card.meaning).then(prompt => {
            aiContainer.innerHTML = `<p class="text-lg font-medium text-pink-700 animate-fade-in-up">"${escapeHtml(prompt)}"</p>`;
          }).catch(() => {
            aiContainer.innerHTML = `<p class="text-lg font-medium text-pink-700">"Make a sentence using the word: ${escapeHtml(card.word)}"</p>`;
          });
        }
      }

      // Auto-focus logic
      requestAnimationFrame(() => {
        if (mode === 'flip') fcard?.focus();
      });
      
      // Post-check next button (for recall/meaning modes)
      document.getElementById('post-check-next')?.addEventListener('click', () => {
        if (currentIndex < cards.length - 1) goNext();
        else renderSummary();
      });

      // Flip mode rating buttons
      document.getElementById('rate-easy')?.addEventListener('click', () => {
        processReview(card.id, RATING.EASY || RATING.GOOD).catch(() => {});
        db.progress.logReview(card.id, 3, true).catch(() => {});
        completedCardIds.add(card.id);
        if (currentIndex < cards.length - 1) goNext(); else renderSummary();
      });
      document.getElementById('rate-good')?.addEventListener('click', () => {
        processReview(card.id, RATING.GOOD).catch(() => {});
        db.progress.logReview(card.id, 2, true).catch(() => {});
        completedCardIds.add(card.id);
        if (currentIndex < cards.length - 1) goNext(); else renderSummary();
      });
      document.getElementById('rate-hard')?.addEventListener('click', () => {
        processReview(card.id, RATING.AGAIN).catch(() => {});
        db.progress.logReview(card.id, 0, false).catch(() => {});
        wrongInSession.set(card.id, (wrongInSession.get(card.id) || 0) + 1);
        if (currentIndex < cards.length - 1) goNext(); else renderSummary();
      });

      // Event listener is now handled at the top level of renderStudy

      document.getElementById('exit').addEventListener('click', () => {
        if (container._studyNavKeys) {
          document.removeEventListener('keydown', container._studyNavKeys);
          container._studyNavKeys = null;
        }
        window.history.back();
      });
    };

    const renderSummary = () => {
      if (container._studyNavKeys) {
        document.removeEventListener('keydown', container._studyNavKeys);
        container._studyNavKeys = null;
      }
      const wrongList = [...wrongInSession.entries()].filter(([, n]) => n >= 1).map(([id]) => cards.find(c => c.id === id)?.word).filter(Boolean);
      const wrongHtml = wrongList.length > 0 ? `<p class="text-amber-600 font-medium mt-2">Từ cần ôn lại (sai trong phiên): ${wrongList.map(w => escapeHtml(w)).join(', ')}</p>` : '';
      container.innerHTML = `
        <div class="study-container text-center p-20">
          <h1 class="text-4xl font-bold mb-4">Keep it up! 🚀</h1>
          <p class="text-muted mb-2 text-lg">Đã xong ${completedCardIds.size} thẻ trong phiên này.</p>
          ${wrongHtml}
          <button class="btn btn-primary px-10 mt-8" id="study-finish-btn">Kết thúc</button>
        </div>
      `;
      document.getElementById('study-finish-btn')?.addEventListener('click', () => navigateTo('/dashboard'));
    };

    renderModeSelect();

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-red-500">Error: ${err.message}</div>`;
  }

  // Helper: parse synonyms from string or array
  function parseSynonyms(card) {
    if (!card) return [];
    const s = card.synonyms;
    if (Array.isArray(s)) return s.filter(Boolean).map((x) => String(x).trim());
    if (typeof s === 'string' && s.trim()) return s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    return [];
  }

  // For Recall/Meaning: top of back shows feedback + revealed word (same flip feel)
  function buildBackReveal(card) {
    const wordEsc = escapeHtml(card.word);
    const speakBtn = `<button type="button" class="study-speak-btn" data-word="${wordEsc}" aria-label="Phát âm" title="Nghe phát âm">🔊</button>`;
    return `
      <div class="study-back-reveal">
        <div id="feedback" class="study-back-feedback"></div>
        <div class="study-back-reveal-word">
          <span class="study-back-reveal-word-text">${wordEsc}</span>
          ${speakBtn}
        </div>
      </div>
    `;
  }

  // Helper function to build the back side of flashcard (rich layout + synonyms + usage)
  function buildBack(card) {
    const meaning = escapeHtml(card.meaning || '');
    const explanation = escapeHtml(card.explanation || '');
    const exampleSent = card.example_sent || '';
    const exampleHighlighted = highlightWordInSentence(exampleSent, card.word);
    const phonetic = escapeHtml(card.phonetic || '');
    const pos = escapeHtml((card.pos || '').trim());
    const synonyms = parseSynonyms(card);
    const wordEsc = escapeHtml(card.word);
    const speakBtn = `<button type="button" class="study-speak-btn" data-word="${wordEsc}" aria-label="Phát âm" title="Nghe phát âm">🔊</button>`;
    const usageId = `study-usage-${(card.id || '').toString().replace(/\s/g, '-')}`;

    return `
      <div class="study-back">
        <div class="study-back-head">
          <div class="study-back-meaning">${meaning}</div>
          ${speakBtn}
        </div>
        ${pos || phonetic ? `
          <div class="study-back-meta">
            ${pos ? `<span class="study-back-pos">${pos}</span>` : ''}
            ${phonetic ? `<span class="study-back-phonetic">/${phonetic}/</span>` : ''}
          </div>
        ` : ''}
        ${explanation ? `<div class="study-back-explanation">${explanation}</div>` : ''}
        ${exampleHighlighted ? `<div class="study-back-example"><span class="study-back-example-label">Ví dụ</span><span class="study-back-example-text">"${exampleHighlighted}"</span></div>` : ''}
        <div class="study-back-usage">
          <span class="study-back-usage-label">Cách dùng trong câu</span>
          <div id="${usageId}" class="study-back-usage-text">Đang phân tích...</div>
        </div>
        ${synonyms.length > 0 ? `
          <div class="study-back-synonyms">
            <span class="study-back-synonyms-label">Từ đồng nghĩa</span>
            <div class="study-back-synonyms-list">${synonyms.map((s) => `<span class="study-back-synonym-tag">${escapeHtml(s)}</span>`).join('')}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function buildFront(card, mode) {
    const wordEsc = escapeHtml(card.word);
    const posEsc = escapeHtml((card.pos || '').trim());
    const phoneticEsc = escapeHtml(card.phonetic || '');
    const exampleSent = card.example_sent || '';
    const exampleHighlighted = highlightWordInSentence(exampleSent, card.word);
    const speakBtn = `<button type="button" class="study-speak-btn" data-word="${wordEsc}" aria-label="Phát âm" title="Nghe phát âm">🔊</button>`;
    
    if (mode === 'flip') {
      return `
        <div class="study-front-head">
          <div class="study-front-word">${wordEsc}</div>
          ${speakBtn}
        </div>
        ${exampleHighlighted ? `<div class="study-front-example">${exampleHighlighted}</div>` : ''}
        ${posEsc || phoneticEsc ? `<div class="study-front-meta">${posEsc}${posEsc && phoneticEsc ? ' · ' : ''}${phoneticEsc ? `/${phoneticEsc}/` : ''}</div>` : ''}
      `;
    } else if (mode === 'recall') {
      const sentence = card.example_sent || '____ is a very interesting word.';
      const blanked = sentence.replace(new RegExp(escapeRegex(card.word), 'gi'), '______');
      return `
        <div class="study-mode-front study-recall-front">
          <div class="study-mode-front-label">Điền từ còn thiếu</div>
          <div class="study-recall-sentence">"${escapeHtml(blanked)}"</div>
          <div id="ai-dynamic-content" class="w-full">
            <div class="ai-loading"><div class="spinner-large"></div><p>AI đang tạo đáp án...</p></div>
          </div>
        </div>
      `;
    } else if (mode === 'meaning') {
      return `
        <div class="study-mode-front study-meaning-front">
          <div class="study-mode-front-label">Dịch sang tiếng Anh</div>
          <div class="study-meaning-meaning">${escapeHtml(card.meaning || '')}</div>
          <div id="ai-dynamic-content" class="w-full">
            <div class="ai-loading"><div class="spinner-large"></div><p>AI đang tạo đáp án...</p></div>
          </div>
        </div>
      `;
    }
  }
}

