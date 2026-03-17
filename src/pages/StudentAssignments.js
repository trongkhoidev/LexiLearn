import { db, getCurrentUser } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/Toast.js';

export async function renderStudentAssignments(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'student') {
    container.innerHTML = `<div class="card p-12 text-center">Please log in as a student to see your assignments.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="flex items-center justify-center p-12">
      <div class="spinner"></div>
    </div>
  `;

  try {
    // 1. Find classrooms student is in
    const memberships = await db.classrooms.listForStudent(user.id);
    const classroomIds = memberships.map(m => m.classrooms?.id).filter(Boolean);

    if (classroomIds.length === 0) {
      container.innerHTML = `
        <div class="animate-fade-in-up" style="max-width:800px;margin:0 auto;">
          <div class="page-header">
            <h1>📝 My Assignments</h1>
            <p>Tasks and tests assigned to you by your teachers.</p>
          </div>
          <div class="card empty-state">
            <div class="empty-state-icon">🎓</div>
            <div class="empty-state-title">No classrooms yet</div>
            <p class="empty-state-text">Ask your teacher to add you to a classroom via your ID.</p>
            <div class="p-4 bg-gray-50 rounded-lg text-xs font-mono select-all">${user.id}</div>
          </div>
        </div>
      `;
      return;
    }

    // 2. Fetch assignments for those classrooms
    const allAssignments = await Promise.all(
      classroomIds.map(id => db.assignments.listByClassroom(id))
    );
    const assignments = allAssignments.flat();

    // 3. Fetch student's submissions to check status
    const submissions = await db.submissions.listByStudent(user.id);

    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:800px;margin:0 auto;">
        <div class="page-header">
          <h1>📝 My Assignments</h1>
          <p>Tasks and tests assigned to you by your teachers.</p>
        </div>

        <div class="grid gap-4">
          ${assignments.map(a => {
            const submission = submissions.find(s => s.assignment_id === a.id);
            const statusLabel = !submission ? 'Assigned' : (
              submission.status === 'graded' ? 'Graded' :
              submission.status === 'submitted' ? 'Submitted' :
              submission.status === 'in_progress' ? 'In progress' :
              submission.status
            );
            const statusClass = submission?.status === 'graded'
              ? 'badge-green'
              : submission?.status === 'submitted'
                ? 'badge-yellow'
                : submission
                  ? 'badge-warn'
                  : 'badge-outline';

            return `
              <div class="card card-interactive assignment-card flex items-center justify-between" data-id="${a.id}" data-source-type="${a.source_type}" data-ref-id="${a.source_ref_id}">
                <div>
                  <h3 class="font-bold text-md">${a.title}</h3>
                  <p class="text-xs text-muted">${a.module} · ${a.task_type || 'Custom'}</p>
                </div>
                <div class="flex items-center gap-4">
                  ${submission?.score_band_equivalent !== null && submission?.score_band_equivalent !== undefined ? `<span class="font-bold text-pink-600">Band ${submission.score_band_equivalent}</span>` : ''}
                  <span class="badge ${statusClass} text-xxs">${statusLabel}</span>
                  <button class="btn btn-primary btn-sm take-assignment-btn" data-id="${a.id}">
                    ${submission?.status === 'submitted' || submission?.status === 'graded' ? 'Review' : (submission ? 'Resume' : 'Start')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        ${assignments.length === 0 ? `
           <div class="card p-8 text-center text-muted italic">
             No specific assignments found for your current classes.
           </div>
        ` : ''}
      </div>
    `;

    container.querySelectorAll('.assignment-card').forEach(card => {
       card.addEventListener('click', (e) => {
         if (e.target.closest('.take-assignment-btn')) return;
         navigateTo(`/assignment/${card.dataset.id}`);
       });
    });

    container.querySelectorAll('.take-assignment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.assignment-card');
        handleStart(card.dataset.id, card.dataset.sourceType, card.dataset.refId);
      });
    });

    function handleStart(assignmentId, sourceType, sourceRefId) {
      if (sourceType === 'cambridge_library') {
        // Navigate to test player with assignment context
        navigateTo(`/test/${sourceRefId}?assignmentId=${assignmentId}`);
      } else {
        showToast('Only Cambridge tests assignments are playable for now.', 'info');
      }
    }

  } catch (err) {
    container.innerHTML = `<div class="card p-8 text-red-600">Error: ${err.message}</div>`;
  }
}
