import { db, getCurrentUser } from '../utils/supabase.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';
import { openCambridgePicker } from '../components/CambridgePicker.js';
import { showModal } from '../components/Modal.js';
import { debounce } from '../utils/helpers.js';
import { exerciseService } from '../services/exercise.service.js';

export async function renderClassroomDetail(container, params) {
  const classroomId = params.id;
  const user = getCurrentUser();
  const isTeacher = user?.role === 'teacher';
  let activeTab = isTeacher ? 'students' : 'assignments'; // default tabs

  const renderTabs = () => `
    <div class="flex border-b mb-6 mt-6">
      ${isTeacher ? `<button class="px-6 py-3 font-bold text-sm tab-btn ${activeTab === 'students' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-muted'}" data-tab="students">Students</button>` : ''}
      <button class="px-6 py-3 font-bold text-sm tab-btn ${activeTab === 'assignments' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-muted'}" data-tab="assignments">Assignments</button>
      <button class="px-6 py-3 font-bold text-sm tab-btn ${activeTab === 'materials' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-muted'}" data-tab="materials">Materials</button>
      <button class="px-6 py-3 font-bold text-sm tab-btn ${activeTab === 'announcements' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-muted'}" data-tab="announcements">Announcements</button>
      ${!isTeacher ? `<button class="px-6 py-3 font-bold text-sm tab-btn ${activeTab === 'progress' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-muted'}" data-tab="progress">My Progress</button>` : ''}
    </div>
  `;

  const render = async () => {
    container.innerHTML = `
      <div class="flex items-center justify-center p-12"><div class="spinner"></div></div>
    `;

    try {
      const classroom = await db.classrooms.get(classroomId);
      if (!classroom) {
        container.innerHTML = `<div class="card p-8 text-center text-red-600">Classroom not found.</div>`;
        return;
      }

      const [members, assignments, submissions, announcements] = await Promise.all([
        db.classroomMembers.listByClassroom(classroomId),
        db.assignments.listByClassroom(classroomId),
        !isTeacher ? db.submissions.listByStudent(user.id) : Promise.resolve([]),
        db.announcements.listByClassroom(classroomId)
      ]);

      container.innerHTML = `
        <div class="animate-fade-in-up" style="max-width:1040px;margin:0 auto;">
          <button class="btn btn-ghost btn-sm" id="back-to-classes">← All Classrooms</button>

          <div class="page-header" style="margin-top:var(--space-4);">
            <div class="flex items-center justify-between">
               <div>
                  <h1 class="text-3xl font-bold">${classroom.title || 'Classroom'}</h1>
                  <p class="text-muted">${classroom.description || 'Classroom overview.'}</p>
               </div>
               <div class="flex items-center gap-2">
                  <span class="badge badge-outline">Band ${classroom.level_band_min} - ${classroom.level_band_max}</span>
                  <span class="badge badge-green">${members.length} Students</span>
               </div>
            </div>
          </div>

          ${renderTabs()}

          <div id="tab-content" class="animate-fade-in">
            ${activeTab === 'students' ? renderStudentsTab(members) : ''}
            ${activeTab === 'assignments' ? renderAssignmentsTab(assignments, submissions) : ''}
            ${activeTab === 'materials' ? renderMaterialsTab() : ''}
            ${activeTab === 'announcements' ? renderAnnouncementsTab(announcements) : ''}
            ${activeTab === 'progress' ? renderProgressTab(assignments, submissions) : ''}
          </div>
        </div>
      `;

      setupEvents(container, classroom, members);
    } catch (err) {
      container.innerHTML = `<div class="card p-8 text-red-600">Error: ${err.message}</div>`;
    }
  };

  const renderStudentsTab = (members) => `
    <div class="card p-0 overflow-hidden">
      <div class="flex items-center justify-between p-6 border-b">
         <h2 class="font-bold">Class List</h2>
         ${isTeacher ? `<button class="btn btn-primary btn-sm" id="add-student-btn">+ Enroll Student</button>` : ''}
      </div>
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-50 text-xxs font-black text-muted uppercase tracking-wider">
          <tr>
            <th class="p-4">Name</th>
            <th class="p-4">Status</th>
            ${isTeacher ? `<th class="p-4">Action</th>` : ''}
          </tr>
        </thead>
        <tbody class="divide-y">
          ${members.map(m => `
            <tr>
              <td class="p-4">
                <div class="font-bold">${m.profile?.full_name || 'Student'}</div>
                <div class="text-xxs text-muted">${m.profile?.email || ''}</div>
              </td>
              <td class="p-4"><span class="badge ${m.status === 'active' ? 'badge-green' : 'badge-yellow'} text-xxs">${m.status}</span></td>
              ${isTeacher ? `
                <td class="p-4">
                  <div class="flex items-center gap-2 justify-end">
                    <button class="btn btn-secondary btn-xs warn-student-btn" data-student-id="${m.student_id}" data-name="${m.profile?.full_name || 'Student'}">Warn</button>
                    ${m.status === 'active'
                      ? `<button class="btn btn-ghost btn-xs text-red-500 deactivate-student-btn" data-membership-id="${m.id}" data-name="${m.profile?.full_name || 'Student'}">Deactivate</button>`
                      : `<button class="btn btn-ghost btn-xs text-green-600 reactivate-student-btn" data-membership-id="${m.id}" data-name="${m.profile?.full_name || 'Student'}">Re-activate</button>`
                    }
                  </div>
                </td>
              ` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  const renderAssignmentsTab = (assignments, submissions) => `
    <div class="flex justify-end gap-3 mb-6">
       ${isTeacher ? `
          <button class="btn btn-secondary btn-sm" id="add-exam-assignment-btn">Assign Custom Exam</button>
          <button class="btn btn-secondary btn-sm" id="add-cambridge-assignment-btn">Assign Cambridge Test</button>
          <button class="btn btn-primary btn-sm" id="add-assignment-btn">+ New Assignment</button>
       ` : ''}
    </div>
    <div class="grid grid-2 gap-4">
      ${assignments.length === 0 ? `
        <div class="card col-span-2 p-20 text-center text-muted italic">No assignments yet.</div>
      ` : assignments.map(a => {
        const sub = submissions.find(s => s.assignment_id === a.id);
        const isDone = sub?.status === 'submitted' || sub?.status === 'graded';
        return `
          <div class="card card-interactive assignment-item flex items-center justify-between p-4" data-id="${a.id}">
            <div>
              <div class="text-xxs font-black text-blue-500 uppercase tracking-widest mb-1">${a.module}</div>
              <h4 class="font-bold mb-1">${a.title}</h4>
              <div class="flex items-center gap-3 text-xxs text-muted">
                 <span>${a.task_type || 'General'}</span>
                 ${a.due_at ? `<span>📅 ${new Date(a.due_at).toLocaleDateString()}</span>` : ''}
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">
              <span class="badge ${sub?.status === 'graded' ? 'badge-green' : isDone ? 'badge-yellow' : sub ? 'badge-warn' : 'badge-outline'} text-xxs">
                ${sub?.status || 'Assigned'}
              </span>
              ${sub?.score_band_equivalent !== null && sub?.score_band_equivalent !== undefined ? `<span class="text-xxs font-bold text-blue-600">Band ${sub.score_band_equivalent}</span>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  const renderMaterialsTab = () => `
    <div class="card">
      <div class="flex items-center justify-between mb-4">
         <h3 class="font-bold">Shareable Materials</h3>
         ${isTeacher ? `<button class="btn btn-ghost btn-sm" id="dash-materials-manager-btn">Materials Manager →</button>` : ''}
      </div>
      <p class="text-sm text-muted mb-6">Course files and helpful resources shared with the class.</p>
      <div class="p-12 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
         <div class="text-2xl mb-4">📂</div>
         <p class="text-xs text-muted italic">No materials uploaded to this classroom yet.</p>
      </div>
    </div>
  `;

  const renderAnnouncementsTab = (announcements) => `
    <div class="space-y-6">
      ${isTeacher ? `
        <div class="card p-6 border-2 border-blue-50">
           <h3 class="font-bold mb-4">Post Announcement</h3>
           <textarea id="ann-content" class="input w-full p-4 h-24 mb-3" placeholder="Write a message to your students..."></textarea>
           <div class="flex justify-end">
              <button class="btn btn-primary btn-sm" id="post-ann-btn">Post to Class</button>
           </div>
        </div>
      ` : ''}
      
      ${announcements.length === 0 ? `
        <div class="p-20 text-center text-muted italic bg-gray-50 rounded-xl">
           No announcements yet.
        </div>
      ` : announcements.map(a => `
        <div class="card p-6">
           <div class="flex items-center justify-between mb-3 text-xxs">
              <span class="font-black text-blue-500 uppercase tracking-widest">Broadcast</span>
              <span class="text-muted">${new Date(a.created_at).toLocaleString()}</span>
           </div>
           <p class="text-sm leading-relaxed">${escapeHtml(a.content)}</p>
        </div>
      `).join('')}
    </div>
  `;

  const renderProgressTab = (assignments, submissions) => {
    const completed = assignments.filter(a => submissions.some(s => s.assignment_id === a.id && (s.status === 'submitted' || s.status === 'graded'))).length;
    const total = assignments.length || 1;
    const percent = Math.round((completed / total) * 100);

    return `
      <div class="grid grid-2-1 gap-6">
        <div class="card p-6">
           <h3 class="font-bold mb-4">Class Performance</h3>
           <div class="space-y-6">
              <div>
                 <div class="flex justify-between text-xs mb-2"><span>Completion Rate</span><b>${percent}%</b></div>
                 <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 transition-all duration-1000" style="width:${percent}%"></div>
                 </div>
              </div>
              <div class="grid grid-2 gap-4">
                 <div class="bg-gray-50 p-4 rounded-xl text-center">
                    <div class="text-2xl font-bold text-blue-600">${completed}</div>
                    <div class="text-xxs text-muted uppercase">Finished</div>
                 </div>
                 <div class="bg-gray-50 p-4 rounded-xl text-center">
                    <div class="text-2xl font-bold text-muted">${assignments.length - completed}</div>
                    <div class="text-xxs text-muted uppercase">To Do</div>
                 </div>
              </div>
           </div>
        </div>
        <div class="card p-6 bg-blue-600 text-white">
           <h3 class="font-bold mb-2">Current Goal</h3>
           <p class="text-xs text-blue-100 mb-6">Complete all assigned tasks to reach your target band.</p>
           <div class="text-4xl font-black mb-1">Band ${classroom.level_band_max}</div>
           <div class="text-xxs uppercase tracking-widest font-bold text-blue-200">Class Target</div>
        </div>
      </div>
    `;
  };

  const setupEvents = (container, classroom, members) => {
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.tab;
        render();
      });
    });

    document.getElementById('back-to-classes')?.addEventListener('click', () => navigateTo('/classes'));
    document.getElementById('dash-materials-manager-btn')?.addEventListener('click', () => navigateTo('/materials'));

    container.querySelectorAll('.assignment-item').forEach(item => {
      item.addEventListener('click', () => navigateTo(`/assignment/${item.dataset.id}`));
    });

    // Announcements
    document.getElementById('post-ann-btn')?.addEventListener('click', async () => {
       const content = document.getElementById('ann-content').value.trim();
       if (!content) return;

       try {
         await db.announcements.create({
            classroom_id: classroomId,
            teacher_id: user.id,
            content: content
         });

         // Notify all students
         const students = members.filter(m => m.status === 'active');
         await Promise.all(students.map(s => db.notifications.create({
            user_id: s.student_id,
            title: `New Announcement in ${classroom.title}`,
            body: content.length > 140 ? content.slice(0, 140) + '...' : content
         })));

         showToast('Announcement posted', 'success');
         render();
       } catch (err) {
         showToast(err.message, 'error');
       }
    });

    if (isTeacher) {
      setupTeacherEvents(container, classroom, members);
    }
  };

  const setupTeacherEvents = (container, classroom, members) => {
    // 1. Enroll Student
    document.getElementById('add-student-btn')?.addEventListener('click', () => {
      const modal = showModal('Enroll Student', `
        <div class="space-y-4">
          <div class="input-group">
            <label class="form-label">Search Student Name or Email</label>
            <input type="text" id="student-search-input" class="input" placeholder="Enter name or email..." autofocus>
          </div>
          <div class="flex items-center justify-between text-xxs text-muted">
            <span>Showing student accounts (role=student)</span>
            <button class="btn btn-ghost btn-xs" id="refresh-student-list-btn">Refresh</button>
          </div>
          <div id="student-search-results" class="space-y-2 mt-4 max-h-72 overflow-y-auto">
            <div class="flex justify-center p-4"><div class="spinner-sm"></div></div>
          </div>
        </div>
      `);

      const searchInput = document.getElementById('student-search-input');
      const resultsContainer = document.getElementById('student-search-results');
      const refreshBtn = document.getElementById('refresh-student-list-btn');

      const membershipByStudentId = new Map(members.map(m => [m.student_id, m]));

      const renderRows = (profiles) => {
        resultsContainer.innerHTML = profiles.map(p => {
          const membership = membershipByStudentId.get(p.id);
          const status = membership?.status || 'not_in_class';
          const badgeClass =
            status === 'active' ? 'badge-green' :
            status === 'inactive' ? 'badge-yellow' :
            'badge-outline';

          const actionHtml =
            status === 'active'
              ? `<button class="btn btn-ghost btn-xs" disabled>Active</button>`
              : status === 'inactive'
                ? `<button class="btn btn-primary btn-xs enroll-reactivate-btn" data-membership-id="${membership.id}" data-id="${p.id}" data-name="${escapeHtml(p.full_name || 'Student')}">Re-activate</button>`
                : `<button class="btn btn-primary btn-xs enroll-add-btn" data-id="${p.id}" data-name="${escapeHtml(p.full_name || 'Student')}">Add</button>`;

          return `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100">
              <div>
                <div class="flex items-center gap-2">
                  <div class="font-bold text-sm">${escapeHtml(p.full_name || 'Student')}</div>
                  <span class="badge ${badgeClass} text-xxs">${status}</span>
                </div>
                <div class="text-xs text-muted">${escapeHtml(p.email || '')}</div>
              </div>
              <div class="flex items-center gap-2">
                ${actionHtml}
              </div>
            </div>
          `;
        }).join('');

        resultsContainer.querySelectorAll('.enroll-add-btn').forEach(el => {
          el.addEventListener('click', async () => {
            const studentId = el.dataset.id;
            const studentName = el.dataset.name;
            try {
              await db.classroomMembers.addStudent({
                classroom_id: classroom.id,
                student_id: studentId
              });
              showToast(`Added ${studentName} to class`, 'success');
              modal.close();
              render();
            } catch (err) {
              showToast(err.message || 'Failed to add student', 'error');
            }
          });
        });

        resultsContainer.querySelectorAll('.enroll-reactivate-btn').forEach(el => {
          el.addEventListener('click', async () => {
            const membershipId = el.dataset.membershipId;
            const studentName = el.dataset.name;
            try {
              await db.classroomMembers.updateStatus(membershipId, 'active');
              showToast(`Re-activated ${studentName}`, 'success');
              modal.close();
              render();
            } catch (err) {
              showToast(err.message || 'Failed to re-activate student', 'error');
            }
          });
        });
      };

      const loadAllStudents = async () => {
        resultsContainer.innerHTML = '<div class="flex justify-center p-4"><div class="spinner-sm"></div></div>';
        try {
          const profiles = await db.profiles.listStudents({ limit: 100 });
          if (!profiles || profiles.length === 0) {
            resultsContainer.innerHTML = '<p class="text-center text-muted py-4">No student accounts found.</p>';
            return;
          }
          renderRows(profiles);
        } catch (err) {
          resultsContainer.innerHTML = `<p class="text-center text-red-500 py-4">${escapeHtml(err.message)}</p>`;
        }
      };

      const handleSearch = debounce(async (query) => {
        if (query.length < 2) return loadAllStudents();

        resultsContainer.innerHTML = '<div class="flex justify-center p-4"><div class="spinner-sm"></div></div>';

        try {
          const profiles = await db.profiles.search(query);
          if (profiles.length === 0) {
            resultsContainer.innerHTML = '<p class="text-center text-muted py-4">No students found.</p>';
            return;
          }
          renderRows(profiles);
        } catch (err) {
          resultsContainer.innerHTML = `<p class="text-center text-red-500 py-4">${escapeHtml(err.message)}</p>`;
        }
      }, 300);

      searchInput.addEventListener('input', (e) => handleSearch(e.target.value));
      refreshBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        loadAllStudents();
      });
      loadAllStudents();
    });

    // 2. New Assignment
    document.getElementById('add-assignment-btn')?.addEventListener('click', () => {
      const modal = showModal('Create New Assignment', `
        <form id="create-assignment-form" class="space-y-4">
          <div class="input-group">
            <label class="form-label">Title *</label>
            <input type="text" id="as-title" class="input" placeholder="e.g. Unit 1 Homework" required autofocus>
          </div>
          <div class="grid grid-2 gap-4">
            <div class="input-group">
              <label class="form-label">Module *</label>
              <select id="as-module" class="input" required>
                <option value="reading">Reading</option>
                <option value="listening">Listening</option>
                <option value="writing">Writing</option>
                <option value="speaking">Speaking</option>
              </select>
            </div>
          </div>
          <div class="input-group">
            <label class="form-label">Due Date</label>
            <input type="date" id="as-due" class="input">
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button type="button" class="btn btn-ghost" id="as-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="as-submit">Create Assignment</button>
          </div>
        </form>
      `);

      document.getElementById('as-cancel').addEventListener('click', () => modal.close());
      document.getElementById('create-assignment-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
          classroom_id: classroom.id,
          teacher_id: classroom.teacher_id,
          title: document.getElementById('as-title').value,
          module: document.getElementById('as-module').value,
          status: 'published',
          due_at: document.getElementById('as-due').value ? new Date(document.getElementById('as-due').value).toISOString() : null
        };
        try {
          await db.assignments.create(data);
          showToast('Assignment created', 'success');
          modal.close();
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // 3. Cambridge assignment
    document.getElementById('add-cambridge-assignment-btn')?.addEventListener('click', () => {
      openCambridgePicker(container, async (selected) => {
        try {
          const rows = await db.assignments.create({
            classroom_id: classroom.id,
            teacher_id: classroom.teacher_id,
            title: selected.title || 'Cambridge Practice',
            module: 'reading',
            task_type: 'cambridge_reading',
            source_type: 'cambridge_library',
            source_ref_id: selected.id,
            status: 'published'
          });
          const assignment = rows[0];
          if (members.length > 0 && assignment?.id) {
            const targets = members.map(m => ({
              assignment_id: assignment.id,
              classroom_id: classroom.id,
              student_id: m.student_id,
              required: true
            }));
            await db.assignmentTargets.createMany(targets);
          }
          showToast('Cambridge test assigned', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
    
    // 3.5 Assign Custom Exam
    document.getElementById('add-exam-assignment-btn')?.addEventListener('click', async () => {
      const modal = showModal('Select Exam to Assign', `
        <div class="space-y-4">
          <div id="exam-select-list" class="max-h-72 overflow-y-auto space-y-2">
            <div class="flex justify-center p-4"><div class="spinner-sm"></div></div>
          </div>
        </div>
      `);

      try {
        const exams = await exerciseService.listExams({ teacher_id: `eq.${user.id}` });
        const list = document.getElementById('exam-select-list');
        if (!exams || exams.length === 0) {
          list.innerHTML = `<p class="text-center text-muted py-4">No published exams found. Create one in the Exam Library first.</p>`;
          return;
        }

        list.innerHTML = exams.map(e => `
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer select-exam-row" data-id="${e.id}" data-title="${escapeHtml(e.title)}" data-module="${e.module}">
            <div>
              <div class="font-bold text-sm">${escapeHtml(e.title)}</div>
              <div class="text-xxs text-muted uppercase font-black">${e.module}</div>
            </div>
            <button class="btn btn-primary btn-xs">Select</button>
          </div>
        `).join('');

        list.querySelectorAll('.select-exam-row').forEach(row => {
          row.addEventListener('click', async () => {
            const examId = row.dataset.id;
            const title = row.dataset.title;
            const module = row.dataset.module;
            modal.close();

            try {
              const rows = await db.assignments.create({
                classroom_id: classroom.id,
                teacher_id: classroom.teacher_id,
                title: `[Exam] ${title}`,
                module: module,
                task_type: 'custom_exam',
                source_type: 'exam',
                source_ref_id: examId,
                status: 'published'
              });
              
              const assignment = rows[0];
              if (members.length > 0 && assignment?.id) {
                const targets = members.map(m => ({
                  assignment_id: assignment.id,
                  classroom_id: classroom.id,
                  student_id: m.student_id,
                  required: true
                }));
                await db.assignmentTargets.createMany(targets);
              }
              showToast('Exam assigned successfully', 'success');
              render();
            } catch (err) {
              showToast(err.message, 'error');
            }
          });
        });
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // 4. Member status actions (soft, RLS-friendly)
    container.querySelectorAll('.deactivate-student-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Deactivate ${btn.dataset.name}?`)) return;
        try {
          await db.classroomMembers.updateStatus(btn.dataset.membershipId, 'inactive');
          showToast('Student deactivated', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('.reactivate-student-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await db.classroomMembers.updateStatus(btn.dataset.membershipId, 'active');
          showToast('Student re-activated', 'success');
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    // 5. Warn student (notification)
    container.querySelectorAll('.warn-student-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const studentId = btn.dataset.studentId;
        const name = btn.dataset.name;
        const warnModal = showModal(`Warn ${escapeHtml(name)}`, `
          <div class="space-y-4">
            <div class="input-group">
              <label class="form-label">Message</label>
              <textarea id="warn-msg" class="input w-full p-4 h-28" placeholder="Write a warning or reminder..."></textarea>
            </div>
            <div class="flex justify-end gap-2">
              <button class="btn btn-ghost" id="warn-cancel">Cancel</button>
              <button class="btn btn-primary" id="warn-send">Send Warning</button>
            </div>
          </div>
        `);

        document.getElementById('warn-cancel')?.addEventListener('click', () => warnModal.close());
        document.getElementById('warn-send')?.addEventListener('click', async () => {
          const msg = document.getElementById('warn-msg')?.value?.trim();
          if (!msg) return;
          try {
            await db.notifications.create({
              user_id: studentId,
              title: `⚠️ Warning from ${classroom.title}`,
              body: msg
            });
            showToast('Warning sent', 'success');
            warnModal.close();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    });
  };

  render();
}

