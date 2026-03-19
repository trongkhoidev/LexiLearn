/* ============================================
   LexiLearn — IELTS Test Player
   ============================================
   Split-screen interface for Cambridge IELTS tests.
*/

import { escapeHtml } from '../utils/helpers.js';
import { lookupWord, buildTooltipHTML } from '../utils/wordLookup.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';

import { db, isDbConfigured, getCurrentUser, IELTS } from '../utils/supabase.js';

export function renderTestPlayer(container, params) {
  const testId = params.id;
  const user = getCurrentUser();
  const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const assignmentId = urlParams.get('assignmentId');
  
  let testData = null;
  let submissionId = null;
  let currentPassageIndex = 0;
  let timeLeft = 60 * 60;
  let timerInterval = null;
  let answers = {};
  let submissionStartedAt = null;

  const loadTestData = async () => {
    try {
      let assignment = null;
      if (assignmentId) {
        assignment = await db.assignments.get(assignmentId);
      }

      const isPassage = assignment?.task_type === 'cambridge_passage';

      if (isPassage) {
        // Load single section. In this context, testId is the section_id (source_ref_id)
        const sectionId = testId; 
        const section = await db.sections.get(sectionId);
        if (!section) throw new Error('Section not found');
        const questions = await db.questions.getBySection(sectionId);
        
        testData = {
          id: section.test_id,
          title: section.title,
          passages: [{
            ...section,
            questions
          }]
        };
      } else {
        // Load full test
        testData = await db.tests.get(testId);
        if (!testData) throw new Error('Test not found in cloud database');
      }

      // Load existing submission if it's an assignment
      if (assignmentId && user) {
        const subs = await db.submissions.listByStudent(user.id);
        const activeSub = subs.find(s => s.assignment_id === assignmentId && (s.status === 'in_progress' || s.status === 'submitted'));
        if (activeSub) {
          submissionId = activeSub.id;
          submissionStartedAt = activeSub.started_at || null;
          const savedAnswers = await db.submissionAnswers.listBySubmission(submissionId);
          savedAnswers.forEach(sa => {
            // Store by question_ref_id (or fallback to index key)
            if (sa.question_ref_id) answers[sa.question_ref_id] = sa.user_answer || '';
          });
        }
      }

      renderLayout();
    } catch (err) {
      container.innerHTML = `<div class="card" style="padding:2rem;text-align:center;"><h3>${err.message}</h3><p class="mt-2 text-muted">Ensure you have correctly assigned the Cambridge material.</p><button class="btn btn-primary mt-4" id="go-back-cambridge">Go Back</button></div>`;
      document.getElementById('go-back-cambridge')?.addEventListener('click', () => {
        const role = getCurrentUser()?.role;
        if (assignmentId) return navigateTo('/my-assignments');
        return navigateTo(role === 'teacher' ? '/cambridge' : '/dashboard');
      });
    }
  };

  const renderLayout = () => {
    container.innerHTML = `
      <div class="test-player-container animate-fade-in">
        <div class="test-top-bar">
          <div class="flex items-center gap-6">
            <button class="btn btn-ghost btn-sm font-bold text-muted hover:text-dark" id="exit-test">
              <span class="mr-1">✕</span> Exit
            </button>
            <div class="h-6 w-[2px] bg-gray-100"></div>
            <div class="text-lg font-extra-bold tracking-tight text-dark">${escapeHtml(testData.title || 'IELTS Reading')}</div>
          </div>
          
          <div class="flex items-center gap-6">
            <div class="test-timer-wrapper">
              <span class="timer-icon">⏳</span>
              <div id="test-timer" class="test-timer">60:00</div>
            </div>
            <button class="btn btn-primary px-8 font-bold shadow-glow" id="finish-test-btn">Finish & Submit</button>
          </div>
        </div>

        <div class="test-workspace">
          <div class="test-passage-pane" id="passage-pane">
            <div class="passage-nav">
              ${(testData.passages || [1,2,3]).map((p, i) => `
                <button class="passage-tab ${currentPassageIndex === i ? 'active' : ''}" data-idx="${i}">Passage ${i+1}</button>
              `).join('')}
            </div>
            <div id="passage-content-area" class="animate-fade-in-up"></div>
          </div>
          
          <div class="test-questions-pane" id="questions-area">
            <div class="flex-center h-full flex-col text-muted italic">
              <div class="spinner-sm mb-4"></div>
              Preparing questions...
            </div>
          </div>
        </div>

        <div class="test-bottom-bar">
          <div class="text-xxs font-black uppercase tracking-widest text-muted">Test Progress</div>
          <div class="progress-track">
            <div class="progress-fill" id="overall-progress-fill" style="width: 0%"></div>
          </div>
          <div class="text-xxs font-black text-blue-600" id="progress-text">0/0 Questions</div>
        </div>
      </div>
    `;

    startTimer();
    renderPassage();
    setupEvents();
  };

  const setupEvents = () => {
    container.querySelectorAll('.passage-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentPassageIndex = parseInt(tab.dataset.idx);
        renderPassage();
        container.querySelectorAll('.passage-tab').forEach(t => t.classList.toggle('active', t === tab));
      });
    });

    document.getElementById('finish-test-btn')?.addEventListener('click', async () => {
      if (confirm('Submit test?')) {
        clearInterval(timerInterval);
        
        // Calculate raw score
        let correct = 0;
        let total = 0;
        const answerRows = [];
        testData.passages.forEach(p => {
          p.questions.forEach(q => {
            total++;
            const userAnswer = (answers[q.id] || '').trim();
            const correctAnswer = (q.correct_answer || '').toString().trim();
            const isCorrect = userAnswer && correctAnswer
              ? userAnswer.toLowerCase() === correctAnswer.toLowerCase()
              : null;

            if (isCorrect === true) correct++;

            answerRows.push({
              question_ref_id: q.id,
              question_index: q.question_num || total,
              question_type: q.type || 'text',
              user_answer: userAnswer || null,
              correct_answer: correctAnswer || null,
              is_correct: isCorrect,
            });
          });
        });

        const bandScore = IELTS.estimateBand(correct, total);
        await saveProgress('submitted', bandScore, { correct, total, answerRows });
        showToast(`Test submitted! Estimated Band: ${bandScore} (${correct}/${total})`, 'success');
        {
          const role = getCurrentUser()?.role;
          navigateTo(assignmentId ? '/my-assignments' : (role === 'teacher' ? '/cambridge' : '/dashboard'));
        }
      }
    });

    document.getElementById('exit-test')?.addEventListener('click', () => {
      if (confirm('Exit without saving?')) {
        clearInterval(timerInterval);
        {
          const role = getCurrentUser()?.role;
          navigateTo(assignmentId ? '/my-assignments' : (role === 'teacher' ? '/cambridge' : '/dashboard'));
        }
      }
    });
  };

  const renderPassage = () => {
    const passage = testData.passages?.[currentPassageIndex] || { title: 'Reading Passage', content: '...' };
    const area = document.getElementById('passage-content-area');
    if (!area) return;

    let contentHtml = passage.content || 'Content not available';
    try {
      const parsed = JSON.parse(passage.content);
      if (parsed?.pdf?.url) {
        contentHtml = `<iframe src="${escapeHtml(parsed.pdf.url)}" class="w-full rounded-2xl border border-slate-200 shadow-sm" style="min-height: 80vh;"></iframe>`;
      }
    } catch(e) { /* ignore, it's just raw HTML */ }

    area.innerHTML = `
      <h2 class="text-3xl font-extra-bold mb-8 tracking-tight">${escapeHtml(passage.title)}</h2>
      <div class="reading-content-test animate-fade-in flex flex-col">${contentHtml}</div>
    `;

    renderQuestions(passage.questions || []);
    updateGlobalProgress();
  };

  const renderQuestions = (questions) => {
    const area = document.getElementById('questions-area');
    if (!area) return;

    if (questions.length === 0) {
      area.innerHTML = `<div class="card-glass p-8 text-center text-muted">Questions for this section will appear here shortly.</div>`;
      return;
    }

    area.innerHTML = `
      <h3 class="flex items-center gap-3 font-extra-bold text-lg mb-8">
        <span class="w-8 h-8 rounded-lg bg-blue-600 text-white flex-center text-sm">📝</span>
        Questions 1–${questions.length}
      </h3>
      <div class="questions-list animate-fade-in-up">
        ${questions.map(q => `
          <div class="question-item shadow-sm" data-qid="${q.id}">
            <p class="font-bold text-sm mb-4 flex items-start">
              <span class="question-num">${q.question_num}</span>
              <span>${escapeHtml(q.text)}</span>
            </p>
            ${renderQuestionOptions(q)}
          </div>
        `).join('')}
      </div>
    `;

    setupQuestionEvents();
  };

  const updateGlobalProgress = () => {
    let total = 0;
    let answered = 0;
    testData.passages.forEach(p => {
      p.questions.forEach(q => {
        total++;
        if (answers[q.id] && answers[q.id].trim() !== '') answered++;
      });
    });

    const fill = document.getElementById('overall-progress-fill');
    const text = document.getElementById('progress-text');
    if (fill && text) {
      fill.style.width = `${(answered / total) * 100}%`;
      text.textContent = `${answered}/${total} Questions Answered`;
    }
  };

  const renderQuestionOptions = (q) => {
    if (q.type === 'mcq' && q.options) {
      return `
        <div class="flex flex-col gap-2">
          ${q.options.map((opt, i) => {
            const letter = ['A', 'B', 'C', 'D'][i] || i;
            const checked = answers[q.id] === letter;
            return `
              <label class="mcq-option ${checked ? 'selected' : ''}" data-qid="${q.id}" data-val="${letter}">
                <input type="radio" name="q-${q.id}" value="${letter}" ${checked ? 'checked' : ''} style="display:none;" />
                <span class="option-letter">${letter}</span>
                <span class="option-text">${escapeHtml(opt)}</span>
              </label>
            `;
          }).join('')}
        </div>
      `;
    }
    return `<input type="text" class="input question-input" placeholder="Type answer..." data-qid="${q.id}" value="${answers[q.id] || ''}" />`;
  };

  const setupQuestionEvents = () => {
    container.querySelectorAll('.mcq-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const qid = opt.dataset.qid;
        const val = opt.dataset.val;
        answers[qid] = val;
        
        // Update UI
        container.querySelectorAll(`.mcq-option[data-qid="${qid}"]`).forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        
        updateGlobalProgress();
        saveProgress('in_progress');
      });
    });

    container.querySelectorAll('.question-input').forEach(input => {
      input.addEventListener('change', () => {
        answers[input.dataset.qid] = input.value;
        updateGlobalProgress();
        saveProgress('in_progress');
      });
    });
  };

  const startTimer = () => {
    timerInterval = setInterval(() => {
      timeLeft--;
      const display = document.getElementById('test-timer');
      if (display) {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      }
      if (timeLeft <= 0) { clearInterval(timerInterval); saveProgress('submitted'); }
    }, 1000);
  };

  const saveProgress = async (status = 'in_progress', score = null, final = null) => {
    try {
      if (assignmentId && user) {
        const nowIso = new Date().toISOString();
        if (!submissionStartedAt) submissionStartedAt = nowIso;

        // Save to submissions table (new schema)
        const subData = {
          assignment_id: assignmentId,
          student_id: user.id,
          status,
          started_at: submissionStartedAt,
          submitted_at: (status === 'submitted' || status === 'graded') ? nowIso : null,
          score_raw: final?.correct ?? null,
          score_band_equivalent: typeof score === 'number' ? score : null,
          total_items: final?.total ?? null,
        };

        if (submissionId) subData.id = submissionId;

        const res = await db.submissions.createOrUpdate(subData);
        if (res && res[0]) submissionId = res[0].id;

        // Save answers
        const rowsToSave = (final?.answerRows && Array.isArray(final.answerRows) && final.answerRows.length > 0)
          ? final.answerRows
          : Object.entries(answers).map(([qid, val], idx) => ({
              question_ref_id: qid,
              question_index: idx + 1,
              question_type: 'text',
              user_answer: (val || '').toString(),
            }));

        const answerRows = rowsToSave.map((r) => ({
          submission_id: submissionId,
          question_ref_id: r.question_ref_id || null,
          question_index: r.question_index,
          question_type: r.question_type || 'text',
          user_answer: r.user_answer ?? null,
          correct_answer: r.correct_answer ?? null,
          is_correct: typeof r.is_correct === 'boolean' ? r.is_correct : null,
        }));

        if (answerRows.length > 0) {
          await db.submissionAnswers.upsertMany(answerRows);
        }
      } else {
        // Fallback to old progress table for guest/standalone practice
        await db.progress.save({
          target_id: testId,
          target_type: 'test',
          status,
          answers,
          attempted_at: new Date().toISOString()
        });
      }
    } catch (e) { 
      console.error('Failed to save progress', e);
      showToast('Cloud save failed. Check your connection.', 'error');
    }
  };

  // Styles moved inside renderTestPlayer
  const injectStyles = () => {
    if (document.getElementById('test-player-styles')) return;
    const style = document.createElement('style');
    style.id = 'test-player-styles';
    style.textContent = `
      .test-player-container {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: var(--color-bg-primary);
        display: flex;
        flex-direction: column;
        z-index: 9999;
        font-family: var(--font-family);
      }
      .test-top-bar {
        height: 72px;
        background: var(--color-bg-glass);
        backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 2rem;
        z-index: 100;
      }
      .test-timer-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
        background: var(--color-bg-tertiary);
        padding: 8px 16px;
        border-radius: var(--border-radius-full);
        border: 1px solid var(--color-border);
      }
      .test-timer {
        font-family: 'JetBrains Mono', 'Roboto Mono', monospace;
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--color-text-primary);
        min-width: 60px;
        text-align: center;
      }
      .timer-icon {
        font-size: 1.1rem;
        animation: pulse 2s infinite;
      }
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      .test-workspace {
        flex: 1;
        display: flex;
        overflow: hidden;
        background: white;
      }
      .test-passage-pane {
        flex: 1.2;
        overflow-y: auto;
        padding: 4rem;
        border-right: 1px solid var(--color-border);
        scroll-behavior: smooth;
      }
      .passage-nav {
        display: flex;
        gap: 4px;
        margin-bottom: 3rem;
        background: var(--color-bg-tertiary);
        border-radius: var(--border-radius-lg);
        padding: 4px;
        width: fit-content;
      }
      .passage-tab {
        padding: 10px 24px;
        border: none;
        background: transparent;
        color: var(--color-text-secondary);
        font-weight: 700;
        font-size: var(--font-size-xs);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        cursor: pointer;
        border-radius: var(--border-radius-sm);
        transition: all var(--transition-base);
      }
      .passage-tab.active {
        background: white;
        color: var(--color-blue);
        box-shadow: var(--shadow-sm);
      }
      .test-questions-pane {
        width: 480px;
        overflow-y: auto;
        padding: 3rem;
        background: #fafbfc;
      }
      .test-bottom-bar {
        height: 64px;
        background: white;
        border-top: 1px solid var(--color-border);
        display: flex;
        align-items: center;
        padding: 0 2rem;
      }
      .progress-track {
        flex: 1;
        height: 4px;
        background: var(--color-bg-tertiary);
        border-radius: 2px;
        margin: 0 2rem;
        position: relative;
        overflow: hidden;
      }
      .progress-fill {
        position: absolute;
        top: 0; left: 0; height: 100%;
        background: var(--gradient-primary);
        transition: width var(--transition-slow);
      }
      .reading-content-test {
        user-select: text;
        font-family: 'Georgia', serif;
        font-size: 1.2rem;
        line-height: 1.8;
        color: #2c3e50;
        max-width: 800px;
      }
      .reading-content-test p {
        margin-bottom: 1.5rem;
      }
      .question-item {
        background: white;
        border-radius: var(--border-radius-lg);
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        border: 1px solid var(--color-border);
        transition: all var(--transition-base);
      }
      .question-item:hover {
        border-color: var(--color-blue);
        box-shadow: var(--shadow-md);
      }
      .question-num {
        display: inline-flex;
        width: 24px;
        height: 24px;
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
        font-size: 11px;
        font-weight: 800;
        border-radius: 6px;
        align-items: center;
        justify-content: center;
        margin-right: 10px;
      }
      .mcq-option {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 18px;
        border: 1.5px solid var(--color-border);
        border-radius: var(--border-radius);
        cursor: pointer;
        transition: all var(--transition-fast);
        background: white;
        margin-bottom: 8px;
        position: relative;
      }
      .mcq-option:hover {
        border-color: var(--color-blue);
        background: var(--color-accent-light);
      }
      .mcq-option.selected {
        border-color: var(--color-blue);
        background: #eff6ff;
        box-shadow: 0 0 0 1px var(--color-blue);
      }
      .option-letter {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--color-bg-tertiary);
        border-radius: 8px;
        font-weight: 800;
        font-size: 0.85rem;
        color: var(--color-text-secondary);
        transition: all var(--transition-fast);
      }
      .mcq-option.selected .option-letter {
        background: var(--color-blue);
        color: white;
      }
      .option-text {
        font-size: var(--font-size-sm);
        font-weight: 500;
      }
      .question-input {
        width: 100%;
        padding: 12px 16px;
        border: 2px solid var(--color-border);
        border-radius: var(--border-radius);
        font-weight: 600;
      }
      .question-input:focus {
        border-color: var(--color-blue);
        box-shadow: 0 0 0 4px var(--color-accent-light);
      }
    `;
    document.head.appendChild(style);
  };

  injectStyles();
  loadTestData();
}
