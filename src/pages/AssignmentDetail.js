import { db, getCurrentUser } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../utils/helpers.js';
import { showToast } from '../components/Toast.js';

// Assuming renderReviewModal is exported from GradingHub.js
import { renderReviewModal } from './GradingHub.js';

export async function renderAssignmentDetail(container, params) {
  const assignmentId = params.id;
  const user = getCurrentUser();

  if (!user) {
    container.innerHTML = `<div class="card p-12 text-center text-muted">Please log in to view assignment details.</div>`;
    return;
  }

  const isTeacher = user.role === 'teacher';

  container.innerHTML = `
    <div class="flex items-center justify-center p-12">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const assignment = await db.assignments.get(assignmentId);
    if (!assignment) {
      container.innerHTML = `<div class="card p-8 text-center text-red-600">Assignment not found.</div>`;
      return;
    }

    if (isTeacher) {
      await renderTeacherView(container, assignment, user);
    } else {
      await renderStudentView(container, assignment, user);
    }
  } catch (err) {
    container.innerHTML = `<div class="card p-8 text-red-600">Error: ${err.message}</div>`;
  }
}

async function renderTeacherView(container, assignment, user) {
  const [submissions, members] = await Promise.all([
    db.submissions.listByAssignment(assignment.id),
    db.classroomMembers.listByClassroom(assignment.classroom_id)
  ]);

  const studentStatus = members.map(member => {
    const submission = submissions.find(s => s.student_id === member.student_id);
    return {
      profile: member.profile,
      student_id: member.student_id,
      status: submission ? (submission.status === 'submitted' || submission.status === 'graded' ? 'Submitted' : 'Draft') : 'Missing',
      score: submission?.score_band_equivalent,
      submitted_at: submission?.submitted_at || submission?.created_at,
      submission_id: submission?.id
    };
  });

  container.innerHTML = `
    <div class="animate-fade-in-up" style="max-width:960px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" id="back-to-class">← Back to Class</button>
      
      <div class="page-header" style="margin-top:var(--space-4);">
        <div class="flex items-center justify-between">
          <div>
            <h1 style="margin-bottom:4px;">${assignment.title}</h1>
            <p class="text-sm text-muted">${assignment.module} · ${assignment.task_type || 'General Task'}</p>
          </div>
          <div class="badge badge-accent uppercase tracking-widest text-xxs font-black">${assignment.status}</div>
        </div>
      </div>

      <div class="grid grid-3 mb-8 gap-4">
        <div class="card p-6 text-center border-b-4 border-b-blue-500">
          <div class="text-3xl font-bold text-blue-600">${studentStatus.filter(s => s.status === 'Submitted').length} / ${studentStatus.length}</div>
          <div class="text-xxs text-muted uppercase font-black mt-2">Submissions</div>
        </div>
        <div class="card p-6 text-center">
          <div class="text-3xl font-bold">${assignment.time_limit_minutes || '∞'}</div>
          <div class="text-xxs text-muted uppercase font-black mt-2">Time Limit (Min)</div>
        </div>
        <div class="card p-6 text-center">
          <div class="text-3xl font-bold">${assignment.allow_multiple_submissions ? '∞' : '1'}</div>
          <div class="text-xxs text-muted uppercase font-black mt-2">Max Attempts</div>
        </div>
      </div>

      <div class="card p-0 overflow-hidden">
        <div class="p-6 border-b"><h2 class="font-bold">Student Progress</h2></div>
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-xxs font-black text-muted uppercase tracking-wider">
            <tr>
              <th class="p-4">Student</th>
              <th class="p-4 text-center">Status</th>
              <th class="p-4 text-center">Final Score</th>
              <th class="p-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            ${studentStatus.map(s => `
              <tr class="hover:bg-gray-50 transition-colors">
                <td class="p-4">
                  <div class="font-bold">${s.profile?.full_name || 'Student'}</div>
                  <div class="text-xxs text-muted">${s.profile?.email || s.student_id}</div>
                </td>
                <td class="p-4 text-center">
                  <span class="badge ${s.status === 'Submitted' ? 'badge-green' : s.status === 'Draft' ? 'badge-yellow' : 'badge-outline'} text-xxs">
                    ${s.status}
                  </span>
                </td>
                <td class="p-4 text-center font-bold text-blue-600">
                  ${s.score !== null && s.score !== undefined ? `Band ${s.score}` : '-'}
                </td>
                <td class="p-4 text-right">
                  ${s.submission_id ? `<button class="btn btn-secondary btn-xs review-btn" data-id="${s.submission_id}">Review</button>` : '<span class="text-xxs text-muted italic">No submission</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('back-to-class')?.addEventListener('click', () => navigateTo(`/class/${assignment.classroom_id}`));
  container.querySelectorAll('.review-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const subId = btn.dataset.id;
      renderReviewModal(container, subId, 'reading');
    });
  });
}

async function renderStudentView(container, assignment, user) {
  const submissions = await db.submissions.listByStudent(user.id);
  const mySub = submissions.find(s => s.assignment_id === assignment.id);

  container.innerHTML = `
    <div class="animate-fade-in-up" style="max-width:800px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" id="back-to-list">← My Assignments</button>

      <div class="page-header" style="margin-top:var(--space-6);">
        <div class="flex items-center justify-between">
          <div>
             <div class="text-xxs font-black text-blue-500 uppercase tracking-widest mb-1">${assignment.module}</div>
             <h1 class="text-3xl font-bold">${assignment.title}</h1>
          </div>
          <div class="flex flex-col items-end">
             <span class="badge ${mySub?.status === 'graded' ? 'badge-green' : mySub ? 'badge-yellow' : 'badge-outline'} mb-1">${mySub?.status || 'Assigned'}</span>
             ${assignment.due_at ? `<span class="text-xxs text-muted">Due: ${new Date(assignment.due_at).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="grid grid-2 gap-6 mb-8">
        <div class="card flex flex-col items-center justify-center p-8 text-center">
           <div class="text-xxs font-black text-muted uppercase tracking-widest mb-2">My Result</div>
           <div class="text-4xl font-black text-blue-600">${mySub?.score_band_equivalent ? `Band ${mySub.score_band_equivalent}` : '--'}</div>
           <div class="text-xxs text-muted mt-2">${mySub ? 'Final Assessment' : 'No submission yet'}</div>
        </div>
        <div class="card p-8">
           <h3 class="text-xs font-black text-muted uppercase mb-4 tracking-wider">Assignment Info</h3>
           <div class="space-y-3">
              <div class="flex justify-between text-sm">
                 <span class="text-muted">Task Type:</span>
                 <span class="font-bold">${assignment.task_type || 'General'}</span>
              </div>
              <div class="flex justify-between text-sm">
                 <span class="text-muted">Time Limit:</span>
                 <span class="font-bold">${assignment.time_limit_minutes || 'No limit'} mins</span>
              </div>
              <div class="flex justify-between text-sm">
                 <span class="text-muted">Max Attempts:</span>
                 <span class="font-bold">${assignment.allow_multiple_submissions ? '∞' : '1'}</span>
              </div>
           </div>
           
           ${mySub?.status === 'submitted' || mySub?.status === 'graded'
             ? `<button class="btn btn-outline w-full mt-6" disabled>Submitted</button>`
             : `<button class="btn btn-primary w-full mt-6" id="start-now-btn">${mySub?.status === 'in_progress' ? 'Continue Task' : 'Start Task Now'}</button>`
           }
        </div>
      </div>

      ${mySub?.feedback_overall ? `
        <div class="card border-l-4 border-l-green-500 bg-green-50/30 mb-8">
           <h3 class="text-xs font-black text-green-700 uppercase mb-4 tracking-wider">Teacher Feedback</h3>
           <div class="text-gray-800 leading-relaxed italic">"${escapeHtml(mySub.feedback_overall)}"</div>
           <div class="mt-4 pt-4 border-t border-green-100 flex items-center justify-between">
              <span class="text-xxs font-bold text-green-600">Graded on ${new Date(mySub.updated_at).toLocaleDateString()}</span>
              <span class="font-bold text-sm text-green-700">Official Score: Band ${mySub.score_band_equivalent || '-'}</span>
           </div>
        </div>
      ` : mySub?.status === 'submitted' ? `
        <div class="card text-center py-12 bg-gray-50 border-dashed border-2 mb-8">
           <div class="text-2xl mb-2">⏳</div>
           <p class="text-sm text-muted">Your submission is pending review by your teacher.</p>
        </div>
      ` : ''}

      ${mySub ? `
        <div id="comments-section" class="card p-6">
           <h3 class="font-bold mb-6">Discussion</h3>
           <div id="comments-list" class="space-y-4 mb-6">
              <div class="flex justify-center p-4"><div class="spinner-sm"></div></div>
           </div>
           <div class="flex gap-3">
              <input type="text" id="comment-input" class="input flex-1" placeholder="Type a message or question about this task...">
              <button class="btn btn-primary btn-sm" id="send-comment-btn">Send</button>
           </div>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById('back-to-list')?.addEventListener('click', () => navigateTo('/my-assignments'));
  document.getElementById('start-now-btn')?.addEventListener('click', () => {
    if (assignment.source_type === 'cambridge_library') {
      navigateTo(`/test/${assignment.source_ref_id}?assignmentId=${assignment.id}`);
    } else {
       showToast('Content not available for player.', 'info');
    }
  });

  if (mySub) {
    renderComments(mySub, user, assignment);
  }
}

async function renderComments(submission, user, assignment) {
  const container = document.getElementById('comments-list');
  if (!container) return;

  try {
    const comments = await db.comments.listBySubmission(submission.id);
    if (comments.length === 0) {
      container.innerHTML = `<p class="text-center text-xs text-muted py-4 italic">No messages yet. Start a discussion with your teacher.</p>`;
    } else {
      container.innerHTML = comments.map(c => `
        <div class="flex gap-3 ${c.user_id === user.id ? 'flex-row-reverse' : ''}">
           <div class="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-xs">
              ${c.profile?.full_name?.charAt(0) || '?'}
           </div>
           <div class="flex flex-col ${c.user_id === user.id ? 'items-end' : ''}">
              <div class="flex items-center gap-2 mb-1">
                 <span class="text-xxs font-bold">${c.profile?.full_name}</span>
                 <span class="text-xxxs text-muted">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="p-3 rounded-2xl text-sm ${c.user_id === user.id ? 'bg-blue-500 text-white rounded-tr-none' : 'bg-gray-100 text-gray-800 rounded-tl-none'}">
                ${escapeHtml(c.content)}
              </div>
           </div>
        </div>
      `).join('');
    }

    // Scroll to bottom
    const parent = container.parentElement;
    parent.scrollTop = parent.scrollHeight;

  } catch (err) {
    container.innerHTML = `<p class="text-center text-red-500 text-xs">${err.message}</p>`;
  }

  const sendBtn = document.getElementById('send-comment-btn');
  const input = document.getElementById('comment-input');

  const postComment = async () => {
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    try {
      await db.comments.create({
        submission_id: submission.id,
        user_id: user.id,
        content: text
      });

      // Notify the other party
      const isTeacher = user.role === 'teacher';
      const targetUserId = isTeacher ? submission.student_id : assignment.teacher_id;
      
      await db.notifications.create({
        user_id: targetUserId,
        title: `New message for ${assignment.title}`,
        body: `${user.full_name}: ${text.length > 140 ? text.slice(0, 140) + '...' : text}`
      });

      renderComments(submission, user, assignment);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  if (sendBtn) sendBtn.onclick = postComment;
  if (input) input.onkeypress = (e) => { if (e.key === 'Enter') postComment(); };
}
