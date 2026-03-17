/* ============================================
   LexiLearn — Speaking Mode Component
   ============================================
*/

import { evaluateCustomSpeaking } from '../../../utils/gemini.js';
import { showToast } from '../../../components/Toast.js';
import { escapeHtml } from '../../../utils/helpers.js';
import { renderSummary } from '../StudySummary.js';

export function renderSpeakingMode(container, { questions, apiKey, cards }) {
  let currentIndex = 0;
  let recognition = null;
  let isRecording = false;
  let transcript = '';
  const completedCardIds = new Set();
  const wrongInSession = new Map();

  const renderCard = () => {
    const question = questions[currentIndex];
    const progress = Math.round((currentIndex / questions.length) * 100);
    
    container.innerHTML = `
      <div class="animate-fade-in study-container study-mode-speaking max-w-xl mx-auto py-12">
        <div class="flex-between mb-8">
          <button class="btn btn-ghost btn-sm text-muted font-bold" id="exit-btn">← Exit</button>
          <div class="text-xxs font-black text-muted uppercase tracking-widest">${currentIndex + 1} / ${questions.length}</div>
        </div>
        
        <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-12 shadow-inner">
           <div class="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-700" style="width:${progress}%"></div>
        </div>

        <div class="card p-12 border-none shadow-premium bg-white mb-8 text-center min-h-[450px] flex flex-col justify-center">
           <div class="mb-10">
              <span class="text-xxs font-black text-pink-500 uppercase tracking-widest block mb-4">Examiner Question</span>
              <h2 class="text-3xl font-black text-gray-900 leading-tight mb-6">"${escapeHtml(question)}"</h2>
              <button class="btn btn-ghost btn-xs text-blue-600 font-bold" id="replay">🔊 Listen</button>
           </div>

           <div class="flex flex-col items-center gap-6 mt-auto">
              <button id="mic-btn" class="w-20 h-20 rounded-full bg-pink-500 text-white shadow-xl flex-center text-3xl">🎙️</button>
              <div id="status" class="hidden animate-pulse flex items-center gap-2">
                 <span class="w-2 h-2 rounded-full bg-red-500"></span>
                 <span class="text-xs font-black text-red-500">Recording...</span>
              </div>
              <div id="transcript-el" class="text-sm font-medium text-muted bg-gray-50 px-6 py-4 rounded-2xl border w-full min-h-[60px] flex-center">Click the mic to speak.</div>
           </div>

           <div id="feedback-area" class="w-full"></div>

           <div id="next-area" class="hidden mt-10 w-full animate-fade-in">
              <button id="next-btn" class="btn btn-primary w-full py-4 font-black shadow-lg">
                ${currentIndex < questions.length - 1 ? 'Next Question →' : 'Complete Interview 🎉'}
              </button>
           </div>
        </div>
      </div>
    `;

    // TTS
    const speak = () => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(question);
      u.lang = 'en-US';
      u.rate = 0.95;
      speechSynthesis.speak(u);
    };
    setTimeout(speak, 500);

    // Recording Logic
    const toggleRecording = () => {
      const mic = document.getElementById('mic-btn');
      const status = document.getElementById('status');
      const tr = document.getElementById('transcript-el');

      if (isRecording) {
        recognition.stop();
        isRecording = false;
        mic.classList.remove('recording', 'bg-red-500');
        status.classList.add('hidden');
        evaluate(tr.textContent);
      } else {
        if (!recognition) {
          const SpeechReg = window.SpeechRecognition || window.webkitSpeechRecognition;
          recognition = new SpeechReg();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.onresult = (e) => {
            let chunk = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) chunk += e.results[i][0].transcript;
            tr.textContent = chunk.trim();
          };
        }
        recognition.start();
        isRecording = true;
        mic.classList.add('recording', 'bg-red-500');
        status.classList.remove('hidden');
        tr.textContent = 'Listening...';
      }
    };

    const evaluate = async (text) => {
      const area = document.getElementById('feedback-area');
      if (!text || text === 'Listening...') return;
      
      area.innerHTML = '<div class="ai-loading mt-8"><div class="spinner-sm"></div> Assessing...</div>';
      try {
        const vocab = cards.map(c => c.word);
        const res = await evaluateCustomSpeaking(text, question, apiKey, vocab);
        
        area.innerHTML = `
          <div class="mt-8 p-6 bg-pink-50 rounded-2xl border border-pink-100 text-left">
            <div class="flex-between mb-4">
               <span class="text-xs font-black uppercase tracking-widest text-pink-700">IELTS Estimation</span>
               <span class="text-2xl font-black text-pink-600">${res.overall || 'N/A'}</span>
            </div>
            <p class="text-xs text-gray-700 leading-relaxed mb-4">${escapeHtml(res.criteria?.FC?.feedback || '')}</p>
            <div class="flex flex-wrap gap-2">
               ${(res.vocab_used || []).map(v => `<span class="badge badge-green text-[9px]">${escapeHtml(v)}</span>`).join('')}
            </div>
          </div>
        `;
        document.getElementById('next-area').classList.remove('hidden');
        document.getElementById('mic-btn').classList.add('hidden');
      } catch (e) {
        area.innerHTML = `<p class="text-red-500 text-xs mt-4">Error: ${e.message}</p>`;
        document.getElementById('next-area').classList.remove('hidden');
      }
    };

    document.getElementById('mic-btn').addEventListener('click', toggleRecording);
    document.getElementById('replay').addEventListener('click', speak);
    document.getElementById('exit-btn').addEventListener('click', () => location.reload());
    document.getElementById('next-btn').addEventListener('click', () => {
      if (currentIndex < questions.length - 1) { currentIndex++; renderCard(); }
      else renderSummary(container, { completedCardIds, wrongInSession, totalCards: questions.length, cards });
    });
  };

  renderCard();
}
