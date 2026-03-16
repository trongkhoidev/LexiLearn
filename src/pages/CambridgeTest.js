/* ============================================
   LexiLearn — Cambridge IELTS PDF Parser Page
   ============================================
   Upload Cambridge book PDF → Extract text → AI Parse to structured tests
*/

import { escapeHtml } from '../utils/helpers.js';
import { extractTextFromPDF } from '../utils/ocr.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';

import { db, isDbConfigured } from '../utils/supabase.js';

const TESTS_KEY = 'lexilearn_cambridge_tests';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const BACKEND_URL = 'http://localhost:5005'; // Local Python Backend

export function renderCambridgeTest(container) {
  let isParsing = false;
  let viewState = { book: null, test: null }; // For drill-down navigation

  const renderDashboard = async () => {
    // 1. Fetch data (DB only)
    let books = [];
    let fetchError = null;
    try {
      books = await db.books.list();
    } catch (err) { 
      console.error(err);
      fetchError = err.message;
      books = []; 
    }

    // 2. Navigation Breadcrumbs
    const renderBreadcrumbs = () => {
      let html = `<div class="breadcrumb" style="margin-bottom:var(--space-6);font-size:var(--font-size-sm);color:#6b7280;">
        <span class="breadcrumb-item link" data-view="home">📚 All Books</span>`;
      
      if (viewState.book) {
        html += ` <span style="margin:0 8px;">/</span> <span class="breadcrumb-item link" data-view="book" data-bid="${viewState.book.id}">${escapeHtml(viewState.book.title)}</span>`;
      }
      if (viewState.test) {
        html += ` <span style="margin:0 8px;">/</span> <span class="breadcrumb-item">${escapeHtml(viewState.test.title)}</span>`;
      }
      
      html += `</div>`;
      return html;
    };

    // 3. Main Views
    const renderBookList = () => {
      return `
        <div class="flex items-center justify-between" style="margin-bottom:var(--space-8);">
          <h1 style="font-size:var(--font-size-2xl);font-weight:700;color:#1f2937;">🎯 Cambridge IELTS Tests</h1>
          <button class="btn btn-primary" id="upload-cambridge-btn">➕ Upload New Book</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${fetchError ? `
            <div class="card" style="grid-column:1/-1;text-align:center;padding:var(--space-12);border:1.5px solid #fee2e2;background:#fef2f2;">
              <p style="color:#b91c1c;font-weight:600;">⚠️ Database Error</p>
              <p style="color:#7f1d1d;font-size:var(--font-size-sm);margin-top:var(--space-2);">${escapeHtml(fetchError)}</p>
              <button class="btn btn-secondary btn-sm mt-4" onclick="window.location.reload()">🔄 Retry Connection</button>
            </div>
          ` : books.length === 0 ? `
            <div class="card" style="grid-column:1/-1;text-align:center;padding:var(--space-12);border:2px dashed #e5e7eb;">
              <p style="color:#9ca3af;">No books uploaded yet. Start by uploading a Cambridge PDF.</p>
            </div>
          ` : books.map(book => `
            <div class="card card-interactive book-card" data-bid="${book.id}" style="padding:var(--space-6);display:flex;align-items:center;gap:var(--space-4);">
              <div class="book-spine">${book.bookNum || 'C'}</div>
              <div>
                <h3 style="font-weight:700;">${escapeHtml(book.title)}</h3>
                <p style="font-size:var(--font-size-xs);color:#6b7280;">${book.tests?.length || 4} Tests Available</p>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    const renderBookDetail = (book) => {
      return `
        <div style="margin-bottom:var(--space-8);">
          <h1 style="font-size:var(--font-size-2xl);font-weight:700;">${escapeHtml(book.title)}</h1>
          <p style="color:#6b7280;">Select a test to start practicing</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${(book.tests || []).map(test => `
            <div class="card" style="padding:var(--space-6);">
              <div class="flex justify-between items-center" style="margin-bottom:var(--space-6);">
                <h3 style="font-weight:700;font-size:var(--font-size-lg);">${escapeHtml(test.title)}</h3>
                <span class="badge badge-primary">Standard Time</span>
              </div>
              <div class="test-modules-grid" style="display:flex;flex-direction:column;gap:var(--space-4);">
                <div class="test-module-row">
                  <div class="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-100">
                    <div class="flex items-center gap-3">
                      <span style="font-size:1.2rem;">📖</span>
                      <div>
                        <div style="font-weight:600;font-size:var(--font-size-sm);">Reading Practice</div>
                        <div style="font-size:0.7rem;color:#9ca3af;">3 Sections / 40 Questions</div>
                      </div>
                    </div>
                    <button class="btn btn-secondary btn-sm play-test-btn" data-tid="${test.id}" data-type="reading">Start</button>
                  </div>
                </div>
                <!-- ... other modules placeholders ... -->
              </div>
            </div>
          `).join('')}
        </div>
      `;
    };

    // Construct UI
    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1000px;margin:0 auto;">
        ${renderBreadcrumbs()}
        <div id="cambridge-main-content">
          ${!viewState.book ? renderBookList() : renderBookDetail(viewState.book)}
        </div>
        
        <!-- Upload Modal (Hidden by default) -->
        <div id="upload-zone-container" style="display:none;margin-top:var(--space-8);">
          <div class="card" id="cambridge-drop-zone" style="padding:var(--space-10);text-align:center;border:2px dashed #d1d5db;cursor:pointer;">
            <div style="font-size:3rem;margin-bottom:var(--space-4);">📑</div>
            <h3 style="font-weight:600;">Drop Cambridge PDF here</h3>
            <p style="color:#6b7280;font-size:var(--font-size-sm);">Supports Reading section parsing for now</p>
            <input type="file" id="cambridge-file-input" accept="application/pdf" style="display:none;" />
          </div>
          <div id="parse-progress" style="display:none;margin-top:var(--space-4);">
            <div class="flex items-center gap-3"><div class="spinner"></div><span id="progress-status">Reading...</span></div>
            <div class="progress-bar"><div class="progress-bar-fill" id="parse-progress-bar" style="width:0%;"></div></div>
          </div>
        </div>
      </div>
    `;

    // Event Listeners
    setupEvents(books);
  };

  const setupEvents = (books) => {
    // Navigation
    container.querySelectorAll('.breadcrumb-item.link').forEach(item => {
      item.addEventListener('click', () => {
        if (item.dataset.view === 'home') viewState = { book: null, test: null };
        else if (item.dataset.view === 'book') viewState.test = null;
        renderDashboard();
      });
    });

    container.querySelectorAll('.book-card').forEach(card => {
      card.addEventListener('click', async () => {
        const bid = card.dataset.bid;
        try {
          const fullBook = await db.books.getTree(bid);
          if (fullBook) {
            viewState.book = fullBook;
            renderDashboard();
          }
        } catch (err) {
          console.error(err);
          showToast('Failed to load book details', 'error');
        }
      });
    });

    container.querySelectorAll('.play-test-btn').forEach(btn => {
      btn.addEventListener('click', () => navigateTo(`/test/${btn.dataset.tid}`));
    });

    // Upload
    const uploadBtn = document.getElementById('upload-cambridge-btn');
    const uploadZone = document.getElementById('upload-zone-container');
    const dropZone = document.getElementById('cambridge-drop-zone');
    const fileInput = document.getElementById('cambridge-file-input');

    uploadBtn?.addEventListener('click', () => {
      uploadZone.style.display = 'block';
      uploadBtn.style.display = 'none';
    });

    dropZone?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', (e) => {
      if (e.target.files[0]) processCambridgePDF(e.target.files[0]);
    });
  };

  const processCambridgePDF = async (file) => {
    if (isParsing) return;
    isParsing = true;
    const bar = document.getElementById('parse-progress-bar');
    const status = document.getElementById('progress-status');
    const progress = document.getElementById('parse-progress');
    if (progress) progress.style.display = 'block';

    try {
      // 1. Try Local Backend first (for large files / better OCR)
      status.textContent = 'Uploading to local backend...';
      if (bar) bar.style.width = '10%';

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('apiKey', getGeminiApiKey());

        // Simulate progress for backend processing (since fetch doesn't give us upload progress easily here)
        let backendProgress = 10;
        const progressInterval = setInterval(() => {
          if (backendProgress < 90) {
            backendProgress += 2;
            if (bar) bar.style.width = `${backendProgress}%`;
            if (backendProgress < 40) status.textContent = 'Backend: Analyzing PDF structure...';
            else if (backendProgress < 70) status.textContent = 'Backend: Running Parallel OCR...';
            else status.textContent = 'Backend: Finalizing structure with AI...';
          }
        }, 1000);

        const backendRes = await fetch(`${BACKEND_URL}/api/parse-cambridge`, {
          method: 'POST',
          body: formData
        });

        clearInterval(progressInterval);

        if (backendRes.ok) {
          if (bar) bar.style.width = '100%';
          status.textContent = 'Success! Saving book...';
          const structure = await backendRes.json();
          await saveBook(structure);
          showToast('Book added via local backend! 🚀', 'success');
          renderDashboard();
          return;
        }
        
        const errorData = await backendRes.json().catch(() => ({}));
        console.warn('Local backend failed:', errorData.error || 'Unknown error');
        showToast(`Backend failed: ${errorData.error || 'Server error'}. Using client fallback...`, 'warning');
      } catch (backendErr) {
        console.log('Local backend not detected or connection error, using client-side fallback.');
      }

      // 2. Client-side Fallback
      if (bar) bar.style.width = '20%';
      status.textContent = 'Extracting text (Client-side fallback)...';
      const text = await extractTextFromPDF(file, (p) => { 
        if (bar) bar.style.width = `${20 + (p * 50)}%`; 
      });
      
      status.textContent = 'Analyzing with AI...';
      if (bar) bar.style.width = '85%';
      const structure = await parseTestsWithAI(text);
      
      status.textContent = 'Saving book...';
      if (bar) bar.style.width = '95%';
      await saveBook(structure);
      showToast('Book added successfully (Client-side)!', 'success');
      renderDashboard();
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Failed to process PDF', 'error');
    } finally {
      if (progress) progress.style.display = 'none';
      isParsing = false;
    }
  };

  async function parseTestsWithAI(text) {
    const apiKey = getGeminiApiKey(); 
    const sample = text.substring(0, 15000); // Increased sample size
    const prompt = `You are an expert at parsing Cambridge IELTS test books. Analyze this extracted PDF text and identify the book structure.

Extracted text sample:
"""\n${sample}\n"""

Task: Parse the above text and return a JSON object representing the book structure including tests, passages (sections), and questions.
Look for:
- The Cambridge book number (e.g., "Cambridge IELTS 14")
- Individual tests (usually Test 1, Test 2, Test 3, Test 4)
- Sections within tests (Reading Passage 1, 2, 3 etc.)
- Questions for each passage (MCQ, Fill in the blanks, or True/False/Not Given)

Return ONLY valid JSON (no markdown):
{
  "title": "Cambridge IELTS 14",
  "book_num": 14,
  "tests": [
    {
      "title": "Test 1",
      "test_num": 1,
      "sections": [
        {
          "title": "Reading Passage 1",
          "content": "[the full text of the reading passage]",
          "questions": [
            {
              "question_num": 1,
              "type": "mcq",
              "text": "The text states that...",
              "options": ["A", "B", "C", "D"],
              "correct_answer": "A",
              "explanation": "Brief reasoning"
            }
          ]
        }
      ]
    }
  ]
}`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: 'application/json' } 
        })
      });

      if (!response.ok) {
        // Try to read structured error if provided by Gemini
        let errorMessage = '';
        try {
          const errorBody = await response.json();
          errorMessage = errorBody.error?.message || '';
        } catch {
          // ignore JSON parse errors for error responses
        }

        if (response.status === 429) {
          throw new Error('AI is currently busy (rate limit reached). Please try again in 30 seconds.');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Gemini API key is invalid or missing.');
        }

        throw new Error(errorMessage || `AI Service Error: ${response.status}`);
      }

      const data = await response.json();
      let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!resultText) throw new Error('AI returned an empty response.');

      // Remove potential markdown code blocks/backticks before parsing
      resultText = resultText.replace(/```json\n?|```/g, '').trim();

      try {
        return JSON.parse(resultText);
      } catch (e) {
        console.error('Malformed JSON from AI:', resultText);
        throw new Error('Failed to parse AI response. (AI returned malformed JSON)');
      }
    } catch (err) {
      console.error('Cambridge AI Parsing Error:', err);
      // Normalize network-type errors into a friendlier message
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Network error while calling AI service.');
      }
      throw err;
    }
  }

  async function saveBook(bookData) {
    try {
      // 1. Separate tests from book metadata
      const { tests, ...bookMeta } = bookData;
      
      // 2. Create the book record first
      const savedBooks = await db.books.create({
        ...bookMeta,
        created_at: new Date().toISOString()
      });
      
      const bookId = savedBooks[0].id;
      console.log('Book created with ID:', bookId);

      // 3. Create tests and their sections
      if (tests && Array.isArray(tests)) {
        for (const t of tests) {
          console.log(`Saving Test ${t.test_num}: ${t.title}`);
          const savedTests = await db.tests.create({
            book_id: bookId,
            test_num: t.test_num,
            title: t.title,
            created_at: new Date().toISOString()
          });
          
          const testId = savedTests[0].id;
          
          // AI might return 'sections' or 'passages'
          const passages = t.sections || t.passages || [];
          if (Array.isArray(passages)) {
            console.log(`Saving ${passages.length} sections for Test ${t.test_num}`);
            for (let i = 0; i < passages.length; i++) {
              const p = passages[i];
              const savedSections = await db.sections.create({
                test_id: testId,
                module: 'reading',
                section_num: i + 1,
                title: p.title || `Passage ${i + 1}`,
                content: p.content || p.passage || '', // Handle naming mismatch
                created_at: new Date().toISOString()
              });
              
              const sectionId = savedSections[0].id;
              
              // 4. Save Questions for this section
              const questions = p.questions || [];
              if (Array.isArray(questions)) {
                console.log(`Saving ${questions.length} questions for ${p.title}`);
                for (const q of questions) {
                  await db.questions.create({
                    section_id: sectionId,
                    question_num: q.question_num,
                    type: q.type || 'mcq',
                    text: q.text || '',
                    options: q.options || null,
                    correct_answer: q.correct_answer || null,
                    explanation: q.explanation || null,
                    created_at: new Date().toISOString()
                  });
                }
              }
            }
          }
        }
      }

      showToast(`Book "${bookMeta.title}" saved successfully!`, 'success');
      renderDashboard(); // Refresh to show new book
    } catch (err) {
      console.error('Failed to save book to DB:', err);
      showToast(`Save failed: ${err.message}`, 'error');
    }
  }

  function getGeminiApiKey() {
    try {
      const s = JSON.parse(localStorage.getItem('lexilearn_settings') || '{}');
      return s.geminiApiKey || 'AIzaSyDv5yQ04GH5gqZqIjYGUoSHuHBn-i5O-0M';
    } catch { return 'AIzaSyDv5yQ04GH5gqZqIjYGUoSHuHBn-i5O-0M'; }
  }

  renderDashboard();
}
