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

export function renderCambridgeTest(container) {
  let isParsing = false;
  let viewState = { book: null, test: null }; // For drill-down navigation

  const renderDashboard = async () => {
    // 1. Fetch data (DB only)
    let books = [];
    try {
      books = await db.books.list();
    } catch (err) { 
      console.error(err);
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
          ${books.length === 0 ? `
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
      card.addEventListener('click', () => {
        const book = books.find(b => b.id === card.dataset.bid);
        if (book) {
          viewState.book = book;
          renderDashboard();
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
      status.textContent = 'Extracting text...';
      const text = await extractTextFromPDF(file, (p) => { if (bar) bar.style.width = `${p * 50}%`; });
      
      status.textContent = 'Analyzing with AI...';
      if (bar) bar.style.width = '75%';
      const structure = await parseTestsWithAI(text);
      
      // Save locally or remote
      saveBook(structure);
      showToast('Book added successfully!', 'success');
      renderDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      if (progress) progress.style.display = 'none';
      isParsing = false;
    }
  };

  async function parseTestsWithAI(text) {
    const apiKey = getGeminiApiKey(); 
    const sample = text.substring(0, 15000); // Sample for structure
    const prompt = `Parse this Cambridge IELTS PDF Sample: "${sample}"... Output hierarchical JSON for Book/Tests/Sections.`;
    
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
          throw new Error('AI is currently busy (rate limit reached). Please add your own Gemini API key in Settings or try again in 30 seconds.');
        }
        if (response.status === 401 || response.status === 403) {
          throw new Error('Gemini API key is invalid or missing. Please update it in Settings.');
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
        throw new Error('Failed to parse AI response. Please try uploading again. (AI returned malformed JSON)');
      }
    } catch (err) {
      console.error('Cambridge AI Parsing Error:', err);
      // Normalize network-type errors into a friendlier message
      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new Error('Network error while calling AI service. Please check your connection and try again.');
      }
      throw err;
    }
  }

  async function saveBook(book) {
    try {
      await db.books.create(book);
    } catch (err) {
      console.error('Failed to save book to DB:', err);
      showToast('Failed to save to cloud database', 'error');
    }
  }

  function getGeminiApiKey() {
    const s = JSON.parse(localStorage.getItem('lexilearn_settings') || '{}');
    return s.geminiApiKey || 'AIzaSyA-85K3L3BiJjpcu4Siu-xxQT0-dYXKBO8';
  }

  renderDashboard();
}
