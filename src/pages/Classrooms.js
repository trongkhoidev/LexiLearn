import { db, getCurrentUser } from '../utils/supabase.js';
import { showToast } from '../components/Toast.js';
import { showModal } from '../components/Modal.js';
import { navigateTo } from '../router.js';
import { renderSkeleton, renderEmptyState, escapeHtml } from '../utils/helpers.js';

export async function renderClassrooms(container) {
  const user = getCurrentUser();
  const isTeacher = user?.role === 'teacher';

  // Initial skeleton state
  container.innerHTML = `
    <div class="animate-fade-in" style="max-width:960px;margin:0 auto;">
      <div class="page-header mb-8">
        <div class="skeleton skeleton-title" style="width: 200px;"></div>
        <div class="skeleton skeleton-text" style="width: 350px;"></div>
      </div>
      <div class="grid grid-2 gap-6">
        ${renderSkeleton('card', 4)}
      </div>
    </div>
  `;

  if (!user || !isTeacher) {
    container.innerHTML = renderEmptyState({
      icon: '🔒',
      title: 'Teacher Access Only',
      message: 'Please log in as a teacher to manage classrooms and students.',
      actionHtml: `<button class="btn btn-primary" onclick="navigateTo('/dashboard')">Go to Dashboard</button>`
    });
    return;
  }

  try {
    const classrooms = await db.classrooms.listByTeacher(user.id);

    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1040px;margin:0 auto; padding-bottom: 4rem;">
        <div class="page-header flex-between flex-wrap gap-6 mb-12">
          <div>
            <h1 class="text-3xl font-extra-bold mb-2">🏫 Your Classrooms</h1>
            <p class="text-muted text-md">Manage your IELTS academic tracks, monitor student progress, and assign tasks.</p>
          </div>
          <button class="btn btn-primary shadow-glow hover-lift px-8 py-4 text-base font-bold" id="create-class-btn" style="border-radius: var(--border-radius-lg);">
            <span class="mr-2">+</span> Create New Class
          </button>
        </div>

        ${classrooms.length === 0 ? renderEmptyState({
          icon: '🏫',
          title: 'Ready to build your first class?',
          message: 'Create a structured learning environment to start adding students and monitoring their IELTS performance.',
          actionHtml: `<button class="btn btn-primary px-10 py-4 shadow-lg font-bold" id="empty-create-btn">Get Started Now</button>`
        }) : `
          <div class="grid grid-2 gap-8">
            ${classrooms.map(cls => {
              const bandProgress = ((cls.level_band_max - 4) / 5) * 100; // Assuming 9.0 is max
              return `
              <div class="card card-interactive p-0 overflow-hidden flex flex-col border-none shadow-sm hover:shadow-xl transition-all duration-300" 
                   data-id="${cls.id}" 
                   style="border-radius: var(--border-radius-xl); background: var(--color-bg-card);">
                
                <div class="p-8 pb-4 relative overflow-hidden" style="background: var(--gradient-card);">
                  <div class="flex-between relative z-10 mb-6">
                    <span class="badge ${cls.is_active ? 'badge-green' : 'badge-outline'} px-3 py-1 text-[10px] font-black uppercase tracking-widest" style="border-radius: var(--border-radius-sm);">
                      ${cls.is_active ? 'Active' : 'Archived'}
                    </span>
                    <div class="w-10 h-10 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm flex-center text-xl">🎓</div>
                  </div>
                  
                  <h3 class="text-xl font-extra-bold mb-2 tracking-tight">${escapeHtml(cls.title)}</h3>
                  <p class="text-xs text-muted font-medium line-clamp-2 leading-relaxed h-8 mb-4">${escapeHtml(cls.description || 'Elevating student outcomes through structured IELTS preparation.')}</p>
                </div>

                <div class="px-8 pb-8 flex-1 flex flex-col justify-between">
                  <div>
                    <div class="flex-between mb-3 text-xxs font-black uppercase tracking-widest text-muted">
                      <span>IELTS Target Range</span>
                      <span class="text-blue-600">Band ${cls.level_band_min || '5.0'} — ${cls.level_band_max || '7.5'}</span>
                    </div>
                    <div class="w-full h-2 bg-gray-100 rounded-full mb-8 overflow-hidden">
                      <div class="h-full bg-blue-500 transition-all duration-1000" style="width: ${bandProgress}%"></div>
                    </div>
                    
                    <div class="grid grid-2 gap-4">
                      <div class="p-4 bg-gray-50 rounded-2xl flex items-center gap-3">
                        <span class="text-lg">👥</span>
                        <div>
                          <div class="text-sm font-black">${cls.student_count || 0}</div>
                          <div class="text-[9px] text-muted font-bold uppercase tracking-wider">Students</div>
                        </div>
                      </div>
                      <div class="p-4 bg-gray-50 rounded-2xl flex items-center gap-3">
                        <span class="text-lg">📅</span>
                        <div>
                          <div class="text-[11px] font-black">${new Date(cls.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                          <div class="text-[9px] text-muted font-bold uppercase tracking-wider">Created</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div class="mt-8 pt-6 border-t border-gray-100 flex-between">
                    <span class="text-xxs font-bold text-muted">ID: ${cls.id.slice(0, 8)}</span>
                    <button class="btn btn-ghost btn-sm text-blue-600 font-black px-0 hover:bg-transparent">
                      Enter Classroom <span class="ml-1">→</span>
                    </button>
                  </div>
                </div>
              </div>
            `}).join('')}
          </div>
        `}
      </div>
    `;

    const handleCreate = () => {
      const content = `
        <form id="create-class-form" class="space-y-4">
          <div class="input-group">
            <label>Classroom Name</label>
            <input type="text" name="title" class="input" placeholder="e.g. IELTS Intense 6.5+" required>
          </div>
          <div class="input-group">
            <label>Description</label>
            <textarea name="description" class="textarea" placeholder="Describe the goal or schedule..."></textarea>
          </div>
          <div class="grid grid-2 gap-4">
             <div class="input-group">
                <label>Min Band</label>
                <input type="number" step="0.5" name="min_band" class="input" value="5.0" required>
             </div>
             <div class="input-group">
                <label>Max Band</label>
                <input type="number" step="0.5" name="max_band" class="input" value="7.5" required>
             </div>
          </div>
          <div class="mt-6 flex justify-end gap-3">
             <button type="button" class="btn btn-ghost modal-close-btn" id="cancel-create">Cancel</button>
             <button type="submit" class="btn btn-primary px-8">Create Classroom</button>
          </div>
        </form>
      `;

      const modal = showModal('Create Classroom', content, { width: 450 });
      
      const form = modal.element.querySelector('#create-class-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner-xs"></div> Creating...';

        try {
          await db.classrooms.create({
            teacher_id: user.id,
            title: data.get('title'),
            description: data.get('description'),
            level_band_min: parseFloat(data.get('min_band')),
            level_band_max: parseFloat(data.get('max_band')),
            is_active: true
          });
          showToast('Classroom created successfully!', 'success');
          modal.close();
          renderClassrooms(container);
        } catch (err) {
          showToast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Create Classroom';
        }
      });

      modal.element.querySelector('#cancel-create').addEventListener('click', () => modal.close());
    };

    container.querySelector('#create-class-btn')?.addEventListener('click', handleCreate);
    container.querySelector('#empty-create-btn')?.addEventListener('click', handleCreate);

    container.querySelectorAll('.card-interactive').forEach(card => {
      card.addEventListener('click', () => navigateTo(`/class/${card.dataset.id}`));
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-red-500 card m-8 text-center shadow-lg">
      <h2 class="font-bold mb-2">Error loading classrooms</h2>
      <p class="text-sm opacity-70">${err.message}</p>
    </div>`;
  }
}


