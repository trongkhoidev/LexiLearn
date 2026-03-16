import { el, escapeHtml } from '../utils/helpers.js';
import { extractTextFromImage, extractTextFromPDF } from '../utils/ocr.js';
import { lookupWord, buildTooltipHTML } from '../utils/wordLookup.js';
import { generateExercises } from '../utils/exerciseGenerator.js';
import { extractPassageInsights } from '../utils/gemini.js';
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
      <div class="animate-fade-in-up" style="max-width:1200px;margin:0 auto;">
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

        <div style="display:flex;gap:var(--space-6);align-items:flex-start;">
          <div class="card p-8 relative" style="flex:2;min-width:0;">
            <div class="mb-6 pb-4 border-b text-sm text-muted flex items-center gap-2">
              <span>💡</span> Hover word for dictionary, highlight phrase for context translation.
            </div>
            <div id="reading-content" class="reading-content">
              ${wrappedText}
            </div>
          </div>
          
          <div class="card p-6 shadow-sm border-0" style="flex:1;min-width:300px;position:sticky;top:var(--space-6);background:var(--color-bg-glass);backdrop-filter:blur(8px);">
            <h3 class="font-bold flex items-center gap-2 mb-4" style="font-size:1.1rem;color:var(--color-text-primary);">
              <span>🧠</span> Passage Insights
            </h3>
            <p class="text-xs text-muted mb-4">AI-extracted collocations, idioms, and high-level vocabulary from this text.</p>
            <div id="passage-insights-container">
              <div class="flex items-center gap-3 p-4 bg-white/50 rounded-lg">
                <div class="spinner-sm"></div>
                <span class="text-sm font-medium">Extracting insights...</span>
              </div>
            </div>
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

    // Fetch Insights asynchronously
    extractPassageInsights(text).then(insights => {
      const container = document.getElementById('passage-insights-container');
      if (!container) return;

      if (!insights || insights.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-sm text-muted bg-white/50 rounded-lg">No specific insights found.</div>`;
        return;
      }

      container.innerHTML = `<div class="flex flex-col gap-3">
        ${insights.map((item, index) => `
          <div class="insight-item p-3 bg-white hover:bg-gray-50 transition-colors rounded-lg border border-gray-100 shadow-sm cursor-pointer" data-phrase="${escapeHtml(item.phrase || '')}">
            <div class="flex justify-between items-start mb-1.5">
              <strong class="text-blue-700 font-bold text-sm leading-tight">${escapeHtml(item.phrase || '')}</strong>
              <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 whitespace-nowrap ml-2">${escapeHtml(item.type || 'Vocab')}</span>
            </div>
            <div class="text-[0.9rem] font-semibold text-gray-800 mb-1 leading-snug">🇻🇳 ${escapeHtml(item.meaning_vi || '')}</div>
            <div class="text-xs text-gray-500 leading-tight">🇬🇧 ${escapeHtml(item.meaning_en || '')}</div>
          </div>
        `).join('')}
      </div>`;

      // Setup hover interactions for highlighting in the text
      const insightItems = container.querySelectorAll('.insight-item');
      insightItems.forEach(item => {
        item.addEventListener('mouseenter', () => highlightPhraseInText(item.dataset.phrase));
        item.addEventListener('mouseleave', () => removeHighlightInText());
      });

    }).catch(err => {
      const container = document.getElementById('passage-insights-container');
      if (container) container.innerHTML = `<div class="p-3 text-sm text-red-500 text-center bg-white/50 rounded-lg font-medium">Lỗi: ${escapeHtml(err.message || 'Failed to load insights')}</div>`;
    });
  };

  /**
   * Highlights a specific phrase located inside the #reading-content span structure.
   */
  const highlightPhraseInText = (phrase) => {
    if (!phrase) return;
    const contentDiv = document.getElementById('reading-content');
    if (!contentDiv) return;

    // Remove old highlights first
    removeHighlightInText();

    // Clean phrase and filter out short words (<2 chars) to match the span generation logic
    const searchWords = phrase.toLowerCase().replace(/[^a-z0-9\s'-]/g, '').trim().split(/\s+/).filter(w => w.length >= 2);
    if (searchWords.length === 0) return;

    const allSpans = Array.from(contentDiv.querySelectorAll('.reading-word'));
    if (allSpans.length === 0) return;
    
    // Find consecutive sequence of searchWords inside allSpans
    for (let i = 0; i <= allSpans.length - searchWords.length; i++) {
        let match = true;
        for (let j = 0; j < searchWords.length; j++) {
            const spanWord = (allSpans[i + j].dataset.word || '').toLowerCase();
            // Prefix matching for robustness against plurals/tenses if exact match fails
            if (spanWord !== searchWords[j] && !spanWord.startsWith(searchWords[j]) && !searchWords[j].startsWith(spanWord)) {
                match = false;
                break;
            }
        }

        if (match) {
            // Apply highlight class to all matched spans in the sequence
            for (let j = 0; j < searchWords.length; j++) {
                allSpans[i + j].classList.add('bg-yellow-200', 'text-yellow-900', 'rounded', 'px-0.5', 'insight-highlight');
                allSpans[i + j].style.transition = "all 0.3s ease";
            }
            
            // Scroll the first matched span into view smoothly if it's not visible
            const rect = allSpans[i].getBoundingClientRect();
            if (rect.top < 0 || rect.bottom > window.innerHeight) {
               allSpans[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            break; // Highlight only the first occurrence in the text
        }
    }
  };

  /**
   * Removes all temporary highlights from the reading text.
   */
  const removeHighlightInText = () => {
    const contentDiv = document.getElementById('reading-content');
    if (!contentDiv) return;
    const highlightedSpans = contentDiv.querySelectorAll('.insight-highlight');
    highlightedSpans.forEach(span => {
      span.classList.remove('bg-yellow-200', 'text-yellow-900', 'rounded', 'px-0.5', 'insight-highlight');
      span.style.transition = ""; // Reset inline transition
    });
  };

  const setupTooltipSystem = () => {
    const tooltip = document.getElementById('word-tooltip');
    if (!tooltip) return;

    let currentWordEl = null;
    let hideTimeout = null;
    let currentSelection = '';

    const showTooltip = (el, html) => {
      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      const rect = el.getBoundingClientRect();
      const left = Math.min(Math.max(0, rect.left + (rect.width / 2) - 150), window.innerWidth - 300);
      tooltip.style.top = `${rect.bottom + window.scrollY + 8}px`;
      tooltip.style.left = `${left}px`;
    };

    const showSelectionTooltip = (x, y, html) => {
      tooltip.innerHTML = html;
      tooltip.style.display = 'block';
      const left = Math.min(Math.max(0, x), window.innerWidth - 300);
      tooltip.style.top = `${y + 10}px`;
      tooltip.style.left = `${left}px`;
    };

    document.getElementById('reading-content')?.addEventListener('mouseover', async (e) => {
      if (window.getSelection().toString().trim().length > 0) return; // Don't trigger hover if texting is selected

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

    document.getElementById('reading-content')?.addEventListener('mouseout', (e) => {
      // Don't hide if moving into the tooltip
      if (e.relatedTarget && tooltip.contains(e.relatedTarget)) return;
      
      if (hideTimeout) clearTimeout(hideTimeout);
      // Only auto-hide if no text is selected
      if (window.getSelection().toString().trim().length === 0) {
        hideTimeout = setTimeout(() => { tooltip.style.display = 'none'; currentWordEl = null; }, 500);
      }
    });

    tooltip.addEventListener('mouseenter', () => {
      if (hideTimeout) clearTimeout(hideTimeout);
    });
    
    tooltip.addEventListener('mouseleave', () => {
      if (hideTimeout) clearTimeout(hideTimeout);
      if (window.getSelection().toString().trim().length === 0) {
        hideTimeout = setTimeout(() => { tooltip.style.display = 'none'; currentWordEl = null; }, 300);
      }
    });

    // Handle Text Selection for Phrases
    document.getElementById('reading-content')?.addEventListener('mouseup', async (e) => {
      // Small timeout to allow the browser to register the selection properly
      setTimeout(async () => {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        
        if (text && text.length > 2 && text !== currentSelection) {
          currentSelection = text;
          if (hideTimeout) clearTimeout(hideTimeout);
          currentWordEl = null; // Unset hover to prevent conflicts

          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const x = rect.left + (rect.width / 2) - 150 + window.scrollX;
          const y = rect.bottom + window.scrollY;

          showSelectionTooltip(x, y, `<div class="p-4 flex items-center gap-3"><div class="spinner"></div> Đang dịch cụm từ...</div>`);
          
          try {
            const info = await lookupWord(text);
            // Only update if the user hasn't changed selection
            if (window.getSelection().toString().trim() === text) {
              showSelectionTooltip(x, y, buildTooltipHTML(info));
            }
          } catch (err) {
            if (window.getSelection().toString().trim() === text) {
              showSelectionTooltip(x, y, `<div class="p-4 text-red-500">Dịch thất bại</div>`);
            }
          }
        }
      }, 50);
    });

    // Hide tooltip when clicking elsewhere
    document.addEventListener('mousedown', (e) => {
      const selection = window.getSelection().toString().trim();
      if (!tooltip.contains(e.target) && !e.target.closest('.reading-word') && selection.length === 0) {
        tooltip.style.display = 'none';
        currentSelection = '';
      }
    });
  };

  function renderExerciseView(exerciseData) {
    const readingArea = container.querySelector('.animate-fade-in-up');
    if (!readingArea) return;
    
    // Remove existing quiz section if any
    document.getElementById('quiz-section')?.remove();
    
    const questions = exerciseData?.questions || [];
    if (questions.length === 0) {
      const el = document.createElement('div');
      el.id = 'quiz-section';
      el.className = 'mt-8 pt-8';
      el.style.borderTop = '2px solid var(--color-border)';
      el.innerHTML = `<p class="text-muted text-center p-6">No questions generated. Try again.</p>`;
      readingArea.appendChild(el);
      return;
    }
    
    const userAnswers = {}; // questionId -> answer
    let submitted = false;
    
    const renderQuestions = () => {
      const mcqQuestions = questions.filter(q => q.type === 'mcq');
      const tfngQuestions = questions.filter(q => q.type === 'tfng');
      const summaryQuestions = questions.filter(q => q.type === 'summary');
      
      let html = `<div id="quiz-section" class="mt-8 pt-8" style="border-top:2px solid var(--color-border);">
        <div class="flex items-center justify-between mb-6">
          <h2 style="font-size:var(--font-size-xl);font-weight:700;">📝 IELTS Exercises</h2>
          ${exerciseData.title ? `<span class="badge badge-accent">${escapeHtml(exerciseData.title)}</span>` : ''}
        </div>`;
      
      // MCQ Section
      if (mcqQuestions.length > 0) {
        html += `<div class="card p-6 mb-6">
          <h3 style="font-weight:700;margin-bottom:var(--space-4);color:var(--color-text-primary);">Section A: Multiple Choice</h3>
          <p class="text-muted text-sm mb-5">Choose the best answer for each question.</p>`;
        mcqQuestions.forEach((q, qi) => {
          html += `<div class="mb-6 pb-5" style="border-bottom:1px solid var(--color-border);" data-qid="${q.id}">
            <p style="font-weight:600;margin-bottom:var(--space-3);">${qi + 1}. ${escapeHtml(q.text)}</p>
            <div class="flex flex-col gap-2">
              ${(q.options || []).map((opt, i) => {
                const letter = ['A', 'B', 'C', 'D'][i];
                return `<label class="mcq-option flex items-start gap-3 p-3 rounded-lg cursor-pointer" style="border:1.5px solid var(--color-border);transition:all 0.2s;" data-qid="${q.id}" data-val="${letter}">
                  <input type="radio" name="mcq-${q.id}" value="${letter}" class="mt-1 flex-shrink-0" />
                  <span><strong>${letter}.</strong> ${escapeHtml(opt)}</span>
                </label>`;
              }).join('')}
            </div>
            <div class="explanation-box hidden mt-3 p-3 rounded-lg" id="exp-${q.id}" style="background:#f0fdf4;border:1px solid #bbf7d0;"></div>
          </div>`;
        });
        html += `</div>`;
      }
      
      // TFNG Section
      if (tfngQuestions.length > 0) {
        html += `<div class="card p-6 mb-6">
          <h3 style="font-weight:700;margin-bottom:var(--space-4);">Section B: True / False / Not Given</h3>
          <p class="text-muted text-sm mb-5">Based on the passage, decide if each statement is TRUE, FALSE, or NOT GIVEN.</p>`;
        tfngQuestions.forEach((q, qi) => {
          html += `<div class="mb-5 pb-4" style="border-bottom:1px solid var(--color-border);" data-qid="${q.id}">
            <p style="font-weight:600;margin-bottom:var(--space-3);">${mcqQuestions.length + qi + 1}. ${escapeHtml(q.text)}</p>
            <div class="flex gap-3 flex-wrap">
              ${['TRUE', 'FALSE', 'NOT GIVEN'].map(val => `
                <button class="tfng-btn btn btn-secondary btn-sm" data-qid="${q.id}" data-val="${val}" 
                  style="min-width:100px;">${val}</button>
              `).join('')}
            </div>
            <div class="explanation-box hidden mt-3 p-3 rounded-lg" id="exp-${q.id}" style="background:#f0fdf4;border:1px solid #bbf7d0;"></div>
          </div>`;
        });
        html += `</div>`;
      }
      
      // Summary Section
      if (summaryQuestions.length > 0) {
        summaryQuestions.forEach(q => {
          const gapText = (q.text || '').replace(/\[GAP\]/g, () => {
            const gapId = (q.gaps || []).length > 0 ? q.gaps.shift()?.id : 'x';
            return `<input type="text" class="summary-gap" data-qid="${q.id}" data-gid="${gapId}" 
              placeholder="..." style="border:none;border-bottom:2px solid var(--color-border);
              width:120px;background:transparent;font-size:inherit;padding:2px 4px;outline:none;" />`;
          });
          // Reset gaps for scoring
          html += `<div class="card p-6 mb-6">
            <h3 style="font-weight:700;margin-bottom:var(--space-4);">Section C: Summary Completion</h3>
            <p class="text-muted text-sm mb-4">Complete the summary using words from the passage. Write ONE word for each gap.</p>
            <div class="leading-loose text-lg" style="line-height:2.2;">${gapText}</div>
            <div class="explanation-box hidden mt-3 p-3 rounded-lg" id="exp-${q.id}" style="background:#f0fdf4;border:1px solid #bbf7d0;"></div>
          </div>`;
        });
      }
      
      html += `<div class="flex justify-center mt-6 mb-4">
        <button id="submit-quiz-btn" class="btn btn-primary" style="min-width:200px;font-size:1rem;padding:0.75rem 2rem;">
          ✅ Submit Answers
        </button>
      </div>
      <div id="quiz-score" class="hidden text-center mt-4 p-6 card" style="background:var(--color-bg-glass);"></div>
      </div>`;
      
      readingArea.insertAdjacentHTML('beforeend', html);
      document.getElementById('quiz-section')?.scrollIntoView({ behavior: 'smooth' });
      
      // MCQ option hover/select
      document.querySelectorAll('.mcq-option').forEach(label => {
        label.addEventListener('click', () => {
          if (submitted) return;
          const qid = label.dataset.qid;
          const val = label.dataset.val;
          userAnswers[qid] = val;
          document.querySelectorAll(`.mcq-option[data-qid="${qid}"]`).forEach(l => {
            l.style.borderColor = 'var(--color-border)';
            l.style.background = '';
          });
          label.style.borderColor = 'var(--color-accent)';
          label.style.background = 'var(--color-bg-glass)';
        });
      });
      
      // TFNG buttons
      document.querySelectorAll('.tfng-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (submitted) return;
          const qid = btn.dataset.qid;
          const val = btn.dataset.val;
          userAnswers[qid] = val;
          document.querySelectorAll(`.tfng-btn[data-qid="${qid}"]`).forEach(b => {
            b.classList.remove('btn-primary');
            b.classList.add('btn-secondary');
          });
          btn.classList.remove('btn-secondary');
          btn.classList.add('btn-primary');
        });
      });
      
      // Submit
      document.getElementById('submit-quiz-btn')?.addEventListener('click', () => {
        submitted = true;
        let correct = 0, total = 0;
        
        // Score MCQ & TFNG
        [...mcqQuestions, ...tfngQuestions].forEach(q => {
          const answer = userAnswers[q.id];
          const isCorrect = answer?.toUpperCase() === q.answer?.toUpperCase();
          total++;
          if (isCorrect) correct++;
          const expEl = document.getElementById(`exp-${q.id}`);
          if (expEl) {
            expEl.classList.remove('hidden');
            expEl.style.background = isCorrect ? '#f0fdf4' : '#fef2f2';
            expEl.style.borderColor = isCorrect ? '#bbf7d0' : '#fecaca';
            expEl.innerHTML = `<strong>${isCorrect ? '✅ Correct!' : `❌ Answer: ${escapeHtml(q.answer)}`}</strong>${q.explanation ? ` — ${escapeHtml(q.explanation)}` : ''}`;
          }
        });
        
        // Score Summary gaps
        const gapInputs = document.querySelectorAll('.summary-gap');
        gapInputs.forEach(input => { input.disabled = true; });
        
        const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
        const scoreEl = document.getElementById('quiz-score');
        if (scoreEl) {
          scoreEl.classList.remove('hidden');
          const emoji = percent >= 80 ? '🎉' : percent >= 60 ? '👍' : '📚';
          scoreEl.innerHTML = `
            <div style="font-size:3rem;">${emoji}</div>
            <div style="font-size:1.5rem;font-weight:700;margin:0.5rem 0;">${correct}/${total} — ${percent}%</div>
            <p class="text-muted">${percent >= 80 ? 'Excellent! Great understanding of the passage.' : percent >= 60 ? 'Good effort! Review the explanations above.' : 'Keep practicing! Read the explanations carefully.'}</p>
          `;
          scoreEl.scrollIntoView({ behavior: 'smooth' });
        }
        
        const submitBtn = document.getElementById('submit-quiz-btn');
        if (submitBtn) submitBtn.style.display = 'none';
      });
    };
    
    renderQuestions();
  }


  await renderUploadView();
}
