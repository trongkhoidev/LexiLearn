/* ============================================
   LexiLearn — Dashboard Utilities
   ============================================
*/

export function calculateStreak(progress, submissions) {
  const dates = new Set();
  if (Array.isArray(progress)) {
    progress.forEach(p => { if (p.last_review) dates.add(p.last_review.slice(0, 10)); });
  }
  if (Array.isArray(submissions)) {
    submissions.forEach(s => { if (s.created_at) dates.add(s.created_at.slice(0, 10)); });
  }
  
  const sorted = Array.from(dates).sort((a,b) => new Date(b) - new Date(a));
  if (sorted.length === 0) return 0;
  
  const uniqueDates = Array.from(new Set(sorted.map(d => new Date(d).toDateString())));
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

  let streak = 0;
  let checkDate = new Date(uniqueDates[0]);
  for (let i = 0; i < uniqueDates.length; i++) {
    const loopDate = new Date(uniqueDates[i]);
    const expectedDate = new Date(checkDate);
    expectedDate.setDate(checkDate.getDate() - i);
    
    if (loopDate.toDateString() === expectedDate.toDateString()) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
