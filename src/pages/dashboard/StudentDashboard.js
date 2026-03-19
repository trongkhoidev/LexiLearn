/* ============================================
   LexiLearn — Student Dashboard Component
   ============================================
*/

import { escapeHtml, renderEmptyState, percent } from '../../utils/helpers.js';
import { navigateTo } from '../../router.js';
import { signOut } from '../../utils/supabase.js';
import { toSlug } from '../../utils/url.js';
import { renderIcon } from '../../utils/icons.js';

export function renderStudentDashboard(container, user, words, dueWords, studiedToday, mastery, data) {
  const { submissions, desks, calculatedBand, xp, streak } = data;
  const targetXP = 1000;
  const xpPercent = Math.min(percent(xp, targetXP), 100);

  container.innerHTML = `
    <div class="dashboard-container animate-fade-in-up">
      <!-- Hero -->
      <div class="hero-card shadow-xl p-10 mb-10 text-white flex-between relative overflow-hidden" style="background: var(--gradient-primary); border: none;">
        <div class="relative z-10 flex-1">
          <span class="text-xxs font-black uppercase tracking-widest text-blue-100 mb-2 block">Student Journey</span>
          <h1 class="text-3xl font-extra-bold text-white mb-2">Hello, ${user.full_name}!</h1>
          <p class="text-blue-50 leading-relaxed max-w-lg mb-6">
            ${dueWords.length > 0 
              ? `You have <strong class="text-white">${dueWords.length}</strong> cards waiting for review.` 
              : "You've crushed your vocabulary goals for now. Ready for a practice test?"}
          </p>
          <div class="flex items-center gap-6">
             <div class="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/20">
                <div style="color: white; display: flex; align-items: center; justify-content: center;">${renderIcon('check', 20)}</div>
                <div>
                  <div class="text-lg font-black leading-none">${streak}</div>
                  <div class="text-[10px] font-bold uppercase tracking-widest text-blue-200">Day Streak</div>
                </div>
             </div>
             <div class="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-2xl border border-white/20">
                <div style="color: white; display: flex; align-items: center; justify-content: center;">${renderIcon('stats', 20)}</div>
                <div>
                  <div class="text-lg font-black leading-none">${xp}</div>
                  <div class="text-[10px] font-bold uppercase tracking-widest text-blue-200">Total XP</div>
                </div>
             </div>
          </div>
        </div>
        <div class="relative z-10 flex flex-col items-end gap-3">
           <button class="btn bg-white text-blue-600 hover:bg-blue-50 font-black px-10 py-4 shadow-xl" id="dash-study-btn">Continue Review</button>
           <button class="btn btn-ghost text-blue-100 hover:bg-white/10" id="dash-logout-btn">Log Out</button>
        </div>
        <div class="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <div class="grid grid-2 gap-8 mb-10">
        <!-- Today's Focus -->
        <div class="card shadow-sm border-t-4 border-blue-500">
           <div class="flex-between mb-8">
              <h3 class="font-black text-xs uppercase tracking-widest text-muted">Today's Focus</h3>
              <div class="text-xxs font-bold text-blue-500">New Goal: ${targetXP} XP</div>
           </div>
           
           <div class="flex items-center gap-8 mb-8">
              <div class="relative w-24 h-24">
                <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" stroke-width="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--color-blue)" stroke-width="3" stroke-dasharray="${xpPercent}, 100" stroke-linecap="round" class="transition-all duration-1000" />
                </svg>
                <div class="absolute inset-0 flex-center flex-col">
                  <span class="text-xl font-black">${xpPercent}%</span>
                  <span class="text-[8px] text-muted uppercase font-bold">Progress</span>
                </div>
              </div>
              <div class="flex-1">
                 <div class="font-bold text-sm mb-1">${studiedToday < 20 ? 'Keep Pushing!' : 'Daily Goal Hit!'}</div>
                 <p class="text-xxs text-muted leading-relaxed mb-4">You've completed <strong>${studiedToday}</strong> reviews today. Reach 20 to hit your daily target.</p>
                 <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 transition-all duration-1000" style="width: ${percent(studiedToday, 20)}%"></div>
                 </div>
              </div>
           </div>

           <div class="pt-6 border-t border-gray-50 flex gap-4">
              <div class="flex-1 p-4 bg-blue-50 rounded-2xl text-center">
                 <div class="text-xl font-black text-blue-600">${mastery.Mastered}</div>
                 <div class="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Mastered</div>
              </div>
              <div class="flex-1 p-4 bg-orange-50 rounded-2xl text-center">
                 <div class="text-xl font-black text-orange-600">${dueWords.length}</div>
                 <div class="text-[9px] font-black text-orange-400 uppercase tracking-tighter">To Review</div>
              </div>
              <div class="flex-1 p-4 bg-green-50 rounded-2xl text-center">
                 <div class="text-xl font-black text-green-600">${submissions.length}</div>
                 <div class="text-[9px] font-black text-green-400 uppercase tracking-tighter">Submissions</div>
              </div>
           </div>
        </div>

        <!-- Career Insight -->
        <div class="card bg-gray-900 border-none text-white relative overflow-hidden flex flex-col justify-between">
           <div class="relative z-10">
              <div class="flex-between mb-8">
                <h3 class="text-xs font-black text-blue-400 uppercase tracking-widest">Expected Performance</h3>
                <span class="badge bg-blue-500/20 text-blue-300 border-none text-[10px]">Real-time Analysis</span>
              </div>
              <div class="flex items-center gap-8">
                 <div class="w-32 h-32 rounded-3xl bg-blue-600 border border-white/10 flex-center flex-col shadow-2xl relative">
                    <span class="text-4xl font-extra-bold">${calculatedBand || '6.5'}</span>
                    <span class="text-[10px] font-bold text-blue-200 uppercase mt-1">Band Score</span>
                    <div class="absolute -top-2 -right-2 bg-yellow-400 text-gray-900 w-8 h-8 rounded-full flex-center text-xs font-black border-2 border-gray-900 shadow-lg">★</div>
                 </div>
                 <div class="flex-1">
                    <div class="text-lg font-bold mb-1">${calculatedBand >= 7 ? 'High Proficiency' : 'Developing Level'}</div>
                    <p class="text-xs text-blue-100/60 leading-relaxed mb-6">Based on your recent IELTS mock sessions and vocabulary mastery index.</p>
                    <button class="btn btn-primary btn-sm bg-white text-gray-900 hover:bg-blue-50 w-full font-bold" onclick="navigateTo('/stats')">Deep Performance Audit</button>
                 </div>
              </div>
           </div>
           <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600/10 blur-3xl pointer-events-none"></div>
        </div>
      </div>

      <!-- Quick Access & Recents -->
      <div class="grid grid-2 gap-8 mb-10">
        <div class="card shadow-sm">
          <h3 class="font-bold mb-6">Quick Access</h3>
          <div class="grid grid-2 gap-4">
            <button class="flex flex-col items-center justify-center p-6 bg-blue-50 hover:bg-blue-100 rounded-2xl border border-blue-100 transition-all hover-lift" onclick="navigateTo('/decks')">
              <div style="color: var(--color-blue); margin-bottom: 12px;">${renderIcon('decks', 28)}</div>
              <div class="text-xs font-black uppercase tracking-widest text-blue-600">My Decks</div>
              <div class="text-[10px] text-blue-400 mt-1">Manage Vocabulary</div>
            </button>
            <button class="flex flex-col items-center justify-center p-6 bg-pink-50 hover:bg-pink-100 rounded-2xl border border-pink-100 transition-all hover-lift" onclick="navigateTo('/my-assignments')">
              <div style="color: #ec4899; margin-bottom: 12px;">${renderIcon('assignments', 28)}</div>
              <div class="text-xs font-black uppercase tracking-widest text-pink-600">Assignments</div>
              <div class="text-[10px] text-pink-400 mt-1">View Tasks</div>
            </button>
            <button class="flex flex-col items-center justify-center p-6 bg-green-50 hover:bg-green-100 rounded-2xl border border-green-100 transition-all hover-lift" onclick="navigateTo('/personal-desk')">
              <div style="color: #16a34a; margin-bottom: 12px;">${renderIcon('desk', 28)}</div>
              <div class="text-xs font-black uppercase tracking-widest text-green-600">My Desk</div>
              <div class="text-[10px] text-green-400 mt-1">Saved Materials</div>
            </button>
            <button class="flex flex-col items-center justify-center p-6 bg-gray-50 hover:bg-gray-100 rounded-2xl border border-gray-100 transition-all hover-lift" onclick="navigateTo('/settings')">
              <div style="color: #666; margin-bottom: 12px;">${renderIcon('settings', 28)}</div>
              <div class="text-xs font-black uppercase tracking-widest text-gray-600">Profile</div>
              <div class="text-[10px] text-gray-400 mt-1">Account & Progress</div>
            </button>
          </div>
        </div>

        <div class="card shadow-sm">
          <h3 class="font-bold mb-6">Recent Desk Items</h3>
          <div class="grid grid-2 gap-4" id="dash-desk-recents">
            ${desks.length === 0 || desks[0]?.items?.length === 0 ? renderEmptyState({ icon: '🗄️', title: 'Desk is Empty', message: 'Save materials to your desk to see them here.' }) :
              desks[0].items.slice(0, 4).map(it => `
                <div class="card card-hover flex flex-col justify-between p-4 h-full border-b-4 border-b-blue-400">
                  <div class="mb-3">
                    <div class="text-xxs font-black text-blue-500 uppercase tracking-widest mb-1">${it.item_type}</div>
                    <h4 class="font-bold text-sm line-clamp-2">${escapeHtml(it.title || 'Untitled')}</h4>
                  </div>
                  <div class="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                     <span class="text-xxs text-muted">${new Date(it.created_at).toLocaleDateString()}</span>
                     <button class="btn btn-ghost btn-xs text-blue-600 font-bold" onclick="navigateTo('/materials')">Open</button>
                  </div>
                </div>
              `).join('')
            }
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

  container.querySelector('#dash-study-btn')?.addEventListener('click', () => {
    const decksList = data.decks || [];
    if (decksList.length > 0) {
      const now = new Date();
      const best = decksList.find(d => words.some(w => w.deck_id === d.id && (!w.next_review || new Date(w.next_review) <= now))) || decksList[0];
      navigateTo(`/study/${toSlug(best.name)}`);
    } else {
      navigateTo('/decks');
    }
  });

  window.navigateTo = navigateTo;
}
