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
      <div class="hero-card shadow-xl text-white mb-12" style="background: var(--gradient-primary); border: none;">
        <div class="flex justify-between items-start gap-8 flex-wrap">
          <div class="flex-1">
            <span class="text-xxs font-black uppercase tracking-widest text-blue-100 mb-3 block">Educator Dashboard</span>
            <h1 class="text-4xl font-extrabold text-white mb-3">Welcome, ${user.full_name}</h1>
            <p class="text-blue-100 text-lg leading-relaxed max-w-2xl">Monitor class performance, manage materials, and grade submissions from your central hub.</p>
          </div>
          <div class="flex gap-3 flex-shrink-0">
             <button class="btn bg-white text-blue-600 hover:bg-blue-50 font-bold shadow-lg" id="dash-new-class-btn">+ Create Class</button>
             <button class="btn btn-ghost text-white hover:bg-white/10 font-semibold" id="dash-logout-btn">Sign Out</button>
          </div>
        </div>
      </div>

      <!-- Quick Insights Bar -->
      <div class="grid grid-cols-4 gap-6 mb-12">
        <div class="card p-6 border-l-4 border-blue-500 hover-lift">
          <div class="text-xxs font-bold text-muted uppercase tracking-wider mb-3">Active Classrooms</div>
          <div class="text-4xl font-extrabold text-blue-600 mb-2">${classes.length}</div>
          <div class="text-xs text-muted font-medium">Teaching across ${classes.length} levels</div>
        </div>
        <div class="card p-6 border-l-4 border-green-500 hover-lift">
          <div class="text-xxs font-bold text-muted uppercase tracking-wider mb-3">Total Students</div>
          <div class="text-4xl font-extrabold text-green-600 mb-2">${totalStudents || 0}</div>
          <div class="text-xs text-muted font-medium">Enrolled learners</div>
        </div>
        <div class="card p-6 border-l-4 border-yellow-500 hover-lift">
          <div class="text-xxs font-bold text-muted uppercase tracking-wider mb-3">Open Assignments</div>
          <div class="text-4xl font-extrabold text-yellow-600 mb-2">${assignments.length}</div>
          <div class="text-xs text-muted font-medium">Awaiting completion</div>
        </div>
        <div class="card p-6 border-l-4 border-pink-500 hover-lift">
          <div class="text-xxs font-bold text-muted uppercase tracking-wider mb-3">Gemini Status</div>
          <div class="text-2xl font-extrabold text-pink-600 mb-2">Active</div>
          <div class="text-xs text-muted font-medium">AI Grading online</div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-8 mb-12">
        <div class="card shadow-md">
           <div class="flex items-center justify-between mb-8">
              <h3 class="text-lg font-bold text-gray-900">Recent Classrooms</h3>
              <button class="btn btn-ghost btn-xs text-blue-600 font-semibold" id="dash-view-classes-btn">View All →</button>
           </div>
           ${classes.length === 0 ? renderEmptyState({ icon: renderIcon('classrooms', 24), title: 'No Classes', message: 'Create your first classroom to start assigning work.' }) : `
             <div class="space-y-3">
                ${classes.slice(0, 3).map(c => `
                  <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer class-item border border-gray-100 hover:border-blue-200" data-id="${c.id}">
                     <div class="flex items-center gap-4 flex-1">
                        <div class="w-10 h-10 rounded-lg bg-blue-100 flex-center text-blue-600 shadow-sm flex-shrink-0" style="color: var(--color-blue); display: flex; align-items: center; justify-content: center;">${renderIcon('classrooms', 16)}</div>
                        <div class="flex-1 min-w-0">
                           <div class="font-bold text-sm text-gray-900">${escapeHtml(c.title)}</div>
                           <div class="text-xs text-muted font-semibold uppercase tracking-widest mt-1">Target: Band ${c.level_band_min} - ${c.level_band_max}</div>
                        </div>
                     </div>
                     <span class="badge badge-outline text-xs font-semibold whitespace-nowrap ml-2">${c.student_count || 0} Students</span>
                  </div>
                `).join('')}
             </div>
           `}
        </div>

        <div class="card shadow-md">
           <h3 class="text-lg font-bold text-gray-900 mb-8">Educator Toolbox</h3>
           <div class="grid grid-cols-2 gap-4">
              <button class="flex flex-col items-center justify-center p-6 bg-blue-50 hover:bg-blue-100 rounded-xl border-2 border-blue-200 transition-all hover-lift shadow-sm" onclick="navigateTo('/materials')">
                 <div style="color: var(--color-blue); margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">${renderIcon('materials', 32)}</div>
                 <div class="text-xs font-black uppercase tracking-widest text-blue-700">Materials</div>
                 <div class="text-[11px] text-blue-500 mt-1 text-center">Resources & Files</div>
              </button>
              <button class="flex flex-col items-center justify-center p-6 bg-pink-50 hover:bg-pink-100 rounded-xl border-2 border-pink-200 transition-all hover-lift shadow-sm" onclick="navigateTo('/grading-hub')">
                 <div style="color: #ec4899; margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">${renderIcon('grading', 32)}</div>
                 <div class="text-xs font-black uppercase tracking-widest text-pink-700">Grading</div>
                 <div class="text-[11px] text-pink-500 mt-1 text-center">Pending Reviews</div>
              </button>
              <button class="flex flex-col items-center justify-center p-6 bg-green-50 hover:bg-green-100 rounded-xl border-2 border-green-200 transition-all hover-lift shadow-sm" onclick="navigateTo('/decks')">
                 <div style="color: #16a34a; margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">${renderIcon('decks', 32)}</div>
                 <div class="text-xs font-black uppercase tracking-widest text-green-700">Vocabulary</div>
                 <div class="text-[11px] text-green-500 mt-1 text-center">Deck Builder</div>
              </button>
              <button class="flex flex-col items-center justify-center p-6 bg-gray-50 hover:bg-gray-100 rounded-xl border-2 border-gray-200 transition-all hover-lift shadow-sm" onclick="navigateTo('/settings')">
                 <div style="color: #666; margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">${renderIcon('settings', 32)}</div>
                 <div class="text-xs font-black uppercase tracking-widest text-gray-700">API Config</div>
                 <div class="text-[11px] text-gray-500 mt-1 text-center">AI Settings</div>
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
