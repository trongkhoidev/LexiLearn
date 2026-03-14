import { el, escapeHtml } from '../utils/helpers.js';
import { extractTextFromImage, extractTextFromPDF } from '../utils/ocr.js';
import { lookupWord, buildTooltipHTML } from '../utils/wordLookup.js';
import { generateExercises } from '../utils/exerciseGenerator.js';
import { showToast } from '../components/Toast.js';
import { db } from '../utils/supabase.js';

export async function renderReadingPractice(container) {
  let currentText = '';

  const renderUploadView = async () => {
    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:900px;margin:0 auto;">
        <div class="page-header" style="margin-bottom:var(--space-8);">
          <h1>📄 Reading Practice</h1>
          <p class="text-muted">Upload an image, PDF, or paste text to start practicing IELTS Reading. All progress is saved to cloud.</p>
        </div>

        <div class="flex gap-2" style="margin-bottom:var(--space-6);">
          <button class="btn btn-primary tab-btn active" data-tab="text">📝 Paste Text</button>
          <button class="btn btn-secondary tab-btn" data-tab="image">🖼️ Upload Image</button>
          <button class="btn btn-secondary tab-btn" data-tab="pdf">📑 Upload PDF</button>
        </div>

        <div id="tab-text" class="tab-content">
          <div class="card" style="padding:var(--space-6);">
            <label class="form-label">Paste your reading passage below:</label>
            <textarea id="text-input" class="input" rows="10" placeholder="Paste an IELTS reading passage or any English text..."></textarea>
            <button class="btn btn-primary w-full mt-4" id="analyze-text-btn">🔍 Analyze & Read</button>
          </div>
        </div>

        <div id="tab-image" class="tab-content" style="display:none;">
          <div class="card border-dashed p-10 text-center cursor-pointer" id="image-drop-zone">
            <div class="text-4xl mb-4">🖼️</div>
            <h3>Drop an image here</h3>
            <p class="text-muted mb-4">Supports JPG, PNG — screenshots of books or news articles</p>
            <input type="file" id="image-file-input" accept="image/*" class="hidden" />
          </div>
          <div id="ocr-progress" class="hidden mt-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="spinner"></div>
              <span class="font-medium">Extracting text...</span>
            </div>
          </div>
        </div>

        <div id="tab-pdf" class="tab-content" style="display:none;">
          <div class="card border-dashed p-10 text-center cursor-pointer" id="pdf-drop-zone">
            <div class="text-4xl mb-4">📑</div>
            <h3>Drop a PDF here</h3>
            <p class="text-muted mb-4">Upload Cambridge IELTS PDFs or any document</p>
            <input type="file" id="pdf-file-input" accept="application/pdf" class="hidden" />
          </div>
          <div id="pdf-progress" class="hidden mt-4">
            <div class="flex items-center gap-3 mb-2">
              <div class="spinner"></div>
              <span class="font-medium">Extracting text from PDF...</span>
            </div>
          </div>
        </div>

        <div class="mt-12">
          <h3 class="mb-4">📚 Cloud Saved Readings</h3>
          <div id="recent-readings" class="flex flex-col gap-3">
             <div class="flex justify-center p-8"><div class="spinner"></div></div>
          </div>
        </div>
      </div>
    `;

    // Fetch and render recent readings
    await renderRecentReadings();

    // Tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.className = b.className.replace('btn-primary', 'btn-secondary');
        });
        btn.classList.add('active');
        btn.className = btn.className.replace('btn-secondary', 'btn-primary');

        container.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
        document.getElementById(`tab-${btn.dataset.tab}`).style.display = 'block';
      });
    });

    // Text analyze
    document.getElementById('analyze-text-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('text-input').value.trim();
      if (!text) return showToast('Please paste some text first!', 'info');
      
      const btn = document.getElementById('analyze-text-btn');
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner-sm"></div> Processing...';
      
      try {
        await saveReading(text);
        renderReadingView(text);
      } catch (err) {
        showToast('Failed to save reading to database', 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '🔍 Analyze & Read';
      }
    });

    // Image/PDF logic
    const imageInput = document.getElementById('image-file-input');
    document.getElementById('image-drop-zone')?.addEventListener('click', () => imageInput?.click());
    imageInput?.addEventListener('change', (e) => {
       if (e.target.files[0]) processFile(e.target.files[0], 'image');
    });

    const pdfInput = document.getElementById('pdf-file-input');
    document.getElementById('pdf-drop-zone')?.addEventListener('click', () => pdfInput?.click());
    pdfInput?.addEventListener('change', (e) => {
       if (e.target.files[0]) processFile(e.target.files[0], 'pdf');
    });
  };

  const processFile = async (file, type) => {
    const progressId = type === 'image' ? 'ocr-progress' : 'pdf-progress';
    const progress = document.getElementById(progressId);
    if (progress) progress.classList.remove('hidden');

    try {
      let text = '';
      if (type === 'image') text = await extractTextFromImage(file);
      else text = await extractTextFromPDF(file);

      if (!text.trim()) throw new Error('Could not extract text');
      
      await saveReading(text);
      renderReadingView(text);
      showToast('Text extracted and saved!', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (progress) progress.classList.add('hidden');
    }
  };

  const saveReading = async (text) => {
    const preview = text.substring(0, 150).replace(/\n/g, ' ').trim();
    const wordCount = text.split(/\s+/).length;
    try {
      await db.readings.create({
        title: preview,
        content: text,
        word_count: wordCount
      });
    } catch (err) {
      console.error(err);
      throw new Error(`Cloud save failed: ${err.message}`);
    }
  };

  const renderRecentReadings = async () => {
    const el = document.getElementById('recent-readings');
    if (!el) return;

    try {
      const readings = await db.readings.list();
      if (readings.length === 0) {
        el.innerHTML = `<div class="card p-8 text-center border-dashed"><p class="text-muted">No cloud-saved readings yet.</p></div>`;
        return;
      }

      el.innerHTML = readings.map(r => {
        const date = new Date(r.created_at).toLocaleDateString();
        return `
          <div class="card card-interactive p-4 flex items-center justify-between" data-reading-id="${r.id}">
            <div class="flex-1 truncate mr-4">
              <div class="font-medium truncate">${escapeHtml(r.title)}...</div>
              <div class="text-xs text-muted mt-1">${date} • ${r.word_count || 0} words</div>
            </div>
            <button class="btn btn-ghost btn-sm text-red-500 delete-reading-btn" data-rid="${r.id}">✕</button>
          </div>
        `;
      }).join('');

      el.querySelectorAll('[data-reading-id]').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.delete-reading-btn')) return;
          const reading = readings.find(r => r.id === card.dataset.readingId);
          if (reading) renderReadingView(reading.content);
        });
      });

      el.querySelectorAll('.delete-reading-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm('Delete this reading from cloud?')) {
            await db.readings.delete(btn.dataset.rid);
            renderRecentReadings();
            showToast('Reading deleted', 'info');
          }
        });
      });
    } catch (err) {
      el.innerHTML = `<p class="text-red">Error loading readings: ${err.message}</p>`;
    }
  };

  const renderReadingView = (text) => {
    const paragraphs = text.split(/\n{2,}/).filter(p => p.trim());
    const wrappedText = paragraphs.map(para => {
      const words = para.split(/(\s+)/);
      const spans = words.map(w => {
        const cleaned = w.replace(/[^a-zA-Z'-]/g, '');
        if (cleaned.length >= 2 && /[a-zA-Z]/.test(w)) {
          return `<span class="reading-word" data-word="${escapeHtml(cleaned.toLowerCase())}">${escapeHtml(w)}</span>`;
        }
        return escapeHtml(w);
      }).join('');
      return `<p class="mb-4 leading-loose text-lg">${spans}</p>`;
    }).join('');

    const wordCount = text.split(/\s+/).length;
    const readTime = Math.ceil(wordCount / 200);

    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:900px;margin:0 auto;">
        <div class="flex items-center justify-between mb-6">
          <button class="btn btn-ghost btn-sm" id="back-to-upload">← Back</button>
          <div class="flex gap-4 items-center">
            <span class="badge badge-accent">~${readTime} min read</span>
            <select id="band-select" class="input p-1 text-sm w-32">
              <option value="6.0">Band 6.0</option>
              <option value="7.0" selected>Band 7.0</option>
              <option value="8.0">Band 8.0+</option>
            </select>
            <button class="btn btn-primary btn-sm" id="gen-exercises-btn">✨ Generate Exercises</button>
          </div>
        </div>

        <div class="card p-8 relative">
          <div class="mb-6 pb-4 border-b text-sm text-muted flex items-center gap-2">
            <span>💡</span> Hover/Tap word for cloud-powered lookup and examples.
          </div>
          <div id="reading-content" class="reading-content">
            ${wrappedText}
          </div>
        </div>

        <div id="word-tooltip" class="word-tooltip" style="display:none;"></div>
      </div>
    `;

    document.getElementById('back-to-upload')?.addEventListener('click', renderUploadView);

    document.getElementById('gen-exercises-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('gen-exercises-btn');
      const band = document.getElementById('band-select').value;
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner-sm"></div> Generating...';
      try {
        const result = await generateExercises(text, band);
        renderExerciseView(result);
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '✨ Generate Exercises';
      }
    });

    setupTooltipSystem();
  };

  const setupTooltipSystem = () => {
    const tooltip = document.getElementById('word-tooltip');
    if (!tooltip) return;

    let currentWordEl = null;
    let hideTimeout = null;

    const showTooltip = (el, html) => {
      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      const rect = el.getBoundingClientRect();
      tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
      tooltip.style.left = `${rect.left + (rect.width / 2) - 150}px`;
    };

    document.getElementById('reading-content')?.addEventListener('mouseover', async (e) => {
      const wordEl = e.target.closest('.reading-word');
      if (!wordEl) return;
      
      // Clear hide timeout regardless of whether it's the same word or not
      if (hideTimeout) clearTimeout(hideTimeout);
      
      if (wordEl === currentWordEl) return;
      
      currentWordEl = wordEl;
      const word = wordEl.dataset.word;
      
      showTooltip(wordEl, `<div class="p-4 flex items-center gap-3"><div class="spinner"></div> Looking up...</div>`);
      
      try {
        const info = await lookupWord(word, wordEl.closest('p').textContent);
        if (currentWordEl === wordEl) showTooltip(wordEl, buildTooltipHTML(info));
      } catch (err) {
        showTooltip(wordEl, `<div class="p-4 text-red-500">Lookup failed</div>`);
      }
    });

    document.getElementById('reading-content')?.addEventListener('mouseout', () => {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => { tooltip.style.display = 'none'; currentWordEl = null; }, 500);
    });

    tooltip.addEventListener('mouseenter', () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    });
    
    tooltip.addEventListener('mouseleave', () => {
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => { tooltip.style.display = 'none'; currentWordEl = null; }, 300);
    });
  };

  function renderExerciseView() {
    // Basic placeholder for now as requested
    const readingArea = container.querySelector('.animate-fade-in-up');
    const quizHtml = `
      <div id="quiz-section" class="mt-8 pt-8 border-t-2">
        <h2 class="text-2xl font-bold mb-4">📝 IELTS Exercises</h2>
        <p class="text-muted">Exercises are generated based on the passage above.</p>
      </div>`;
    readingArea.insertAdjacentHTML('beforeend', quizHtml);
    document.getElementById('quiz-section').scrollIntoView({ behavior: 'smooth' });
  }

  await renderUploadView();
}
