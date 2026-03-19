import { db, getCurrentUser } from '../utils/supabase.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';

/**
 * GradingHub Page
 * Centralized list of student submissions for teachers to review and grade.
 */
export async function renderGradingHub(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'teacher') {
    container.innerHTML = `<div class="p-12 text-center text-muted">Please log in as a Teacher to access the Grading Hub.</div>`;
    return;
  }

  container.innerHTML = `<div class="p-12 text-center"><div class="spinner"></div></div>`;

  try {
    // 1. Fetch all classrooms belonging to this teacher
    const classrooms = await db.classrooms.listByTeacher(user.id).catch(() => []);
    
    // 2. Fetch all assignments for those classrooms
    const assignmentArrays = await Promise.all(
      classrooms.map(c => db.assignments.listByClassroom(c.id).catch(() => []))
    );
    const allAssignments = assignmentArrays.flat();
    
    // 3. Fetch submissions for each assignment (reading/listening type)
    const readingSubmissionArrays = await Promise.all(
      allAssignments.map(a => db.submissions.listByAssignment(a.id).catch(() => []))
    );
    const readingSubmissions = readingSubmissionArrays.flat();
    
    // 4. Fetch writing/speaking submissions
    const [writing, speaking] = await Promise.all([
      db.writingSubmissions?.listByTeacher ? db.writingSubmissions.listByTeacher(user.id).catch(() => []) : Promise.resolve([]),
      db.speakingSubmissions?.listByTeacher ? db.speakingSubmissions.listByTeacher(user.id).catch(() => []) : Promise.resolve([])
    ]);

    // 5. Merge all submission types
    const assignmentMap = Object.fromEntries(allAssignments.map(a => [a.id, a]));
    const allSubmissions = [
      ...readingSubmissions.map(s => ({
        ...s,
        category: 'reading',
        studentName: s.student_id?.substring(0, 8) || 'Student',
        title: assignmentMap[s.assignment_id]?.title || 'Assignment',
        band_score: s.score_band_equivalent,
        classroom_id: assignmentMap[s.assignment_id]?.classroom_id || null,
        classroom_title: assignmentMap[s.assignment_id]?.classroom_id ? (classrooms.find(c => c.id === assignmentMap[s.assignment_id]?.classroom_id)?.title || '') : ''
      })),
      ...writing.map(s => ({ ...s, category: 'writing', studentName: s.submissions?.profiles?.full_name || 'Student' })),
      ...speaking.map(s => ({ ...s, category: 'speaking', studentName: s.submissions?.profiles?.full_name || 'Student' }))
    ].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    const isPending = (s) => {
      if (s.category === 'reading') return s.status === 'submitted';
      // writing/speaking: rely on submissions row status OR feedback presence
      return !s.feedback_overall;
    };

    // Filter state (client-side)
    const state = {
      classroomId: 'all',
      module: 'all',
      status: 'all',
      days: '30'
    };

    const withinDays = (dateStr, days) => {
      if (!days) return true;
      const d = new Date(dateStr);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(days));
      return d >= cutoff;
    };

    const applyFilters = () => {
      return allSubmissions.filter(s => {
        if (state.module !== 'all' && s.category !== state.module) return false;
        if (state.status === 'pending' && !isPending(s)) return false;
        if (state.status === 'graded' && isPending(s)) return false;
        if (state.classroomId !== 'all') {
          // Only reading submissions are classroom-linked currently
          if (`${s.classroom_id}` !== `${state.classroomId}`) return false;
        }
        if (!withinDays(s.created_at, state.days)) return false;
        return true;
      });
    };

    const computeLeaderboard = (rows) => {
      const counts = new Map();
      rows.forEach(r => {
        const key = r.student_id || r.studentName || 'unknown';
        counts.set(key, (counts.get(key) || 0) + 1);
      });
      const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      return {
        mostActive: sorted[0] ? { key: sorted[0][0], count: sorted[0][1] } : null,
        leastActive: sorted.length > 0 ? { key: sorted[sorted.length - 1][0], count: sorted[sorted.length - 1][1] } : null
      };
    };

    const render = () => {
      const rows = applyFilters();
      const lb = computeLeaderboard(rows);
      const pendingCount = rows.filter(isPending).length;

      container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1140px;margin:0 auto;">
        <div class="page-header mb-8">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-bold">📋 Grading Hub</h1>
              <p class="text-muted">Review and evaluate student performance across all skills.</p>
            </div>
            <div class="flex gap-2">
               <div class="badge badge-outline">Total: ${rows.length}</div>
               <div class="badge badge-yellow">Pending: ${pendingCount}</div>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6">
          <div class="card p-6">
            <div class="grid grid-4 gap-4">
              <div class="input-group">
                <label class="form-label">Classroom</label>
                <select class="input" id="gh-classroom">
                  <option value="all">All</option>
                  ${classrooms.map(c => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('')}
                </select>
              </div>
              <div class="input-group">
                <label class="form-label">Module</label>
                <select class="input" id="gh-module">
                  <option value="all">All</option>
                  <option value="reading">Reading</option>
                  <option value="writing">Writing</option>
                  <option value="speaking">Speaking</option>
                </select>
              </div>
              <div class="input-group">
                <label class="form-label">Status</label>
                <select class="input" id="gh-status">
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="graded">Graded</option>
                </select>
              </div>
              <div class="input-group">
                <label class="form-label">Time window</label>
                <select class="input" id="gh-days">
                  <option value="7">Last 7 days</option>
                  <option value="30" selected>Last 30 days</option>
                  <option value="90">Last 90 days</option>
                  <option value="">All time</option>
                </select>
              </div>
            </div>
            <div class="grid grid-2 gap-4 mt-4">
              <div class="p-4 bg-gray-50 rounded-xl">
                <div class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Most active</div>
                <div class="font-bold">${lb.mostActive ? escapeHtml(lb.mostActive.key).slice(0, 18) : '-'}</div>
                <div class="text-xxs text-muted">${lb.mostActive ? `${lb.mostActive.count} submissions` : ''}</div>
              </div>
              <div class="p-4 bg-gray-50 rounded-xl">
                <div class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Least active</div>
                <div class="font-bold">${lb.leastActive ? escapeHtml(lb.leastActive.key).slice(0, 18) : '-'}</div>
                <div class="text-xxs text-muted">${lb.leastActive ? `${lb.leastActive.count} submissions` : ''}</div>
              </div>
            </div>
            <div class="text-xxs text-muted mt-3 italic">Activity is computed from submissions in the selected time window.</div>
          </div>

          <div class="card p-0 overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 border-b text-xxs font-black text-muted uppercase tracking-wider">
                <tr>
                  <th class="p-4">Student</th>
                  <th class="p-4">Assignment / Skill</th>
                  <th class="p-4">Submitted</th>
                  <th class="p-4">Result</th>
                  <th class="p-4">Status</th>
                  <th class="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                ${rows.length === 0 ? `
                  <tr><td colspan="6" class="p-20 text-center text-muted italic">No submissions found to grade.</td></tr>
                ` : rows.map(s => `
                  <tr class="hover:bg-gray-50 transition-colors">
                    <td class="p-4">
                      <div class="font-bold">${escapeHtml(s.studentName)}</div>
                      <div class="text-xxs text-muted">${s.student_id?.substring(0, 8)}...</div>
                    </td>
                    <td class="p-4">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="badge ${getCategoryBadge(s.category)} text-xxs uppercase">${s.category}</span>
                        ${s.classroom_title ? `<span class="badge badge-outline text-xxs">${escapeHtml(s.classroom_title)}</span>` : ''}
                      </div>
                      <div class="font-medium text-xs truncate max-w-xs">${escapeHtml(s.title || 'Practice Submission')}</div>
                    </td>
                    <td class="p-4 text-xs text-muted">${new Date(s.created_at).toLocaleDateString()}</td>
                    <td class="p-4">
                      <div class="font-bold text-blue-600">${s.band_score || s.ai_analysis?.overall || '-'}</div>
                      ${s.status === 'graded' ? `<div class="text-xxs text-green-600 font-bold">Graded</div>` : ''}
                    </td>
                    <td class="p-4">
                      <span class="badge ${isPending(s) ? 'badge-yellow' : 'badge-green'} text-xxs">
                        ${isPending(s) ? 'Pending' : 'Graded'}
                      </span>
                    </td>
                    <td class="p-4 text-right">
                      <button class="btn btn-secondary btn-xs review-btn" data-id="${s.id}" data-category="${s.category}" data-sub-id="${s.id}">Review</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    function getCategoryBadge(cat) {
      switch(cat) {
        case 'writing': return 'badge-blue';
        case 'speaking': return 'badge-pink';
        case 'reading': return 'badge-green';
        default: return 'badge-outline';
      }
    }

    setupEvents(container);

      // Bind filter controls
      const cSel = document.getElementById('gh-classroom');
      const mSel = document.getElementById('gh-module');
      const sSel = document.getElementById('gh-status');
      const dSel = document.getElementById('gh-days');
      if (cSel) cSel.value = state.classroomId;
      if (mSel) mSel.value = state.module;
      if (sSel) sSel.value = state.status;
      if (dSel) dSel.value = state.days;

      cSel?.addEventListener('change', () => { state.classroomId = cSel.value; render(); });
      mSel?.addEventListener('change', () => { state.module = mSel.value; render(); });
      sSel?.addEventListener('change', () => { state.status = sSel.value; render(); });
      dSel?.addEventListener('change', () => { state.days = dSel.value; render(); });
    };

    render();

  } catch (err) {
    container.innerHTML = `<div class="p-12 text-center text-red-500">Error: ${err.message}</div>`;
  }
}

function setupEvents(container) {
  container.querySelectorAll('.review-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      renderReviewModal(container, btn.dataset.id, btn.dataset.category);
    });
  });
}

export async function renderReviewModal(container, submissionId, category) {
  const user = getCurrentUser();
  if (!user || user.role !== 'teacher') {
    showToast('Teacher access only', 'error');
    return;
  }

  const modalCover = document.createElement('div');
  modalCover.className = 'fixed-overlay flex items-center justify-center';
  modalCover.style.zIndex = '1000';
  modalCover.innerHTML = `<div class="card p-12"><div class="spinner"></div></div>`;
  container.appendChild(modalCover);

  try {
    let detail = null;
    let answers = [];

    if (category === 'writing') {
      detail = await db.writingSubmissions.get(submissionId);
    } else if (category === 'speaking') {
      detail = await db.speakingSubmissions.get(submissionId);
    } else {
      // Reading/Listening Detail
      detail = await db.submissions.get(submissionId);
      answers = await db.submissionAnswers.listBySubmission(submissionId);
    }

    if (!detail) throw new Error('Submission detail not found');

    modalCover.innerHTML = `
      <div class="card animate-fade-in-up" style="width:95%; max-width:1000px; max-height:92vh; overflow:hidden; display:flex; flex-direction:column; padding:0; border:none; box-shadow:var(--shadow-2xl);">
        <div class="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
          <div>
            <h2 class="font-bold">Review ${category.charAt(0).toUpperCase() + category.slice(1)} Submission</h2>
            <div class="text-xxs text-muted uppercase font-black tracking-widest mt-0.5">ID: ${submissionId.substring(0,8)}</div>
          </div>
          <button class="btn btn-ghost btn-sm text-lg" id="close-modal">&times;</button>
        </div>

        <div class="p-8 overflow-auto" style="flex:1;">
          <div class="grid grid-2 gap-10">
            <!-- Left Side: Content or Answers -->
            <div>
              ${category === 'reading' || category === 'listening' ? `
                <h3 class="text-xs font-black text-muted uppercase mb-4 tracking-wider">Detailed Answers</h3>
                <div class="space-y-3">
                  ${answers.length === 0 ? '<p class="text-xs italic text-muted">No individual answers recorded.</p>' : answers.map((a, idx) => `
                    <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div class="flex items-center gap-3">
                        <span class="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-xxs font-bold">${idx + 1}</span>
                        <span class="text-sm font-medium">${escapeHtml(a.user_answer || '')}</span>
                      </div>
                      <span class="badge ${a.is_correct === true ? 'badge-green' : a.is_correct === false ? 'badge-red' : 'badge-outline'} text-xxs">
                        ${a.is_correct === true ? 'Correct' : a.is_correct === false ? 'Wrong' : '—'}
                      </span>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <h3 class="text-xs font-black text-muted uppercase mb-4 tracking-wider">Student Response</h3>
                <div class="bg-gray-50 p-6 rounded-2xl border font-serif leading-relaxed text-sm shadow-inner" style="white-space:pre-wrap; max-height:400px; overflow:auto;">${escapeHtml(detail.content || detail.transcript || 'No content provided.')}</div>
              `}

              <!-- Discussion Section -->
              <div class="mt-8 pt-8 border-t border-gray-100">
                <h3 class="text-xs font-black text-muted uppercase mb-4 tracking-wider">Discussion</h3>
                <div id="modal-comments-list" class="space-y-4 mb-4" style="max-height:300px; overflow:auto;">
                   <div class="flex justify-center p-4"><div class="spinner-sm"></div></div>
                </div>
                <div class="flex gap-2">
                   <input type="text" id="modal-comment-input" class="input flex-1 text-xs" placeholder="Reply to student...">
                   <button class="btn btn-primary btn-xs" id="modal-send-comment-btn">Reply</button>
                </div>
              </div>
            </div>

            <!-- Right Side: AI and Grading -->
            <div class="space-y-8">
              ${category === 'writing' || category === 'speaking' ? `
                <div class="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm">
                  <div class="flex items-center gap-4 mb-4">
                    <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-200">
                      ${detail.band_score || detail.ai_analysis?.overall || '?'}
                    </div>
                    <div>
                      <div class="font-bold text-indigo-900">AI Estimation</div>
                      <div class="text-xxs text-indigo-500 font-bold uppercase tracking-widest">Confidence: High</div>
                    </div>
                  </div>
                  <div class="text-indigo-800 text-xs leading-relaxed max-h-40 overflow-auto pr-2">${escapeHtml(typeof detail.ai_feedback === 'string' ? detail.ai_feedback : JSON.stringify(detail.ai_feedback || 'Analysis in progress...'))}</div>
                </div>
              ` : `
                <div class="p-6 bg-blue-50 rounded-2xl border border-blue-100 shadow-sm">
                   <div class="text-xxs font-black text-blue-500 uppercase tracking-widest mb-2">Calculated Band</div>
                   <div class="text-3xl font-bold text-blue-700">Band ${detail.score_band_equivalent || 'N/A'}</div>
                   <div class="text-xxs text-blue-500 mt-1">Status: ${detail.status}</div>
                </div>
              `}

              <!-- Teacher Grading -->
              <div class="pt-6 border-t border-gray-100">
                <h3 class="text-xs font-black text-muted uppercase mb-4 tracking-wider">Teacher Feedback</h3>
                <div class="space-y-5">
                  <div>
                    <label class="text-xxs font-bold text-muted uppercase mb-1.5 block">Final Band Score</label>
                    <input type="number" step="0.5" min="0" max="9" class="input w-full font-bold" id="teacher-score" value="${detail.score_band_equivalent || ''}" placeholder="0.0 - 9.0">
                  </div>
                  <div>
                     <label class="text-xxs font-bold text-muted uppercase mb-1.5 block">Comments to Student</label>
                     <textarea class="input w-full p-4 text-sm" rows="5" id="teacher-feedback" placeholder="Write constructive feedback here...">${escapeHtml(detail.feedback_overall || '')}</textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 border-t bg-gray-100 flex justify-end gap-3">
          <button class="btn btn-ghost btn-sm font-bold" id="cancel-modal">Discard</button>
          <button class="btn btn-primary btn-sm px-8 shadow-lg shadow-blue-100" id="save-review-btn">Submit Grade</button>
        </div>
      </div>
    `;

    // Handle Comments in Modal
    const refreshComments = async () => {
       const list = modalCover.querySelector('#modal-comments-list');
       if (!list) return;
       const comments = await db.comments.listBySubmission(category === 'reading' || category === 'listening' ? submissionId : detail.submission_id || submissionId);
       list.innerHTML = comments.length === 0 ? '<p class="text-xxs italic text-muted text-center py-4">No comments yet.</p>' : comments.map(c => `
         <div class="flex gap-2 ${c.user_id === user.id ? 'flex-row-reverse' : ''}">
            <div class="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold">${c.profile?.full_name?.charAt(0) || '?'}</div>
            <div class="flex flex-col ${c.user_id === user.id ? 'items-end' : ''}">
               <div class="p-2 px-3 rounded-xl text-xs ${c.user_id === user.id ? 'bg-blue-500 text-white' : 'bg-gray-100'}">${escapeHtml(c.content)}</div>
            </div>
         </div>
       `).join('');
       list.scrollTop = list.scrollHeight;
    };
    refreshComments();

    modalCover.querySelector('#modal-send-comment-btn').addEventListener('click', async () => {
       const input = modalCover.querySelector('#modal-comment-input');
       const text = input.value.trim();
       if (!text) return;
       const subId = category === 'reading' || category === 'listening' ? submissionId : detail.submission_id || submissionId;
       await db.comments.create({ submission_id: subId, user_id: user.id, content: text });
       
       const realSubmission = category === 'reading' || category === 'listening' ? detail : await db.submissions.get(detail.submission_id);
       await db.notifications.create({
          user_id: realSubmission.student_id,
          title: `New message from Teacher`,
          body: text.length > 140 ? text.slice(0, 140) + '...' : text
       });

       input.value = '';
       refreshComments();
    });

    modalCover.querySelector('#close-modal').addEventListener('click', () => container.removeChild(modalCover));
    modalCover.querySelector('#cancel-modal').addEventListener('click', () => container.removeChild(modalCover));
    
    modalCover.querySelector('#save-review-btn').addEventListener('click', async () => {
      const score = parseFloat(modalCover.querySelector('#teacher-score').value);
      const feedback = modalCover.querySelector('#teacher-feedback').value;

      try {
        const updateData = { 
          score_band_equivalent: score, 
          feedback_overall: feedback,
          status: 'graded',
          graded_at: new Date().toISOString()
        };
        
        let realSubmission = detail;
        if (category === 'writing') {
          await db.writingSubmissions.update(submissionId, updateData);
          realSubmission = await db.submissions.get(detail.submission_id);
        } else if (category === 'speaking') {
          await db.speakingSubmissions.update(submissionId, updateData);
          realSubmission = await db.submissions.get(detail.submission_id);
        } else {
          await db.submissions.createOrUpdate({ id: submissionId, ...updateData });
        }

        // Notify Student
        await db.notifications.create({
           user_id: realSubmission.student_id,
           title: `Assignment Graded: Band ${score}`,
           body: `Your teacher has reviewed your assignment.`
        });

        showToast('Grade submitted successfully!', 'success');
        container.removeChild(modalCover);
        renderGradingHub(container);
      } catch (err) {
        showToast('Failed to save grade: ' + err.message, 'error');
      }
    });

  } catch (err) {
    modalCover.innerHTML = `<div class="card p-12 text-center text-red-500">Error: ${err.message}<br><button class="btn btn-ghost btn-sm mt-4" onclick="this.parentElement.parentElement.parentElement.remove()">Close</button></div>`;
  }
}
