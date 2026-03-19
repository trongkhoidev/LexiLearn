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
      <div class="hero-card shadow-xl text-white mb-12 flex items-center justify-between relative overflow-hidden" style="background: var(--gradient-primary); border: none;">
        <div class="relative z-10 flex-1">
          <span class="text-xxs font-black uppercase tracking-widest text-blue-100 mb-3 block">Student Journey</span>
          <h1 class="text-4xl font-extrabold text-white mb-3">Hello, ${user.full_name}!</h1>
          <p class="text-blue-100 text-lg leading-relaxed max-w-xl mb-6">
            ${dueWords.length > 0 
              ? `You have <strong class="text-white font-bold">${dueWords.length}</strong> cards waiting for review.` 
              : "You've crushed your vocabulary goals for now. Ready for a practice test?"}
          </p>
          <div class="flex items-center gap-4">
             <div class="flex items-center gap-3 bg-white/15 px-4 py-2.5 rounded-xl border border-white/30 backdrop-blur-sm">
                <div style="color: white; display: flex; align-items: center; justify-content: center;">${renderIcon('check', 20)}</div>
                <div>
                  <div class="text-xl font-extrabold leading-none">${streak}</div>
                  <div class="text-[10px] font-bold uppercase tracking-widest text-blue-200">Day Streak</div>
                </div>
             </div>
             <div class="flex items-center gap-3 bg-white/15 px-4 py-2.5 rounded-xl border border-white/30 backdrop-blur-sm">
                <div style="color: white; display: flex; align-items: center; justify-content: center;">${renderIcon('stats', 20)}</div>
                <div>
                  <div class="text-xl font-extrabold leading-none">${xp}</div>
                  <div class="text-[10px] font-bold uppercase tracking-widest text-blue-200">Total XP</div>
                </div>
             </div>
          </div>
        </div>
        <div class="relative z-10 flex flex-col items-end gap-3 flex-shrink-0 ml-8">
           <button class="btn bg-white text-blue-600 hover:bg-blue-50 font-bold px-8 py-3 shadow-lg" id="dash-study-btn">Continue Review</button>
           <button class="btn btn-ghost text-blue-100 hover:bg-white/10 font-semibold" id="dash-logout-btn">Log Out</button>
        </div>
        <div class="absolute -bottom-20 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <div class="grid grid-cols-2 gap-8 mb-12">
        <!-- Today's Focus -->
        <div class="card shadow-md border-t-4 border-blue-500">
           <div class="flex items-center justify-between mb-8">
              <h3 class="font-bold text-lg text-gray-900 uppercase tracking-widest">Today's Focus</h3>
              <div class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">Goal: ${targetXP} XP</div>
           </div>
           
           <div class="flex items-center gap-8 mb-10">
              <div class="relative w-28 h-28 flex-shrink-0">
                <svg viewBox="0 0 36 36" class="w-full h-full transform -rotate-90">
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#f1f5f9" stroke-width="3" />
                  <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--color-blue)" stroke-width="3" stroke-dasharray="${xpPercent}, 100" stroke-linecap="round" class="transition-all duration-1000" />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center flex-col">
                  <span class="text-2xl font-extrabold text-gray-900">${xpPercent}%</span>
                  <span class="text-[9px] text-muted uppercase font-bold">Progress</span>
                </div>
              </div>
              <div class="flex-1">
                 <div class="font-bold text-base mb-2 text-gray-900">${studiedToday < 20 ? 'Keep Pushing!' : 'Daily Goal Hit!'}</div>
                 <p class="text-sm text-muted leading-relaxed mb-4">You've completed <strong class="text-gray-900 font-semibold">${studiedToday}</strong> reviews today. Reach 20 to hit your daily target.</p>
                 <div class="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-500 transition-all duration-1000" style="width: ${percent(studiedToday, 20)}%"></div>
                 </div>
              </div>
           </div>

           <div class="pt-6 border-t border-gray-100 grid grid-cols-3 gap-3">
              <div class="p-4 bg-blue-50 rounded-lg text-center border border-blue-100">
                 <div class="text-2xl font-extrabold text-blue-700 mb-1">${mastery.Mastered}</div>
                 <div class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Mastered</div>
              </div>
              <div class="p-4 bg-orange-50 rounded-lg text-center border border-orange-100">
                 <div class="text-2xl font-extrabold text-orange-700 mb-1">${dueWords.length}</div>
                 <div class="text-[10px] font-bold text-orange-600 uppercase tracking-widest">To Review</div>
              </div>
              <div class="p-4 bg-green-50 rounded-lg text-center border border-green-100">
                 <div class="text-2xl font-extrabold text-green-700 mb-1">${submissions.length}</div>
                 <div class="text-[10px] font-bold text-green-600 uppercase tracking-widest">Submitted</div>
              </div>
           </div>
        </div>

        <!-- Career Insight -->
        <div class="card bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-none text-white relative overflow-hidden flex flex-col justify-between shadow-md">
           <div class="relative z-10">
              <div class="flex items-center justify-between mb-8">
                <h3 class="text-base font-bold text-blue-300 uppercase tracking-widest">Expected Performance</h3>
                <span class="badge bg-blue-500/25 text-blue-200 border-none text-xs font-semibold">Real-time Analysis</span>
              </div>
              <div class="flex items-center gap-8">
                 <div class="w-36 h-36 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 border-2 border-blue-400/30 flex-center flex-col shadow-2xl relative flex-shrink-0">
                    <span class="text-5xl font-extrabold">${calculatedBand || '6.5'}</span>
                    <span class="text-[11px] font-bold text-blue-100 uppercase mt-2">Band Score</span>
                    <div class="absolute -top-3 -right-3 bg-yellow-400 text-gray-900 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 border-gray-900 shadow-lg">★</div>
                 </div>
                 <div class="flex-1">
                    <div class="text-xl font-bold mb-2 text-white">${calculatedBand >= 7 ? 'High Proficiency' : 'Developing Level'}</div>
                    <p class="text-sm text-blue-100/70 leading-relaxed mb-6">Based on your recent IELTS mock sessions and vocabulary mastery index.</p>
                    <button class="btn bg-white text-gray-900 hover:bg-blue-50 font-bold w-full" onclick="navigateTo('/stats')">View Full Analysis</button>
                 </div>
              </div>
           </div>
           <div class="absolute -bottom-16 -right-16 w-64 h-64 bg-blue-600/10 blur-3xl pointer-events-none"></div>
        </div>
      </div>

      <!-- Quick Access & Recents -->
      <div class="grid grid-cols-2 gap-8 mb-12">
        <div class="card shadow-md">
          <h3 class="text-lg font-bold text-gray-900 mb-8">Quick Access</h3>
          <div class="grid grid-cols-2 gap-4">
            <button class="flex flex-col items-center justify-center p-6 bg-blue-50 hover:bg-blue-100 rounded-xl border-2 border-blue-200 transition-all hover-lift shadow-sm" onclick="navigateTo('/decks')">
              <div style="color: var(--color-blue); margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">${renderIcon('decks', 32)}</div>
              <div class="text-xs font-black uppercase tracking-widest text-blue-700">My Decks</div>
              <div class="text-[11px] text-blue-500 mt-1 text-center">Manage Vocabulary</div>
            </button>
            <button class="flex flex-col items-center justify-center p-6 bg-pink-50 hover:bg-pink-100 rounded-xl border-2 border-pink-200 transition-all hover-lift shadow-sm" onclick="navigateTo('/my-assignments')">
              <div style="color: #ec4899; margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">${renderIcon('assignments', 32)}</div>
              <div class="text-xs font-black uppercase tracking-widest text-pink-700">Assignments</div>
              <div class="text-[11px] text-pink-500 mt-1 text-center">View Tasks</div>
            </button>
            <button class="flex flex-col items-center justify-center p-6 bg-green-50 hover:bg-green-100 rounded-xl border-2 border-green-200 transition-all hover-lift shadow-sm" onclick="navigateTo('/personal-desk')">
              <div style="color: #16a34a; margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">${renderIcon('desk', 32)}</div>
              <div class="text-xs font-black uppercase tracking-widest text-green-700">My Desk</div>
              <div class="text-[11px] text-green-500 mt-1 text-center">Saved Materials</div>
            </button>
            <button class="flex flex-col items-center justify-center p-6 bg-gray-50 hover:bg-gray-100 rounded-xl border-2 border-gray-200 transition-all hover-lift shadow-sm" onclick="navigateTo('/settings')">
              <div style="color: #666; margin-bottom: 12px; display: flex; align-items: center; justify-content: center;">${renderIcon('settings', 32)}</div>
              <div class="text-xs font-black uppercase tracking-widest text-gray-700">Profile</div>
              <div class="text-[11px] text-gray-500 mt-1 text-center">Account & Progress</div>
            </button>
          </div>
        </div>

        <div class="card shadow-md">
          <h3 class="text-lg font-bold text-gray-900 mb-8">Recent Desk Items</h3>
          <div class="grid grid-cols-2 gap-4" id="dash-desk-recents">
            ${desks.length === 0 || desks[0]?.items?.length === 0 ? renderEmptyState({ icon: '🗄️', title: 'Desk is Empty', message: 'Save materials to your desk to see them here.' }) :
              desks[0].items.slice(0, 4).map(it => `
                <div class="card shadow-sm flex flex-col justify-between h-full border-l-4 border-l-blue-500 hover-lift">
                  <div class="mb-3">
                    <div class="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1 bg-blue-50 px-2 py-1 rounded inline-block">${it.item_type}</div>
                    <h4 class="font-bold text-sm line-clamp-2 text-gray-900 mt-2">${escapeHtml(it.title || 'Untitled')}</h4>
                  </div>
                  <div class="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                     <span class="text-xs text-muted font-medium">${new Date(it.created_at).toLocaleDateString()}</span>
                     <button class="btn btn-ghost btn-xs text-blue-600 font-bold hover:bg-blue-50" onclick="navigateTo('/materials')">Open</button>
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
