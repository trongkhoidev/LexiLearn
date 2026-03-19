import { db, getCurrentUser } from '../utils/supabase.js';
import { escapeHtml, renderEmptyState } from '../utils/helpers.js';
import { showToast } from '../components/Toast.js';

export async function renderTopics(container) {
  const user = getCurrentUser();
  if (!user || user.role !== 'student') {
    container.innerHTML = `<div class="p-12 text-center text-muted">Student access only.</div>`;
    return;
  }

  container.innerHTML = `<div class="p-12 text-center"><div class="spinner"></div></div>`;

  try {
    const desks = await db.sharedDesks.listForStudent(user.id).catch(() => []);
    if (!desks || desks.length === 0) {
      container.innerHTML = `
        <div class="animate-fade-in-up" style="max-width:1000px;margin:0 auto;">
          <div class="page-header mb-8">
            <h1 class="text-3xl font-bold">🧠 Topics</h1>
            <p class="text-muted">Topics shared by your teachers will appear here.</p>
          </div>
          ${renderEmptyState({ icon: '🧩', title: 'No topics yet', message: 'Ask your teacher to share a topic desk to your classroom.' })}
        </div>
      `;
      return;
    }

    // Load topics for each desk
    const topicsByDesk = await Promise.all(desks.map(d => db.sharedDesks.topics.listByDesk(d.id).catch(() => [])));
    const allTopics = topicsByDesk.flat().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

    // Load progress for student
    const progress = await db.sharedDesks.progress.listByStudent(user.id).catch(() => []);
    const progressMap = new Map(progress.map(p => [`${p.topic_id}`, p]));

    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1000px;margin:0 auto;">
        <div class="page-header mb-8">
          <h1 class="text-3xl font-bold">🧠 Topics</h1>
          <p class="text-muted">Finish the last card and press Done to complete a topic.</p>
        </div>

        <div class="grid grid-2 gap-6">
          ${allTopics.map(t => {
            const p = progressMap.get(`${t.id}`);
            const done = !!p?.done_at;
            return `
              <div class="card p-6 card-interactive topic-card" data-id="${t.id}">
                <div class="flex-between mb-2">
                  <h3 class="font-bold">${escapeHtml(t.title)}</h3>
                  <span class="badge ${done ? 'badge-green' : 'badge-yellow'} text-xxs">${done ? 'Done' : 'In progress'}</span>
                </div>
                <div class="text-xxs text-muted">${done ? `Completed: ${new Date(p.done_at).toLocaleDateString()}` : 'Not completed yet'}</div>
                <div class="mt-5 pt-4 border-t flex justify-end">
                  <button class="btn btn-primary btn-sm start-topic-btn" data-id="${t.id}">${done ? 'Review' : 'Start'}</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.querySelectorAll('.start-topic-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await renderTopicPlayer(container, btn.dataset.id, user.id);
      });
    });

    container.querySelectorAll('.topic-card').forEach(card => {
      card.addEventListener('click', async () => renderTopicPlayer(container, card.dataset.id, user.id));
    });

  } catch (err) {
    container.innerHTML = `<div class="p-12 text-center text-red-500">Error: ${escapeHtml(err.message)}</div>`;
  }
}

async function renderTopicPlayer(container, topicId, studentId) {
  container.innerHTML = `<div class="p-12 text-center"><div class="spinner"></div></div>`;

  try {
    const [topic, items, progressRows] = await Promise.all([
      db.sharedDesks.topics.get(topicId),
      db.sharedDesks.items.listByTopic(topicId).catch(() => []),
      db.sharedDesks.progress.get(topicId, studentId).catch(() => null)
    ]);

    const progress = Array.isArray(progressRows) ? progressRows[0] : progressRows;
    const doneAt = progress?.done_at ? new Date(progress.done_at) : null;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="card p-12 text-center" style="max-width:800px;margin:2rem auto;">
          <h2 class="font-bold mb-2">${escapeHtml(topic?.title || 'Topic')}</h2>
          <p class="text-muted">No cards yet. Ask your teacher to add content.</p>
          <button class="btn btn-primary mt-6" id="back-topics">Back</button>
        </div>
      `;
      document.getElementById('back-topics')?.addEventListener('click', () => renderTopics(container));
      return;
    }

    let idx = 0;
    const total = items.length;

    const renderCard = () => {
      const it = items[idx];
      const front = it.payload?.front || '';
      const back = it.payload?.back || '';
      const isLast = idx === total - 1;

      container.innerHTML = `
        <div class="animate-fade-in-up" style="max-width:900px;margin:0 auto;">
          <button class="btn btn-ghost btn-sm" id="back-topics">← Topics</button>
          <div class="page-header mt-4 mb-6">
            <div class="flex-between">
              <div>
                <h1 class="text-2xl font-bold">${escapeHtml(topic?.title || 'Topic')}</h1>
                <p class="text-muted">Card ${idx + 1}/${total}</p>
              </div>
              <span class="badge ${doneAt ? 'badge-green' : 'badge-yellow'} text-xxs">${doneAt ? 'Done' : 'Learning'}</span>
            </div>
          </div>

          <div class="card p-8">
            <div class="text-xxs font-black text-blue-500 uppercase tracking-widest mb-3">Front</div>
            <div class="text-lg font-bold leading-relaxed">${escapeHtml(front)}</div>
            <div class="mt-6 pt-6 border-t">
              <div class="text-xxs font-black text-purple-500 uppercase tracking-widest mb-3">Back</div>
              <div class="text-sm text-muted leading-relaxed">${escapeHtml(back)}</div>
            </div>
          </div>

          <div class="flex-between mt-6">
            <button class="btn btn-secondary" id="prev-card" ${idx === 0 ? 'disabled' : ''}>← Prev</button>
            <div class="flex items-center gap-2">
              <button class="btn btn-ghost" id="reset-topic">Reset</button>
              <button class="btn btn-primary" id="next-card">${isLast ? 'Finish' : 'Next →'}</button>
            </div>
          </div>

          ${isLast ? `
            <div class="card p-6 mt-6 bg-green-50 border-green-200">
              <div class="flex-between gap-4">
                <div>
                  <div class="font-bold">You reached the last card.</div>
                  <div class="text-xs text-muted">Press Done to mark this topic completed.</div>
                </div>
                <button class="btn btn-primary" id="mark-done-btn">✅ Done</button>
              </div>
            </div>
          ` : ''}
        </div>
      `;

      document.getElementById('back-topics')?.addEventListener('click', () => renderTopics(container));
      document.getElementById('prev-card')?.addEventListener('click', () => { idx = Math.max(0, idx - 1); renderCard(); });
      document.getElementById('next-card')?.addEventListener('click', () => { idx = Math.min(total - 1, idx + 1); renderCard(); });
      document.getElementById('reset-topic')?.addEventListener('click', async () => {
        try {
          await db.sharedDesks.progress.upsert({ topic_id: topicId, student_id: studentId, done_at: null, last_item_index: null });
          showToast('Progress reset', 'success');
          idx = 0;
          renderCard();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
      document.getElementById('mark-done-btn')?.addEventListener('click', async () => {
        try {
          await db.sharedDesks.progress.upsert({
            topic_id: topicId,
            student_id: studentId,
            done_at: new Date().toISOString(),
            last_item_index: total - 1
          });
          showToast('Topic marked as done', 'success');
          renderTopics(container);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    };

    renderCard();
  } catch (err) {
    container.innerHTML = `<div class="p-12 text-center text-red-500">Error: ${escapeHtml(err.message)}</div>`;
  }
}

