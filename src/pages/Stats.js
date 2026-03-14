import { db } from '../utils/supabase.js';
import { getMasteryDistribution } from '../data/srs.js';
import { drawBarChart, drawDonutChart } from '../components/Charts.js';
import { lastNDaysKeys, shortDay } from '../utils/helpers.js';

export async function renderStats(container) {
  // Show loading
  container.innerHTML = `<div class="p-20 flex justify-center"><div class="spinner"></div></div>`;

  try {
    const words = await db.words.list();
    const reviews = await db.progress.listAll ? await db.progress.listAll() : []; // Simple fallback
    // Wait, I don't have listAll in db.progress. Let me check supabase.js or use generic fetch
    
    // I previously implemented db.progress.get but not listAll.
    // I'll fetch progress for vocabulary using target_type='word'
    const vocabularyProgress = await fetch(`${localStorage.getItem('lexilearn_supabase_url')}/rest/v1/user_progress?target_type=eq.word&select=*`, {
      headers: {
        'apikey': localStorage.getItem('lexilearn_supabase_key'),
        'Authorization': `Bearer ${localStorage.getItem('lexilearn_supabase_key')}`
      }
    }).then(res => res.json()).catch(() => []);

    const mastery = getMasteryDistribution(words);
    const today = new Date().toISOString().slice(0, 10);
    const todayReviews = vocabularyProgress.filter(r => r.attempted_at && r.attempted_at.startsWith(today));
    
    const todayStudied = todayReviews.length;
    const todayCorrect = todayReviews.filter(r => r.status === 'correct').length;

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
      <div class="animate-fade-in-up">
        <div class="page-header mb-8">
          <h1 class="text-3xl font-bold">📈 Learning Stats</h1>
          <p class="text-muted">Tracking your progress from the cloud database.</p>
        </div>

        <!-- summary row -->
        <div class="grid grid-4 gap-6 mb-8">
          <div class="card p-6 text-center border-l-4 border-blue-500">
            <div class="text-3xl font-bold text-blue-500">${todayStudied}</div>
            <div class="text-sm text-muted">Reviewed Today</div>
          </div>
          <div class="card p-6 text-center border-l-4 border-green-500">
            <div class="text-3xl font-bold text-green-500">${todayCorrect}</div>
            <div class="text-sm text-muted">Correct Today</div>
          </div>
          <div class="card p-6 text-center border-l-4 border-purple-500">
            <div class="text-3xl font-bold text-purple-500">${words.length}</div>
            <div class="text-sm text-muted">Total Words</div>
          </div>
          <div class="card p-6 text-center border-l-4 border-amber-500">
            <div class="text-3xl font-bold text-amber-500">${vocabularyProgress.length}</div>
            <div class="text-sm text-muted">All-time Reviews</div>
          </div>
        </div>

        <div class="grid grid-2 gap-8 mb-8">
          <div class="card p-6">
            <h3 class="mb-4 font-bold">Weekly Activity</h3>
            <canvas id="weekly-chart" class="w-full h-48"></canvas>
          </div>
          <div class="card p-6">
            <h3 class="mb-4 font-bold">Mastery Distribution</h3>
            <div class="flex items-center gap-6">
              <canvas id="mastery-chart" class="w-32 h-32"></canvas>
              <div class="flex-1 space-y-2">
                 <div class="flex justify-between text-sm"><span>Mastered</span><b>${mastery.Mastered}</b></div>
                 <div class="flex justify-between text-sm"><span>Intermediate</span><b>${mastery.Intermediate}</b></div>
                 <div class="flex justify-between text-sm"><span>Learning</span><b>${mastery.Learning}</b></div>
                 <div class="flex justify-between text-sm"><span>New</span><b>${mastery.New}</b></div>
              </div>
            </div>
          </div>
        </div>

        <div class="card p-6 mb-8">
          <h3 class="mb-4 font-bold">90-Day Activity</h3>
          <div id="heatmap" class="flex flex-wrap gap-1"></div>
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
      ], { colors: ['#F59E0B', '#8b5cf6', '#3B82F6', '#10B981'] });
      
      const heat = document.getElementById('heatmap');
      if (heat) {
        heatmapData.forEach(d => {
          const cell = document.createElement('div');
          const intensity = d.value / maxHeatVal;
          cell.className = 'w-3 h-3 rounded-sm';
          cell.style.background = intensity === 0 ? '#f3f4f6' : `rgba(59, 130, 246, ${Math.max(0.2, intensity)})`;
          cell.title = `${d.date}: ${d.value} reviews`;
          heat.appendChild(cell);
        });
      }
    });

  } catch (err) {
    container.innerHTML = `<div class="p-8 text-red-500">Error: ${err.message}</div>`;
  }
}
