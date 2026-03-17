import { db, getCurrentUser } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/Toast.js';

export async function renderNewClassroom(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'teacher') {
    container.innerHTML = `<div class="card p-12 text-center text-muted">Teacher access only.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="animate-fade-in-up" style="max-width:760px;margin:0 auto;">
      <button class="btn btn-ghost btn-sm" id="back-btn">← Back</button>

      <div class="page-header" style="margin-top:var(--space-6);">
        <h1>+ Create Classroom</h1>
        <p>Set target band range, then enroll students and assign tests.</p>
      </div>

      <div class="card p-8">
        <form id="new-class-form" class="space-y-4">
          <div class="input-group">
            <label>Classroom Name *</label>
            <input class="input" name="title" placeholder="e.g. IELTS 6.0–6.5 Evening" required autofocus />
          </div>
          <div class="input-group">
            <label>Description</label>
            <textarea class="textarea" name="description" placeholder="Schedule, goals, notes..." rows="3"></textarea>
          </div>
          <div class="grid grid-2 gap-4">
            <div class="input-group">
              <label>Min Band</label>
              <input class="input" name="min" type="number" step="0.5" value="5.0" />
            </div>
            <div class="input-group">
              <label>Max Band</label>
              <input class="input" name="max" type="number" step="0.5" value="7.0" />
            </div>
          </div>

          <div class="flex justify-end gap-3" style="margin-top:var(--space-6);">
            <button type="button" class="btn btn-ghost" id="cancel-btn">Cancel</button>
            <button type="submit" class="btn btn-primary" id="create-btn">Create</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const goBack = () => navigateTo('/classes');
  document.getElementById('back-btn')?.addEventListener('click', goBack);
  document.getElementById('cancel-btn')?.addEventListener('click', goBack);

  document.getElementById('new-class-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const btn = document.getElementById('create-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner-sm"></div>';

    const fd = new FormData(form);
    try {
      const rows = await db.classrooms.create({
        teacher_id: user.id,
        title: fd.get('title'),
        description: fd.get('description'),
        level_band_min: parseFloat(fd.get('min') || '0') || null,
        level_band_max: parseFloat(fd.get('max') || '0') || null,
        is_active: true
      });

      const cls = rows?.[0];
      showToast('Classroom created', 'success');
      navigateTo(cls?.id ? `/class/${cls.id}` : '/classes');
    } catch (err) {
      showToast(err.message || 'Failed to create classroom', 'error');
      btn.disabled = false;
      btn.textContent = 'Create';
    }
  });
}

