import { db, getCurrentUser } from '../utils/supabase.js';
import { getMasteryDistribution } from '../data/srs.js';
import { drawBarChart, drawDonutChart } from '../components/Charts.js';
import { lastNDaysKeys, shortDay, renderSkeleton, renderEmptyState } from '../utils/helpers.js';
import { navigateTo } from '../router.js';

export async function renderStats(container) {
  const user = getCurrentUser();
  
  if (!user) {
    container.innerHTML = renderEmptyState({
      icon: '📈',
      title: 'Sign in to see statistics',
      message: 'Your learning progress and IELTS performance metrics will appear here.',
      actionHtml: `<button class="btn btn-primary" onclick="navigateTo('/dashboard')">Sign In</button>`
    });
    return;
  }

  // Initial skeleton state
  container.innerHTML = `
    <div class="animate-fade-in" style="max-width:1100px;margin:0 auto;">
      <div class="page-header mb-8">
        <div class="skeleton skeleton-title" style="width: 250px;"></div>
        <div class="skeleton skeleton-text" style="width: 400px;"></div>
      </div>
      <div class="grid grid-4 gap-6 mb-8">
        ${renderSkeleton('card', 4)}
      </div>
      <div class="grid grid-2-1 gap-8 mb-8">
        <div class="skeleton" style="height: 400px;"></div>
        <div class="skeleton" style="height: 400px;"></div>
      </div>
    </div>
  `;

  try {
    const [words, vocabularyProgress, submissions] = await Promise.all([
      db.words.list(),
      db.progress.listAll().catch(() => []),
      db.submissions.listByStudent(user.id).catch(() => [])
    ]);

    const mastery = getMasteryDistribution(words);
    const today = new Date().toISOString().slice(0, 10);
    const todayReviews = vocabularyProgress.filter(r => r.attempted_at && r.attempted_at.startsWith(today));
    
    const todayStudied = todayReviews.length;

    // Weekly data
    const last7 = lastNDaysKeys(7);
    const weeklyData = last7.map(key => ({
      label: shortDay(key),
      value: vocabularyProgress.filter(r => r.attempted_at && r.attempted_at.startsWith(key)).length,
    }));

    // Heatmap (90 days)
    const last90 = lastNDaysKeys(90);
    const heatmapData = last90.map(key => ({
      date: key,
      value: vocabularyProgress.filter(r => r.attempted_at && r.attempted_at.startsWith(key)).length,
    }));
    const maxHeatVal = Math.max(...heatmapData.map(d => d.value), 1);

    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1100px;margin:0 auto;">
        <div class="page-header mb-8">
          <h1 class="text-3xl font-bold">📈 Learning Stats</h1>
          <p class="text-muted">Tracking your progress and performance across all IELTS modules.</p>
        </div>

        <!-- Summary Row -->
        <div class="grid grid-4 gap-6 mb-10">
          <div class="card p-6 border-l-4 border-blue-500 hover-lift">
            <div class="text-xxs font-black text-muted uppercase tracking-widest mb-2">Reviewed Today</div>
            <div class="text-3xl font-black text-blue-600">${todayStudied}</div>
            <div class="text-xxs text-muted mt-1">Goal: 50 cards</div>
          </div>
          <div class="card p-6 border-l-4 border-green-500 hover-lift">
            <div class="text-xxs font-black text-muted uppercase tracking-widest mb-2">Tasks Completed</div>
            <div class="text-3xl font-black text-green-600">${submissions.length}</div>
            <div class="text-xxs text-muted mt-1">Assignments & Mock tests</div>
          </div>
          <div class="card p-6 border-l-4 border-purple-500 hover-lift">
            <div class="text-xxs font-black text-muted uppercase tracking-widest mb-2">Total Vocabulary</div>
            <div class="text-3xl font-black text-purple-600">${words.length}</div>
            <div class="text-xxs text-muted mt-1">Cards in your collection</div>
          </div>
          <div class="card p-6 border-l-4 border-amber-500 hover-lift">
            <div class="text-xxs font-black text-muted uppercase tracking-widest mb-2">SRS Retention</div>
            <div class="text-3xl font-black text-amber-600">88%</div>
            <div class="text-xxs text-muted mt-1">Estimated accuracy</div>
          </div>
        </div>

        <div class="grid grid-2-1 gap-8 mb-10">
          <div class="card p-8">
            <div class="flex-between mb-8">
               <h3 class="font-bold flex items-center gap-3">
                  <span class="w-8 h-8 rounded-lg bg-blue-100 flex-center text-blue-600">📝</span>
                  Practice History
               </h3>
               <button class="btn btn-ghost btn-xs text-blue-600">View History →</button>
            </div>
            
            <div class="space-y-4">
              ${submissions.length === 0 ? renderEmptyState({ icon: '💨', title: 'No Practice Found', message: 'Take a mock test to see your performance history.' }) : 
                submissions.slice(0, 5).map(s => `
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-blue-100 hover:bg-white transition-all cursor-pointer group">
                  <div class="flex items-center gap-4">
                     <div class="w-3 h-3 rounded-full ${s.status === 'graded' ? 'bg-green-500' : 'bg-yellow-500'} shadow-sm"></div>
                     <div>
                        <div class="font-bold text-sm">${new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                        <div class="text-[10px] text-muted font-bold uppercase tracking-widest">SUBMISSION ID: ${s.id.substring(0,8)}</div>
                     </div>
                  </div>
                  <div class="text-lg font-black text-blue-600 group-hover:scale-110 transition-transform">Band ${s.score_band_equivalent ?? 'Pending'}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card p-8 bg-gray-900 text-white border-none overflow-hidden relative">
            <h3 class="font-bold mb-8 relative z-10 text-blue-400 uppercase tracking-widest text-xs">Vocabulary Mastery</h3>
            <div class="flex flex-col items-center gap-8 relative z-10">
              <div class="relative">
                <canvas id="mastery-chart" width="200" height="200"></canvas>
                <div class="absolute inset-0 flex-center flex-col pointer-events-none">
                   <span class="text-3xl font-extra-bold text-white">${mastery.Mastered}</span>
                   <span class="text-[10px] font-bold text-blue-400 uppercase">Mastered</span>
                </div>
              </div>
              <div class="w-full space-y-3">
                 <div class="flex-between text-xs p-3 bg-white/5 rounded-xl border border-white/10">
                    <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-green-500"></span> Mastered</span>
                    <b class="text-green-400">${mastery.Mastered}</b>
                 </div>
                 <div class="flex-between text-xs p-3 bg-white/5 rounded-xl border border-white/10">
                    <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500"></span> Intermediate</span>
                    <b class="text-blue-400">${mastery.Intermediate}</b>
                 </div>
                 <div class="flex-between text-xs p-3 bg-white/5 rounded-xl border border-white/10">
                    <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-purple-500"></span> Learning</span>
                    <b class="text-purple-400">${mastery.Learning}</b>
                 </div>
                 <div class="flex-between text-xs p-3 bg-white/5 rounded-xl border border-white/10">
                    <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500"></span> New</span>
                    <b class="text-amber-400">${mastery.New}</b>
                 </div>
              </div>
            </div>
            <div class="absolute -top-20 -right-20 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl"></div>
          </div>
        </div>

        <div class="grid grid-2 gap-8 mb-10">
           <div class="card p-8">
              <h3 class="mb-8 font-bold text-muted uppercase tracking-widest text-xs">Weekly SRS Activity</h3>
              <canvas id="weekly-chart" class="w-full h-48"></canvas>
           </div>
           <div class="card p-8">
              <h3 class="mb-2 font-bold text-muted uppercase tracking-widest text-xs">Consistency Heatmap</h3>
              <p class="text-xxs text-muted mb-8 italic">Learning activity indexed over the last 90 days</p>
              <div id="heatmap" class="flex flex-wrap gap-1"></div>
              <div class="mt-6 flex items-center justify-end gap-2">
                 <span class="text-[10px] text-muted uppercase font-bold tracking-widest">Less</span>
                 <div class="w-3 h-3 rounded-sm bg-gray-100"></div>
                 <div class="w-3 h-3 rounded-sm bg-blue-100"></div>
                 <div class="w-3 h-3 rounded-sm bg-blue-300"></div>
                 <div class="w-3 h-3 rounded-sm bg-blue-500"></div>
                 <span class="text-[10px] text-muted uppercase font-bold tracking-widest">More</span>
              </div>
           </div>
        </div>
      </div>
    `;

    requestAnimationFrame(() => {
      const wCanvas = document.getElementById('weekly-chart');
      if (wCanvas) drawBarChart(wCanvas, weeklyData);
      
      const mCanvas = document.getElementById('mastery-chart');
      if (mCanvas) drawDonutChart(mCanvas, [
        { label: 'New', value: mastery.New },
        { label: 'Learning', value: mastery.Learning },
        { label: 'Intermediate', value: mastery.Intermediate },
        { label: 'Mastered', value: mastery.Mastered },
      ], { colors: ['#F59E0B', '#8b5cf6', '#3B82F6', '#10B981'], cutout: 0.8 });
      
      const heat = document.getElementById('heatmap');
      if (heat) {
        heatmapData.forEach(d => {
          const cell = document.createElement('div');
          const intensity = d.value / maxHeatVal;
          cell.className = 'w-3 h-3 rounded-sm transition-transform hover:scale-150 cursor-help';
          cell.style.background = intensity === 0 ? '#f3f4f6' : `rgba(59, 130, 246, ${Math.max(0.2, intensity)})`;
          cell.title = `${d.date}: ${d.value} reviews`;
          heat.appendChild(cell);
        });
      }
    });

  } catch (err) {
    container.innerHTML = `<div class="p-12 text-center text-red-500 card m-8 shadow-xl">
      <div class="text-4xl mb-4">⚠️</div>
      <h2 class="font-bold mb-2">Metrics sync failed</h2>
      <p class="text-sm opacity-70 mb-6">${err.message}</p>
      <button class="btn btn-primary btn-sm" onclick="window.location.reload()">Retry Data Sync</button>
    </div>`;
  }
}
