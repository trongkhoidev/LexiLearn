import { exerciseService } from '../services/exercise.service.js';
import { getCurrentUser } from '../utils/supabase.js';
import { navigateTo } from '../router.js';
import { showToast } from '../components/Toast.js';

export async function renderExamList(container) {
  const user = getCurrentUser();

  const render = async () => {
    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1100px;margin:0 auto;">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold">Exam Library</h1>
            <p class="text-muted">Manage your custom IELTS exams and practice materials.</p>
          </div>
          <button class="btn btn-primary" id="create-exam-btn">+ Create New Exam</button>
        </div>

        <div id="exams-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div class="col-span-full flex justify-center p-20"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    try {
      const exams = await exerciseService.listExams({ teacher_id: `eq.${user.id}` });
      const grid = document.getElementById('exams-grid');

      if (!exams || exams.length === 0) {
        grid.innerHTML = `
          <div class="col-span-full card p-20 text-center text-muted italic bg-gray-50 border-2 border-dashed">
            <div class="text-4xl mb-4">📝</div>
            <p>You haven't created any exams yet.</p>
            <button class="btn btn-secondary btn-sm mt-4" onclick="document.getElementById('create-exam-btn').click()">Get Started</button>
          </div>
        `;
      } else {
        grid.innerHTML = exams.map(exam => `
          <div class="card card-interactive exam-card animate-fade-in" data-id="${exam.id}">
            <div class="flex justify-between items-start mb-4">
               <span class="badge ${getModuleBadgeClass(exam.module)} uppercase text-xxs font-black tracking-widest">${exam.module}</span>
               <span class="badge ${exam.status === 'published' ? 'badge-green' : 'badge-outline'} text-xxs">${exam.status}</span>
            </div>
            <h3 class="font-bold text-lg mb-2">${exam.title}</h3>
            <div class="flex items-center gap-4 text-xxs text-muted mb-6">
               <span>🕒 ${exam.time_limit_minutes} Mins</span>
               <span>❓ ${exam.total_questions || 0} Questions</span>
            </div>
            <div class="flex gap-2 border-t pt-4">
               <button class="btn btn-ghost btn-xs text-blue-600 edit-exam-btn" data-id="${exam.id}">Edit</button>
               <button class="btn btn-ghost btn-xs text-red-500 delete-exam-btn" data-id="${exam.id}">Delete</button>
            </div>
          </div>
        `).join('');
      }

      setupEvents();
    } catch (err) {
      document.getElementById('exams-grid').innerHTML = `<div class="card p-8 text-red-600">Error: ${err.message}</div>`;
    }
  };

  const getModuleBadgeClass = (module) => {
    if (module === 'reading') return 'badge-primary';
    if (module === 'listening') return 'badge-green';
    if (module === 'writing') return 'badge-yellow';
    return 'badge-outline';
  };

  const setupEvents = () => {
    document.getElementById('create-exam-btn')?.addEventListener('click', () => navigateTo('/exam/new'));
    
    container.querySelectorAll('.exam-card').forEach(card => {
       card.addEventListener('click', (e) => {
         if (e.target.closest('button')) return;
         navigateTo(`/exam/builder/${card.dataset.id}`);
       });
    });

    container.querySelectorAll('.edit-exam-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigateTo(`/exam/builder/${btn.dataset.id}`);
      });
    });

    container.querySelectorAll('.delete-exam-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this exam? All student submissions will also be deleted.')) {
           try {
             await exerciseService.deleteExam(btn.dataset.id);
             showToast('Exam deleted', 'success');
             render();
           } catch (err) {
             showToast(err.message, 'error');
           }
        }
      });
    });
  };

  render();
}
