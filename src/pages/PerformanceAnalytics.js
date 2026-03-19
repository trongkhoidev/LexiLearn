import { exerciseService } from '../services/exercise.service.js';
import { getCurrentUser } from '../utils/supabase.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';

/**
 * PerformanceAnalytics Page
 * Visualizes student performance over time and identifies strengths/weaknesses.
 */
export async function renderPerformanceAnalytics(container) {
  const user = getCurrentUser();
  container.innerHTML = `<div class="p-20 text-center"><div class="spinner"></div></div>`;

  try {
    const submissions = await exerciseService.getUserSubmissions(user.id);
    const sortedSubmissions = submissions.filter(s => s.status === 'submitted').sort((a,b) => new Date(a.submitted_at) - new Date(b.submitted_at));

    if (sortedSubmissions.length === 0) {
      container.innerHTML = `
        <div class="h-screen flex flex-col items-center justify-center p-12 text-center">
          <div class="text-6xl mb-6">📊</div>
          <h1 class="text-3xl font-bold mb-4">No Analytics Yet</h1>
          <p class="text-muted max-w-md mb-8">Take a few IELTS exams to see your progress and performance breakdown here.</p>
          <button class="btn btn-primary" onclick="navigateTo('/exams')">Browse Exams</button>
        </div>
      `;
      return;
    }

    const latest = sortedSubmissions[sortedSubmissions.length - 1];
    const avgBand = (sortedSubmissions.reduce((sum, s) => sum + (parseFloat(s.score_band) || 0), 0) / sortedSubmissions.length).toFixed(1);

    container.innerHTML = `
      <div class="p-10 max-w-6xl mx-auto animate-fade-in">
        <header class="mb-12 flex items-center justify-between">
          <div>
            <h1 class="text-4xl font-bold mb-2">My Performance</h1>
            <p class="text-muted font-medium">Tracking your IELTS journey at LexiLearn</p>
          </div>
          <button class="btn btn-ghost" onclick="navigateTo('/dashboard')">← Dashboard</button>
        </header>

        <!-- Stats Overview -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div class="card p-8 bg-blue-600 text-white shadow-xl shadow-blue-100">
             <div class="text-xs font-black uppercase tracking-widest opacity-70 mb-2">Average Band</div>
             <div class="text-5xl font-black">${avgBand}</div>
             <div class="mt-4 text-xs font-bold bg-blue-500/30 py-1 px-3 rounded-full inline-block">Based on ${sortedSubmissions.length} tests</div>
          </div>
          <div class="card p-8">
             <div class="text-xs font-black text-muted uppercase tracking-widest mb-2">Recent Score</div>
             <div class="text-5xl font-black text-gray-800">${latest.score_band || '---'}</div>
             <div class="mt-4 text-xs font-bold text-green-600">Module: ${latest.exams.module.toUpperCase()}</div>
          </div>
          <div class="card p-8">
             <div class="text-xs font-black text-muted uppercase tracking-widest mb-2">Tests Completed</div>
             <div class="text-5xl font-black text-gray-800">${sortedSubmissions.length}</div>
             <div class="mt-4 text-xs font-bold text-blue-600">In the last 30 days</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <!-- Trend Mock (Visual only for MVP without Chart.js) -->
          <div class="card p-8 min-h-[400px]">
            <h3 class="font-bold text-xl mb-8">Score History</h3>
            <div class="space-y-6">
              ${sortedSubmissions.slice(-5).map(s => `
                <div class="flex items-center gap-4">
                  <div class="text-xs font-bold text-muted w-20">${new Date(s.submitted_at).toLocaleDateString()}</div>
                  <div class="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 rounded-full" style="width: ${(s.score_band / 9) * 100}%"></div>
                  </div>
                  <div class="font-bold text-blue-600 w-8 text-right">${s.score_band}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Module Breakdown -->
          <div class="card p-8 min-h-[400px]">
            <h3 class="font-bold text-xl mb-8">Module Performance</h3>
            <div class="grid grid-cols-2 gap-6">
               <div class="p-6 bg-green-50 rounded-3xl border border-green-100 text-center">
                  <div class="text-3xl mb-2">👂</div>
                  <div class="text-xs font-black text-green-700 uppercase mb-1">Listening</div>
                  <div class="text-2xl font-bold text-green-800">${calculateModuleAvg(sortedSubmissions, 'listening')}</div>
               </div>
               <div class="p-6 bg-blue-50 rounded-3xl border border-blue-100 text-center">
                  <div class="text-3xl mb-2">📖</div>
                  <div class="text-xs font-black text-blue-700 uppercase mb-1">Reading</div>
                  <div class="text-2xl font-bold text-blue-800">${calculateModuleAvg(sortedSubmissions, 'reading')}</div>
               </div>
               <div class="p-6 bg-purple-50 rounded-3xl border border-purple-100 text-center">
                  <div class="text-3xl mb-2">✍️</div>
                  <div class="text-xs font-black text-purple-700 uppercase mb-1">Writing</div>
                  <div class="text-2xl font-bold text-purple-800">${calculateModuleAvg(sortedSubmissions, 'writing')}</div>
               </div>
               <div class="p-6 bg-orange-50 rounded-3xl border border-orange-100 text-center">
                  <div class="text-3xl mb-2">🗣️</div>
                  <div class="text-xs font-black text-orange-700 uppercase mb-1">Speaking</div>
                  <div class="text-2xl font-bold text-orange-800">${calculateModuleAvg(sortedSubmissions, 'speaking')}</div>
               </div>
            </div>
          </div>
        </div>
      </div>
    `;

  } catch (err) {
    showToast(err.message, 'error');
  }

  function calculateModuleAvg(subs, module) {
    const moduleSubs = subs.filter(s => s.exams.module.toLowerCase() === module);
    if (moduleSubs.length === 0) return '---';
    const sum = moduleSubs.reduce((acc, s) => acc + (parseFloat(s.score_band) || 0), 0);
    return (sum / moduleSubs.length).toFixed(1);
  }
}
