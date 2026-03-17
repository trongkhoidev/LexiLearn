/* ============================================
   LexiLearn — Teacher Dashboard Component
   ============================================
*/

import { escapeHtml, renderEmptyState } from '../../utils/helpers.js';
import { navigateTo } from '../../router.js';
import { signOut } from '../../utils/supabase.js';
import { renderIcon } from '../../utils/icons.js';

export function renderTeacherDashboard(container, user, data) {
  const { classes, assignments } = data;
  const totalStudents = classes.reduce((acc, c) => acc + (c.student_count || 0), 0);
  
  container.innerHTML = `
    <div class="dashboard-container animate-fade-in-up">
      <!-- Hero -->
      <div class="hero-card shadow-xl p-10 mb-10 text-white" style="background: var(--gradient-primary); border: none;">
        <div class="flex-between flex-wrap gap-8">
          <div class="flex-1">
            <span class="text-xxs font-black uppercase tracking-widest text-blue-100 mb-2 block">Educator Dashboard</span>
            <h1 class="text-3xl font-extra-bold text-white mb-2">Welcome, ${user.full_name}</h1>
            <p class="text-blue-50 leading-relaxed max-w-lg">Monitor class performance, manage materials, and grade submissions from your central hub.</p>
          </div>
          <div class="flex gap-3">
             <button class="btn bg-white text-blue-600 hover:bg-blue-50 font-bold" id="dash-new-class-btn">+ Create Class</button>
             <button class="btn btn-ghost text-white hover:bg-white/10" id="dash-logout-btn">Sign Out</button>
          </div>
        </div>
      </div>

      <!-- Quick Insights Bar -->
      <div class="grid grid-4 gap-6 mb-10">
        <div class="card p-6 border-l-4 border-blue-500 hover-lift">
          <div class="text-xxs font-bold text-muted uppercase tracking-wider mb-2">Active Classrooms</div>
          <div class="text-3xl font-bold text-blue-600">${classes.length}</div>
          <div class="text-xxs text-muted mt-1">Teaching across ${classes.length} levels</div>
        </div>
        <div class="card p-6 border-l-4 border-green-500 hover-lift">
          <div class="text-xxs font-bold text-muted uppercase tracking-wider mb-2">Total Students</div>
          <div class="text-3xl font-bold text-green-600">${totalStudents || 0}</div>
          <div class="text-xxs text-muted mt-1">Enrolled learners</div>
        </div>
        <div class="card p-6 border-l-4 border-yellow-500 hover-lift">
          <div class="text-xxs font-bold text-muted uppercase tracking-wider mb-2">Open Assignments</div>
          <div class="text-3xl font-bold text-yellow-600">${assignments.length}</div>
          <div class="text-xxs text-muted mt-1">Awaiting completion</div>
        </div>
        <div class="card p-6 border-l-4 border-pink-500 hover-lift">
          <div class="text-xxs font-bold text-muted uppercase tracking-wider mb-2">Gemini Status</div>
          <div class="text-3xl font-bold text-pink-600">Active</div>
          <div class="text-xxs text-muted mt-1">AI Grading online</div>
        </div>
      </div>

      <div class="grid grid-2 gap-8 mb-10">
        <div class="card shadow-sm">
           <div class="flex-between mb-6">
              <h3 class="font-bold">Recent Classrooms</h3>
              <button class="btn btn-ghost btn-xs text-blue-600" id="dash-view-classes-btn">View All →</button>
           </div>
           ${classes.length === 0 ? renderEmptyState({ icon: renderIcon('classrooms', 24), title: 'No Classes', message: 'Create your first classroom to start assigning work.' }) : `
             <div class="space-y-4">
                ${classes.slice(0, 3).map(c => `
                  <div class="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer class-item" data-id="${c.id}">
                     <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-lg bg-blue-100 flex-center text-blue-600 shadow-sm" style="color: var(--color-blue); display: flex; align-items: center; justify-content: center;">${renderIcon('classrooms', 16)}</div>
                        <div>
                           <div class="font-bold text-sm">${escapeHtml(c.title)}</div>
                           <div class="text-xxs text-muted font-bold uppercase tracking-widest mt-1">Target: Band ${c.level_band_min} - ${c.level_band_max}</div>
                        </div>
                     </div>
                     <span class="badge badge-outline text-xxs">${c.student_count || 0} Students</span>
                  </div>
                `).join('')}
             </div>
           `}
        </div>

        <div class="card shadow-sm">
           <h3 class="font-bold mb-6">Educator Toolbox</h3>
           <div class="grid grid-2 gap-4">
              <button class="flex flex-col items-center justify-center p-6 bg-blue-50 hover:bg-blue-100 rounded-2xl border border-blue-100 transition-all hover-lift" onclick="navigateTo('/materials')">
                 <div style="color: var(--color-blue); margin-bottom: 12px;">${renderIcon('materials', 28)}</div>
                 <div class="text-xs font-black uppercase tracking-widest text-blue-600">Materials</div>
                 <div class="text-[10px] text-blue-400 mt-1">Resources & Files</div>
              </button>
              <button class="flex flex-col items-center justify-center p-6 bg-pink-50 hover:bg-pink-100 rounded-2xl border border-pink-100 transition-all hover-lift" onclick="navigateTo('/grading-hub')">
                 <div style="color: #ec4899; margin-bottom: 12px;">${renderIcon('grading', 28)}</div>
                 <div class="text-xs font-black uppercase tracking-widest text-pink-600">Grading</div>
                 <div class="text-[10px] text-pink-400 mt-1">Pending Reviews</div>
              </button>
              <button class="flex flex-col items-center justify-center p-6 bg-green-50 hover:bg-green-100 rounded-2xl border border-green-100 transition-all hover-lift" onclick="navigateTo('/decks')">
                 <div style="color: #16a34a; margin-bottom: 12px;">${renderIcon('decks', 28)}</div>
                 <div class="text-xs font-black uppercase tracking-widest text-green-600">Vocabulary</div>
                 <div class="text-[10px] text-green-400 mt-1">Deck Builder</div>
              </button>
              <button class="flex flex-col items-center justify-center p-6 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-100 transition-all hover-lift" onclick="navigateTo('/settings')">
                 <div style="color: #666; margin-bottom: 12px;">${renderIcon('settings', 28)}</div>
                 <div class="text-xs font-black uppercase tracking-widest text-gray-600">API Config</div>
                 <div class="text-[10px] text-gray-400 mt-1">AI Settings</div>
              </button>
           </div>
        </div>
      </div>
    </div>
  `;

  // Attach event listeners
  container.querySelector('#dash-logout-btn')?.addEventListener('click', async () => {
    await signOut();
    window.location.reload();
  });

  container.querySelector('#dash-new-class-btn')?.addEventListener('click', () => navigateTo('/classes/new'));
  container.querySelector('#dash-view-classes-btn')?.addEventListener('click', () => navigateTo('/classes'));
  
  container.querySelectorAll('.class-item').forEach(item => {
    item.addEventListener('click', () => navigateTo(`/class/${item.dataset.id}`));
  });

  // Global exposure for specific button clicks (internal navigation)
  window.navigateTo = navigateTo;
}
