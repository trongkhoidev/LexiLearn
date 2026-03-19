import { exerciseService } from '../services/exercise.service.js';
import { gradingEngine } from '../utils/grading.js';
import { getCurrentUser } from '../utils/supabase.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';
import { renderQuestionBlock, setupQuestionBlockEvents } from '../components/QuestionBlock.js';
import { aiGradingService } from '../services/ai-grading.service.js';

export async function renderExamPlayer(container, params) {
  const examId = params.id;
  const user = getCurrentUser();
  const assignmentId = params.assignmentId || null;

  let exam = null;
  let submission = null;
  let userAnswers = {}; // { questionNum: value }
  let userNotes = {};   // { questionNum: string }
  let timeLeft = 0;
  let timerInterval = null;
  let isSubmitting = false;

  // Initial Load
  container.innerHTML = `<div class="flex items-center justify-center h-screen"><div class="spinner"></div></div>`;

  try {
    exam = await exerciseService.getExam(examId);
    if (!exam) {
      container.innerHTML = `<div class="p-20 text-center text-red-600">Exam not found.</div>`;
      return;
    }

    // Start or Resume Submission
    submission = await exerciseService.startSubmission(examId, user.id, assignmentId);
    
    // Load existing answers
    const answers = await exerciseService.getAnswers(submission.id);
    answers.forEach(a => {
      userAnswers[a.question_num] = a.user_answers || a.user_answer || a.essay_text || a.audio_url;
      userNotes[a.question_num] = a.student_notes || '';
    });

    // Setup Timer
    const totalSecs = exam.time_limit_minutes * 60;
    const elapsedSecs = Math.floor((new Date() - new Date(submission.started_at)) / 1000);
    timeLeft = Math.max(0, totalSecs - elapsedSecs);

    render();
    startTimer();
  } catch (err) {
    showToast(err.message, 'error');
  }

  function render() {
    container.innerHTML = `
      <div class="exam-player-container flex flex-col h-screen overflow-hidden bg-gray-50">
        <!-- Header -->
        <header class="h-16 bg-white border-b px-6 flex items-center justify-between shadow-sm z-10">
          <div class="flex items-center gap-4">
            <button class="btn btn-ghost btn-sm" id="exit-btn">← Exit</button>
            <div class="h-8 w-px bg-gray-200"></div>
            <div>
              <div class="font-bold text-sm truncate max-w-xs">${exam.title}</div>
              <div class="text-xxs text-muted uppercase font-black tracking-widest">${exam.module} Module</div>
            </div>
          </div>

          <div class="flex items-center gap-6">
            <div class="timer-box px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2">
              <span class="text-blue-500">⏱️</span>
              <span class="font-mono font-bold text-blue-700" id="timer-display">${formatTime(timeLeft)}</span>
            </div>
            <button class="btn btn-primary btn-sm px-6" id="submit-exam-btn">Submit Test</button>
          </div>
        </header>

        <!-- Main Content (Split Screen) -->
        <main class="flex-1 flex overflow-hidden">
          <!-- Left: PDF / Material -->
          <div class="w-1/2 h-full border-r bg-gray-200 relative">
            ${exam.pdf_url ? `
              <iframe src="${exam.pdf_url}" class="w-full h-full border-0" id="pdf-viewer"></iframe>
            ` : `
              <div class="p-12 h-full overflow-auto bg-white prose max-w-none">
                 <h1 class="text-3xl font-bold mb-6">${exam.title}</h1>
                 <div class="text-gray-700 leading-relaxed">${exam.instructions || 'Follow the instructions on the right to complete the exam.'}</div>
              </div>
            `}
          </div>

          <!-- Right: Questions -->
          <div class="w-1/2 h-full overflow-y-auto p-10 bg-gray-50/50" id="questions-pane">
            ${exam.question_blocks.sort((a,b) => a.block_order - b.block_order).map(block => 
              renderQuestionBlock(block, { userAnswers, onAnswerChange: handleAnswerChange })
            ).join('')}
            
            <div class="mt-10 p-12 text-center bg-white rounded-3xl border-2 border-dashed border-gray-200">
               <div class="text-4xl mb-4">🏁</div>
               <h3 class="font-bold text-xl mb-2">End of Test</h3>
               <p class="text-muted mb-6">Make sure to check all your answers before submitting.</p>
               <button class="btn btn-primary btn-lg px-12" onclick="document.getElementById('submit-exam-btn').click()">Review & Submit</button>
            </div>
          </div>
        </main>

        <!-- Progress Footer (Optional) -->
        <footer class="h-12 bg-white border-t px-6 flex items-center justify-between text-xxs text-muted font-bold tracking-widest uppercase">
          <div id="progress-text">Progress: ${Object.keys(userAnswers).length} / ${exam.total_questions} Answered</div>
          <div class="flex items-center gap-2">
            <span id="save-status">Saved</span>
            <div class="h-1.5 w-1.5 rounded-full bg-green-500"></div>
          </div>
        </footer>
      </div>
    `;

    setupEvents();
  }

  function setupEvents() {
    document.getElementById('exit-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to exit? Your progress is saved.')) navigateTo('/classes');
    });

    document.getElementById('submit-exam-btn')?.addEventListener('click', handleSubmit);

    // Question Block Event Delegation
    setupQuestionBlockEvents(document.getElementById('questions-pane'), {
      onAnswerChange: (qNum, value) => handleAnswerChange(qNum, value),
      onNoteChange: (qNum, value) => handleNoteChange(qNum, value)
    });
  }

  function handleNoteChange(qNum, value) {
    userNotes[qNum] = value;
    // Auto-save note to DB (Debounced or direct)
    saveAnswerToDb(qNum, userAnswers[qNum], value);
  }

  function handleAnswerChange(qNum, value) {
    userAnswers[qNum] = value;
    document.getElementById('progress-text').textContent = `Progress: ${Object.keys(userAnswers).length} / ${exam.total_questions} Answered`;
    
    // For Blobs (Speaking), we don't auto-save to DB every second
    if (!(value instanceof Blob)) {
      saveAnswerToDb(qNum, value);
    }
    
    // UI Feedback for answered question
    const qEl = document.querySelector(`[data-qnum="${qNum}"]`);
    if (qEl) qEl.classList.add('answered');
    
    // Save to LocalStorage as fallback
    if (!(value instanceof Blob)) {
       localStorage.setItem(`exam_progress_${submission.id}`, JSON.stringify(userAnswers));
    }
  }

  async function saveAnswerToDb(qNum, value, note = null) {
    const statusEl = document.getElementById('save-status');
    if (statusEl) statusEl.textContent = 'Saving...';

    try {
      const block = exam.question_blocks.find(b => qNum >= b.question_start && qNum <= b.question_end);
      if (!block) return;

      const data = {
        submission_id: submission.id,
        block_id: block.id,
        question_num: parseInt(qNum),
        [Array.isArray(value) ? 'user_answers' : 'user_answer']: value,
        student_notes: note !== null ? note : (userNotes[qNum] || '')
      };
      
      await exerciseService.saveAnswer(data);
      if (statusEl) statusEl.textContent = 'Saved';
    } catch (err) {
      if (statusEl) statusEl.textContent = 'Error Saving';
    }
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        handleAutoSubmit();
      }
      const display = document.getElementById('timer-display');
      if (display) display.textContent = formatTime(timeLeft);
    }, 1000);
  }

  function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  async function handleSubmit() {
    if (isSubmitting) return;
    const unanswered = exam.total_questions - Object.keys(userAnswers).length;
    if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) return;

    isSubmitting = true;
    const btn = document.getElementById('submit-exam-btn');
    if (btn) btn.textContent = 'Submitting...';

    try {
      // 1. Process and Grade all answers
      let scoreRaw = 0;
      const answersToUpdate = [];

      for (const block of exam.question_blocks) {
        const blockQuestions = Array.from({ length: block.question_end - block.question_start + 1 }, (_, i) => block.question_start + i);
        
        for (const qNum of blockQuestions) {
          const uAns = userAnswers[qNum];
          const cAns = block.answers[qNum.toString()] || block.answers[qNum];
          
          const isProductive = block.block_type.startsWith('writing') || block.block_type.startsWith('speaking');
          
          if (isProductive) {
            let finalAnsValue = uAns;
            let aiAnalysis = null;

            // Handle Audio Upload
            if (uAns instanceof Blob) {
              const url = await exerciseService.uploadAudio(submission.id, qNum, uAns);
              finalAnsValue = url;
            }

            // Attempt AI Grading (Background or async here)
            try {
              if (block.block_type.startsWith('writing') && finalAnsValue) {
                aiAnalysis = await aiGradingService.gradeWriting(finalAnsValue, block.block_type, block.instruction);
              } else if (block.block_type.startsWith('speaking') && finalAnsValue) {
                // For speaking, we'd need a transcript first or multi-modal Gemini
                // For MVP, we'll label it as "Recording submitted"
                aiAnalysis = { status: 'recorded', note: 'AI Speaking evaluation requires transcription (upcoming).' };
              }
            } catch (aiErr) {
              console.error('AI Grading failed:', aiErr);
            }

            answersToUpdate.push({
              submission_id: submission.id,
              block_id: block.id,
              question_num: qNum,
              [block.block_type.startsWith('writing') ? 'essay_text' : 'audio_url']: finalAnsValue,
              ai_analysis: aiAnalysis,
              score: aiAnalysis?.band_score || null
            });
          } else {
            // Receptive Skills (Reading/Listening)
            const isCorrect = gradingEngine.grade(uAns, cAns, block.block_type, block.config);
            if (isCorrect) scoreRaw++;

            answersToUpdate.push({
              submission_id: submission.id,
              block_id: block.id,
              question_num: qNum,
              is_correct: isCorrect,
              student_notes: userNotes[qNum] || '',
              [Array.isArray(uAns) ? 'user_answers' : 'user_answer']: uAns
            });
          }
        }
      }

      // 2. Calculate Band (for Receptive part)
      const band = gradingEngine.calculateBand(scoreRaw, exam.total_questions, exam.module);

      // 3. Update Submission
      await exerciseService.updateSubmission(submission.id, {
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        time_spent_secs: (exam.time_limit_minutes * 60) - timeLeft,
        score_raw: scoreRaw,
        score_total: exam.total_questions,
        score_band: band
      });

      // 4. Batch update answers with correctness
      await exerciseService.saveAnswers(answersToUpdate);

      showToast('Exam submitted successfully!', 'success');
      navigateTo(`/exam/results/${submission.id}`);
    } catch (err) {
      showToast(err.message, 'error');
      isSubmitting = false;
      if (btn) btn.textContent = 'Submit Test';
    }
  }

  async function handleAutoSubmit() {
    showToast('Time is up! Your exam is being submitted automatically.', 'warning');
    await handleSubmit();
  }
}
