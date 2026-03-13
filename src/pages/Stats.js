/* ============================================
   LexiLearn — Statistics Page
   ============================================ */

import { getWords, getStats } from '../data/store.js';
import { getMasteryDistribution } from '../data/srs.js';
import { drawBarChart, drawDonutChart } from '../components/Charts.js';
import { lastNDaysKeys, shortDay } from '../utils/helpers.js';

export function renderStats(container) {
  const words = getWords();
  const stats = getStats();
  const mastery = getMasteryDistribution();
  const today = new Date().toISOString().slice(0, 10);
  const todayStats = stats.dailySessions?.[today] || { studied: 0, newWords: 0, reviewed: 0 };

  // Weekly data
  const last7 = lastNDaysKeys(7);
  const weeklyData = last7.map(key => ({
    label: shortDay(key),
    value: stats.dailySessions?.[key]?.studied || 0,
  }));

  // Heatmap data — last 90 days
  const last90 = lastNDaysKeys(90);
  const heatmapData = last90.map(key => ({
    date: key,
    value: stats.dailySessions?.[key]?.studied || 0,
  }));
  const maxHeatVal = Math.max(...heatmapData.map(d => d.value), 1);

  container.innerHTML = `
    <div class="animate-fade-in-up">
      <div style="margin-bottom:var(--space-8);">
        <h1 style="font-size:var(--font-size-2xl);font-weight:700;color:#1f2937;margin-bottom:var(--space-2);">Learning Statistics</h1>
        <p style="color:#6b7280;font-size:var(--font-size-base);">Track your progress and stay motivated on your learning journey</p>
      </div>

      <!-- Today + Streak -->
      <div class="grid grid-4 stagger" style="margin-bottom:var(--space-8);">
        <div class="card animate-fade-in-up" style="text-align:center;padding:var(--space-6);border-left:4px solid #3B82F6;">
          <div style="font-size:var(--font-size-3xl);font-weight:700;color:#3B82F6;margin-bottom:var(--space-2);">${todayStats.studied}</div>
          <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Studied Today</div>
        </div>
        <div class="card animate-fade-in-up" style="text-align:center;padding:var(--space-6);border-left:4px solid #f59e0b;">
          <div style="font-size:var(--font-size-3xl);font-weight:700;color:#f59e0b;margin-bottom:var(--space-2);">${todayStats.newWords}</div>
          <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">New Words</div>
        </div>
        <div class="card animate-fade-in-up" style="text-align:center;padding:var(--space-6);border-left:4px solid #8b5cf6;">
          <div style="font-size:var(--font-size-3xl);font-weight:700;color:#8b5cf6;margin-bottom:var(--space-2);">${todayStats.reviewed}</div>
          <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Reviewed</div>
        </div>
        <div class="card animate-fade-in-up" style="text-align:center;padding:var(--space-6);border-left:4px solid #ef4444;position:relative;">
          <div style="font-size:1.8rem;margin-bottom:var(--space-1);">🔥</div>
          <div style="font-size:var(--font-size-3xl);font-weight:700;color:#ef4444;margin-bottom:var(--space-2);">${stats.streak || 0}</div>
          <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Day Streak</div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-2" style="margin-bottom:var(--space-8);">
        <!-- Weekly Activity -->
        <div class="card animate-fade-in-up">
          <h3 style="margin-bottom:var(--space-5);font-weight:600;color:#1f2937;font-size:var(--font-size-lg);">Weekly Activity</h3>
          <canvas id="weekly-chart" style="width:100%;height:200px;"></canvas>
        </div>

        <!-- Mastery Distribution -->
        <div class="card animate-fade-in-up">
          <h3 style="margin-bottom:var(--space-5);font-weight:600;color:#1f2937;font-size:var(--font-size-lg);">Mastery Distribution</h3>
          <div class="flex items-center gap-6">
            <canvas id="mastery-chart" style="width:160px;height:160px;flex-shrink:0;"></canvas>
            <div class="flex flex-col gap-3" style="flex:1;">
              ${[
                { label: 'New', value: mastery.New, color: '#F59E0B' },
                { label: 'Learning', value: mastery.Learning, color: '#6C63FF' },
                { label: 'Intermediate', value: mastery.Intermediate, color: '#3B82F6' },
                { label: 'Mastered', value: mastery.Mastered, color: '#10B981' },
              ].map(item => `
                <div class="flex items-center gap-3">
                  <div style="width:10px;height:10px;border-radius:50%;background:${item.color};flex-shrink:0;"></div>
                  <span class="text-sm">${item.label}</span>
                  <span class="text-sm font-semibold" style="margin-left:auto;">${item.value}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- 90-Day Heatmap -->
      <div class="card animate-fade-in-up" style="margin-bottom:var(--space-8);">
        <h3 style="margin-bottom:var(--space-5);font-weight:600;color:#1f2937;font-size:var(--font-size-lg);">90-Day Activity</h3>
        <div id="heatmap" style="display:flex;flex-wrap:wrap;gap:3px;"></div>
        <div class="flex items-center justify-between text-sm text-muted" style="margin-top:var(--space-3);">
          <span>Less</span>
          <div class="flex gap-1">
            ${[0, 0.25, 0.5, 0.75, 1].map(level => `
              <div style="width:12px;height:12px;border-radius:2px;background:${heatmapColor(level)};"></div>
            `).join('')}
          </div>
          <span>More</span>
        </div>
      </div>

      <!-- All-time Stats -->
      <div class="card animate-fade-in-up">
        <h3 style="margin-bottom:var(--space-5);font-weight:600;color:#1f2937;font-size:var(--font-size-lg);">All-Time Summary</h3>
        <div class="grid grid-3">
          <div style="text-align:center;padding:var(--space-6);border-left:4px solid #3B82F6;">
            <div style="font-size:var(--font-size-3xl);font-weight:700;color:#3B82F6;margin-bottom:var(--space-2);">${words.length}</div>
            <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Total Words</div>
          </div>
          <div style="text-align:center;padding:var(--space-6);border-left:4px solid #8b5cf6;">
            <div style="font-size:var(--font-size-3xl);font-weight:700;color:#8b5cf6;margin-bottom:var(--space-2);">${stats.totalWordsStudied || 0}</div>
            <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Total Reviews</div>
          </div>
          <div style="text-align:center;padding:var(--space-6);border-left:4px solid #10b981;">
            <div style="font-size:var(--font-size-3xl);font-weight:700;color:#10b981;margin-bottom:var(--space-2);">${Object.keys(stats.dailySessions || {}).length}</div>
            <div style="color:#6b7280;font-size:var(--font-size-sm);font-weight:500;">Days Active</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render charts after DOM is ready
  requestAnimationFrame(() => {
    const weeklyCanvas = document.getElementById('weekly-chart');
    if (weeklyCanvas) drawBarChart(weeklyCanvas, weeklyData);

    const masteryCanvas = document.getElementById('mastery-chart');
    if (masteryCanvas) {
      drawDonutChart(masteryCanvas, [
        { label: 'New', value: mastery.New },
        { label: 'Learning', value: mastery.Learning },
        { label: 'Intermediate', value: mastery.Intermediate },
        { label: 'Mastered', value: mastery.Mastered },
      ], {
        colors: ['#F59E0B', '#6C63FF', '#3B82F6', '#10B981'],
      });
    }

    // Render heatmap
    const heatmap = document.getElementById('heatmap');
    if (heatmap) {
      heatmapData.forEach(d => {
        const cell = document.createElement('div');
        const intensity = d.value / maxHeatVal;
        cell.style.cssText = `width:12px;height:12px;border-radius:2px;background:${heatmapColor(intensity)};`;
        cell.title = `${d.date}: ${d.value} words`;
        heatmap.appendChild(cell);
      });
    }
  });
}

function heatmapColor(intensity) {
  if (intensity === 0) return 'rgba(255,255,255,0.04)';
  if (intensity < 0.25) return 'rgba(108,99,255,0.2)';
  if (intensity < 0.5) return 'rgba(108,99,255,0.4)';
  if (intensity < 0.75) return 'rgba(108,99,255,0.6)';
  return 'rgba(108,99,255,0.85)';
}
