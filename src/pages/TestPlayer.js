/* ============================================
   LexiLearn — IELTS Test Player
   ============================================
   Split-screen interface for Cambridge IELTS tests.
*/

import { escapeHtml } from '../utils/helpers.js';
import { lookupWord, buildTooltipHTML } from '../utils/wordLookup.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';

import { db, isDbConfigured } from '../utils/supabase.js';

export function renderTestPlayer(container, params) {
  const testId = params.id;
  let testData = null;
  let currentPassageIndex = 0;
  let timeLeft = 60 * 60;
  let timerInterval = null;
  let answers = {};

  const loadTestData = async () => {
    try {
      testData = await db.books.getTree(testId);
      if (!testData) throw new Error('Test not found in cloud database');
      renderLayout();
    } catch (err) {
      container.innerHTML = `<div class="card" style="padding:2rem;text-align:center;"><h3>${err.message}</h3><p class="mt-2 text-muted">Ensure you have uploaded the Cambridge PDF for this test.</p><button class="btn btn-primary mt-4" onclick="window.location.hash='/cambridge'">Go Back</button></div>`;
    }
  };

  const renderLayout = () => {
    container.innerHTML = `
      <div class="test-player-container">
        <div class="test-top-bar">
          <div class="flex items-center gap-4">
            <button class="btn btn-ghost btn-sm" id="exit-test">Exit</button>
            <div style="font-weight:700;font-size:1.1rem;">${escapeHtml(testData.title || 'IELTS Reading')}</div>
          </div>
          <div class="flex items-center gap-6">
            <div id="test-timer" class="test-timer">60:00</div>
            <button class="btn btn-primary btn-sm" id="finish-test-btn">Finish Test</button>
          </div>
        </div>

        <div class="test-workspace">
          <div class="test-passage-pane" id="passage-pane">
            <div class="passage-nav">
              ${(testData.passages || [1,2,3]).map((p, i) => `
                <button class="passage-tab ${currentPassageIndex === i ? 'active' : ''}" data-idx="${i}">Passage ${i+1}</button>
              `).join('')}
            </div>
            <div id="passage-content-area"></div>
          </div>
          <div class="test-questions-pane" id="questions-area">
            <!-- Questions load here -->
            <div class="card" style="padding:var(--space-6);text-align:center;color:#6b7280;">Questions for this section will appear here.</div>
          </div>
        </div>

        <div class="test-bottom-bar"><div class="question-palette" id="question-palette"></div></div>
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
        await saveProgress('completed');
        showToast('Test submitted successfully!', 'success');
        navigateTo('/cambridge');
      }
    });

    document.getElementById('exit-test')?.addEventListener('click', () => {
      if (confirm('Exit without saving?')) {
        clearInterval(timerInterval);
        navigateTo('/cambridge');
      }
    });
  };

  const renderPassage = () => {
    const passage = testData.passages?.[currentPassageIndex] || { title: 'Reading Passage', content: '...' };
    const area = document.getElementById('passage-content-area');
    if (!area) return;

    area.innerHTML = `
      <h2 style="font-size:1.8rem;font-weight:800;margin-bottom:2rem;">${escapeHtml(passage.title)}</h2>
      <div class="reading-content-test">${passage.content || 'Content not available'}</div>
    `;
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
      if (timeLeft <= 0) { clearInterval(timerInterval); saveProgress('completed'); }
    }, 1000);
  };

  const saveProgress = async (status = 'in_progress') => {
    try {
      await db.progress.save({
        target_id: testId,
        target_type: 'test',
        status,
        answers,
        attempted_at: new Date().toISOString()
      });
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
        background: #f3f4f6;
        display: flex;
        flex-direction: column;
        z-index: 9999;
      }
      .test-top-bar {
        height: 60px;
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 1.5rem;
      }
      .test-timer {
        font-family: monospace;
        font-size: 1.5rem;
        font-weight: 700;
        color: #374151;
      }
      .test-workspace {
        flex: 1;
        display: flex;
        overflow: hidden;
      }
      .test-passage-pane {
        flex: 1;
        overflow-y: auto;
        background: #ffffff;
        padding: 2rem;
        border-right: 1px solid #e5e7eb;
      }
      .passage-nav {
        display: flex;
        gap: 2px;
        margin-bottom: 2rem;
        background: #f3f4f6;
        border-radius: 4px;
        padding: 4px;
      }
      .passage-tab {
        flex: 1;
        padding: 8px;
        border: none;
        background: transparent;
        color: #6b7280;
        font-weight: 600;
        cursor: pointer;
        border-radius: 4px;
      }
      .passage-tab.active {
        background: #ffffff;
        color: #3B82F6;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .test-questions-pane {
        width: 450px;
        overflow-y: auto;
        padding: 2rem;
        background: #f9fafb;
      }
      .test-bottom-bar {
        height: 80px;
        background: #ffffff;
        border-top: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
        padding: 0 1.5rem;
      }
      .question-palette {
        display: flex;
        gap: 8px;
        overflow-x: auto;
      }
      .reading-content-test {
        user-select: text;
        font-family: serif;
        font-size: 1.15rem;
      }
    `;
    document.head.appendChild(style);
  };

  injectStyles();
  loadTestData();
}
