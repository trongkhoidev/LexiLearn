import { exerciseService } from '../services/exercise.service.js';
import { getCurrentUser } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { renderQuestionBlock } from '../components/QuestionBlock.js';
import { aiGradingService } from '../services/ai-grading.service.js';

export async function renderExamResults(container, params) {
  const submissionId = params.id;
  const user = getCurrentUser();

  container.innerHTML = `<div class="flex items-center justify-center h-screen"><div class="spinner"></div></div>`;

  try {
    const submission = await exerciseService.getSubmission(submissionId);
    if (!submission) {
      container.innerHTML = `<div class="p-20 text-center">Submission not found.</div>`;
      return;
    }

    const exam = await exerciseService.getExam(submission.exam_id);
    const answersMap = {};
    submission.exam_answers.forEach(a => {
      answersMap[a.question_num] = a;
    });

    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1000px;margin:0 auto;padding:40px 20px;">
        <div class="flex items-center justify-between mb-10">
          <button class="btn btn-ghost btn-sm" onclick="window.history.back()">← Back</button>
          <div class="text-right">
            <div class="text-xxs font-black text-muted uppercase tracking-widest">Completed on</div>
            <div class="font-bold">${new Date(submission.submitted_at).toLocaleString()}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div class="lg:col-span-2">
            <h1 class="text-4xl font-bold mb-2">${exam.title}</h1>
            <p class="text-muted mb-6">You've completed the ${exam.module} module. Here is your performance breakdown.</p>
            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div class="card p-6 text-center">
                <div class="text-2xl font-black text-blue-600">${submission.score_band || (exam.module === 'writing' || exam.module === 'speaking' ? 'Pro.' : '---')}</div>
                <div class="text-xxs font-black text-muted uppercase tracking-widest mt-1">
                  ${exam.module === 'writing' || exam.module === 'speaking' ? 'Productive' : 'Band Score'}
                </div>
              </div>
              <div class="card p-6 text-center">
                <div class="text-2xl font-black text-gray-800">${submission.score_raw} / ${submission.score_total}</div>
                <div class="text-xxs font-black text-muted uppercase tracking-widest mt-1">Raw Score</div>
              </div>
              <div class="card p-6 text-center">
                <div class="text-2xl font-black text-gray-800">${Math.floor(submission.time_spent_secs / 60)}m</div>
                <div class="text-xxs font-black text-muted uppercase tracking-widest mt-1">Time Spent</div>
              </div>
              <div class="card p-6 text-center">
                <div class="text-2xl font-black text-green-600">${Math.round((submission.score_raw / submission.score_total) * 100)}%</div>
                <div class="text-xxs font-black text-muted uppercase tracking-widest mt-1">Accuracy</div>
              </div>
            </div>
          </div>

          <div class="card p-8 bg-blue-600 text-white flex flex-col justify-center items-center text-center">
             <div class="text-6xl mb-4">🏆</div>
             <h3 class="text-xl font-bold mb-2">Great Effort!</h3>
             <p class="text-sm text-blue-100 mb-6">Review your mistakes below to improve your score next time.</p>
             <button class="btn btn-white btn-sm w-full mb-2" onclick="window.print()">Download PDF Report</button>
             <button class="btn btn-white btn-sm w-full opacity-80" id="export-csv-btn">Export Raw Data (CSV)</button>
          </div>
        </div>

        <div class="space-y-12">
          <h2 class="text-2xl font-bold border-b pb-4">Detailed Review</h2>
          ${exam.question_blocks.sort((a,b) => a.block_order - b.block_order).map(block => `
            <div class="result-block">
               <div class="flex items-center gap-3 mb-6">
                  <span class="badge badge-outline uppercase text-xxs font-black">${block.block_type.replace(/_/g, ' ')}</span>
                  <span class="text-sm font-bold text-gray-500">Questions ${block.question_start}—${block.question_end}</span>
               </div>
               <div class="space-y-4">
                  ${Array.from({ length: block.question_end - block.question_start + 1 }, (_, i) => block.question_start + i).map(num => {
                    const ans = answersMap[num];
                    const correctValue = block.answers[num.toString()] || block.answers[num];
                    const isCorrect = ans?.is_correct;
                    const userVal = ans ? (ans.user_answers || ans.user_answer) : null;
                    const isProductive = block.block_type.startsWith('writing') || block.block_type.startsWith('speaking');

                    return `
                      <div class="flex flex-col gap-4 p-6 rounded-3xl border ${isProductive ? 'bg-blue-50/20 border-blue-100' : (isCorrect ? 'bg-green-50/30 border-green-100' : 'bg-red-50/30 border-red-100')} animate-fade-in">
                        <div class="flex items-start gap-4">
                          <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${isProductive ? 'bg-blue-100 text-blue-700' : (isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}">
                            ${num}
                          </div>
                          <div class="flex-1">
                            <div class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Your Response</div>
                            ${block.block_type.startsWith('writing') ? `
                              <div class="prose prose-sm max-w-none text-gray-800 line-clamp-3">${ans?.essay_text || 'No response'}</div>
                            ` : block.block_type.startsWith('speaking') ? `
                              ${ans?.audio_url ? `<audio src="${ans.audio_url}" controls class="h-8 w-full max-w-xs"></audio>` : '<div class="italic text-gray-400">No recording</div>'}
                            ` : `
                              <div class="font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}">${formatAnswer(userVal)}</div>
                            `}
                          </div>
                          <div class="text-xl">${isProductive ? '✍️' : (isCorrect ? '✅' : '❌')}</div>
                        </div>

                        ${ans?.student_notes ? `
                          <div class="mt-3 p-3 bg-yellow-50/50 border border-yellow-100 rounded-xl">
                            <div class="text-[10px] font-black text-yellow-700 uppercase tracking-widest mb-1">Student Evidence/Notes</div>
                            <p class="text-xs text-yellow-800 italic">"${ans.student_notes}"</p>
                          </div>
                        ` : ''}

                        ${ans?.ai_analysis ? `
                          <div class="ai-feedback mt-4 pt-4 border-t border-blue-100">
                            <div class="flex items-center justify-between mb-3">
                              <div class="flex items-center gap-2">
                                <span class="text-lg">🤖</span>
                                <span class="text-xs font-black text-blue-600 uppercase tracking-widest">AI Expert Evaluation — Band ${ans.ai_analysis.band_score || 'N/A'}</span>
                              </div>
                              ${user.role === 'teacher' ? `<button class="btn btn-ghost btn-xxs text-blue-600 edit-score-btn" data-qnum="${num}">Override Score</button>` : ''}
                            </div>
                            <p class="text-sm text-gray-700 mb-4">${ans.ai_analysis.overall_feedback || 'AI analysis pending or incomplete.'}</p>
                            
                            ${ans.ai_analysis.criteria ? `
                              <div class="grid grid-cols-2 gap-3 mb-4">
                                ${Object.entries(ans.ai_analysis.criteria).map(([key, data]) => `
                                  <div class="bg-white/50 p-3 rounded-xl border border-blue-50">
                                    <div class="text-xxs font-black text-muted uppercase mb-1">${key.replace(/_/g, ' ')}</div>
                                    <div class="flex items-center justify-between">
                                      <span class="text-xs text-gray-700 font-medium">${typeof data === 'object' ? data.score : data}</span>
                                      <span class="text-xxs text-blue-600">★</span>
                                    </div>
                                  </div>
                                `).join('')}
                              </div>
                            ` : ''}

                            ${ans.ai_analysis.improvement_tips ? `
                              <div class="bg-blue-50 p-4 rounded-xl">
                                <span class="text-xxs font-black text-blue-700 uppercase block mb-2">Improvement Tips</span>
                                <ul class="text-xs text-blue-800 space-y-1">
                                  ${ans.ai_analysis.improvement_tips.map(tip => `<li>• ${tip}</li>`).join('')}
                                </ul>
                              </div>
                            ` : ''}
                          </div>
                        ` : isProductive && user.role === 'teacher' ? `
                          <div class="mt-4 pt-4 border-t flex justify-end">
                             <button class="btn btn-primary btn-sm run-ai-btn" data-qnum="${num}">Run AI Analysis</button>
                          </div>
                        ` : ''}

                        ${!isProductive && !isCorrect ? `
                          <div class="mt-2 text-xs">
                            <span class="text-muted">Correct Answer:</span> <span class="font-bold text-gray-800">${formatAnswer(correctValue)}</span>
                          </div>
                        ` : ''}
                      </div>
                    `;
                  }).join('')}
               </div>
            </div>
          `).join('')}
        </div>

        <div class="mt-20 pt-10 border-t flex justify-center gap-4">
          <button class="btn btn-secondary px-8" onclick="navigateTo('/classes')">Back to Classroom</button>
          <button class="btn btn-primary px-8" onclick="navigateTo('/exams')">Take Another Exam</button>
        </div>
      </div>
    `;

    if (user.role === 'teacher') setupTeacherEvents();
    setupExportEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }

  function setupExportEvents() {
    container.querySelector('#export-csv-btn')?.addEventListener('click', () => {
      const rows = [
        ['Question', 'User Answer', 'Correct Answer', 'Is Correct', 'Band Score', 'AI Feedback'],
        ...exam.question_blocks.flatMap(block => {
          return Array.from({ length: block.question_end - block.question_start + 1 }, (_, i) => {
            const num = block.question_start + i;
            const ans = answersMap[num];
            return [
              num,
              ans?.user_answers || ans?.user_answer || ans?.essay_text || '',
              block.answers[num.toString()] || '',
              ans?.is_correct || '',
              ans?.ai_analysis?.band_score || '',
              ans?.ai_analysis?.overall_feedback?.replace(/"/g, '""') || ''
            ];
          });
        })
      ];

      const csvContent = rows.map(e => e.join(",")).join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `ielts_results_${submissionId}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  function setupTeacherEvents() {
    container.querySelectorAll('.run-ai-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const qNum = btn.dataset.qnum;
        btn.disabled = true;
        btn.textContent = 'Analyzing...';
        
        try {
          const ans = submission.exam_answers.find(a => a.question_num == qNum);
          const block = exam.question_blocks.find(b => qNum >= b.question_start && qNum <= b.question_end);
          
          let result;
          if (block.block_type.startsWith('writing')) {
            result = await aiGradingService.gradeWriting(ans.essay_text, block.block_type, block.instruction);
          } else if (block.block_type.startsWith('speaking')) {
            showToast('Speaking AI evaluation requires audio transcription (Phase 3).', 'info');
            btn.disabled = false;
            btn.textContent = 'Run AI Analysis';
            return;
          }

          // Save AI result to DB
          await exerciseService.saveAnswer({
            id: ans.id,
            ai_analysis: result,
            score: result.band_score
          });

          showToast('AI Analysis completed!', 'success');
          renderExamResults(container, params); // Refresh
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Run AI Analysis';
        }
      });
    });

    container.querySelectorAll('.edit-score-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const qNum = btn.dataset.qnum;
        const newScore = prompt('Enter new Band Score (e.g. 7.5):');
        if (newScore === null) return;

        const scoreNum = parseFloat(newScore);
        if (isNaN(scoreNum)) return showToast('Invalid score', 'error');

        try {
          const ans = submission.exam_answers.find(a => a.question_num == qNum);
          await exerciseService.saveAnswer({
            id: ans.id,
            score: scoreNum
          });

          showToast('Score updated!', 'success');
          renderExamResults(container, params); // Refresh
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  }

  function formatAnswer(val) {
    if (val === null || val === undefined || val === '') return '<span class="italic text-gray-400">Empty</span>';
    if (Array.isArray(val)) return val.join(', ');
    return val;
  }
}
