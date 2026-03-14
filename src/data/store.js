/* ============================================
   LexiLearn Data Store — LEGACY
   ============================================
   Core data now lives in Supabase. 
   This module is kept only for minimal helper functions.
*/

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function todayKey() {
  return dateKey(new Date());
}

export function dateKey(d) {
  return d.toISOString().slice(0, 10);
}

export function onStoreChange(cb) {
  window.addEventListener('store-change', cb);
  return () => window.removeEventListener('store-change', cb);
}

export { todayKey as getTodayKey, dateKey as getDateKey };
