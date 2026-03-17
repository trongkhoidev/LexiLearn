/* ============================================
   LexiLearn — Dashboard Page (Refactored)
   ============================================
*/

import { db, getCurrentUser } from '../../utils/supabase.js';
import { renderLogin } from '../Login.js';
import { getMasteryDistribution } from '../../data/srs.js';
import { renderSkeleton } from '../../utils/helpers.js';
import { calculateStreak } from './DashboardUtils.js';

// Sub-components
import { renderTeacherDashboard } from './TeacherDashboard.js';
import { renderStudentDashboard } from './StudentDashboard.js';

export async function renderDashboard(container) {
  const user = getCurrentUser();
  
  if (!user) {
    renderLogin(container);
    return;
  }

  // Initial skeleton state
  container.innerHTML = `
    <div class="dashboard-container animate-fade-in">
      <div class="skeleton" style="height: 180px; width: 100%; border-radius: var(--border-radius-xl); margin-bottom: var(--space-10);"></div>
      <div class="grid grid-2 gap-8 mb-10">
        <div class="skeleton" style="height: 250px;"></div>
        <div class="skeleton" style="height: 250px;"></div>
      </div>
      <div class="grid grid-4 gap-6 mb-10">
        ${renderSkeleton('card', 4)}
      </div>
    </div>
  `;

  try {
    const isTeacher = user.role === 'teacher';
    
    // Global data
    const wordsPromise = db.words.list();
    const decksPromise = db.decks.list();
    
    // Role specific data
    let roleSpecificPromise;
    if (isTeacher) {
      roleSpecificPromise = db.classrooms.listByTeacher(user.id).then(async (classes) => {
        const allAssignments = await Promise.all(classes.map(c => db.assignments.listByClassroom(c.id)));
        return { classes, assignments: allAssignments.flat() };
      });
    } else {
      roleSpecificPromise = Promise.all([
        db.submissions.listByStudent(user.id),
        db.progressSnapshots.listForUser(user.id),
        db.desks.listByUser(user.id)
      ]).then(([submissions, snapshots, desks]) => ({ submissions, snapshots, desks }));
    }

    const [words, decks, roleData] = await Promise.all([wordsPromise, decksPromise, roleSpecificPromise]);

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const dueWords = words.filter(w => !w.next_review || new Date(w.next_review) <= now);
    const studiedToday = words.filter(w => w.last_review && w.last_review.startsWith(todayStr)).length;
    const mastery = getMasteryDistribution(words);

    if (isTeacher) {
      renderTeacherDashboard(container, user, { ...roleData, words, decks });
    } else {
      const { submissions, desks } = roleData;
      
      // Calculate student metrics
      let calculatedBand = null;
      if (submissions?.length > 0) {
        const withScores = submissions.filter(s => s.score_band_equivalent !== null && s.score_band_equivalent !== undefined);
        if (withScores.length > 0) {
          const avg = withScores.reduce((acc, s) => acc + parseFloat(s.score_band_equivalent), 0) / withScores.length;
          calculatedBand = avg.toFixed(1);
        }
      }
      
      const srsXP = mastery.Mastered * 50 + mastery.Intermediate * 20 + mastery.Learning * 10;
      const tasksXP = (submissions?.filter(s => s.status === 'submitted' || s.status === 'graded').length || 0) * 100;
      const xp = srsXP + tasksXP;
      const streak = calculateStreak(words, submissions);
      
      renderStudentDashboard(container, user, words, dueWords, studiedToday, mastery, { ...roleData, decks, calculatedBand, xp, streak });
    }

  } catch (err) {
    container.innerHTML = `
      <div class="p-12 text-center text-red-500 card m-8 shadow-xl">
        <div class="text-4xl mb-4">⚠️</div>
        <h2 class="font-bold mb-2">Failed to load Dashboard</h2>
        <p class="text-sm opacity-70 mb-6">${err.message}</p>
        <button class="btn btn-primary btn-sm" onclick="window.location.reload()">Try Again</button>
      </div>
    `;
  }
}
