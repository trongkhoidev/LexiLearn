import { showToast } from './Toast.js';

/**
 * AudioRecorder Component
 * Handles microphone recording and basic playback.
 */
export function renderAudioRecorder(options = {}) {
  const { 
    id = `rec-${Math.random().toString(36).substr(2, 9)}`,
    onComplete = () => {} 
  } = options;

  return `
    <div class="audio-recorder bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-200" id="${id}">
      <div class="flex flex-col items-center gap-4">
        <div class="timer text-3xl font-mono font-bold text-gray-700">00:00</div>
        
        <div class="controls flex items-center gap-4">
          <button class="btn btn-primary btn-circle btn-lg start-rec-btn">
            <span class="text-2xl">🎤</span>
          </button>
          <button class="btn btn-red btn-circle btn-lg stop-rec-btn hidden">
            <span class="text-2xl">⏹️</span>
          </button>
          <button class="btn btn-ghost btn-circle btn-lg restart-rec-btn hidden">
            <span class="text-2xl">🔄</span>
          </button>
        </div>

        <div class="playback-area hidden w-full mt-4 p-4 bg-white rounded-xl border flex items-center gap-4">
          <audio class="recording-preview flex-1 h-8" controls></audio>
        </div>

        <p class="status-text text-xxs font-black text-muted uppercase tracking-widest mt-2">Click microphone to start recording</p>
      </div>
    </div>
  `;
}

export function setupAudioRecorder(container, onComplete) {
  let mediaRecorder;
  let audioChunks = [];
  let startTime;
  let timerInterval;

  const timerEl = container.querySelector('.timer');
  const startBtn = container.querySelector('.start-rec-btn');
  const stopBtn = container.querySelector('.stop-rec-btn');
  const restartBtn = container.querySelector('.restart-rec-btn');
  const playbackArea = container.querySelector('.playback-area');
  const preview = container.querySelector('.recording-preview');
  const statusTab = container.querySelector('.status-text');

  startBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        preview.src = audioUrl;
        playbackArea.classList.remove('hidden');
        onComplete(audioBlob);
      };

      mediaRecorder.start();
      startTime = Date.now();
      timerInterval = setInterval(updateTimer, 1000);

      startBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
      statusTab.textContent = 'Recording...';
      statusTab.classList.add('text-red-500');
    } catch (err) {
      showToast('Could not access microphone: ' + err.message, 'error');
    }
  });

  stopBtn.addEventListener('click', () => {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    clearInterval(timerInterval);
    
    stopBtn.classList.add('hidden');
    restartBtn.classList.remove('hidden');
    statusTab.textContent = 'Recording complete';
    statusTab.classList.remove('text-red-500');
  });

  restartBtn.addEventListener('click', () => {
    playbackArea.classList.add('hidden');
    restartBtn.classList.add('hidden');
    startBtn.classList.remove('hidden');
    timerEl.textContent = '00:00';
    statusTab.textContent = 'Click microphone to start recording';
  });

  function updateTimer() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    timerEl.textContent = `${m}:${s}`;
  }
}
