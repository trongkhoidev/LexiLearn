import { ieltsService as db } from '../services/ielts.service';
import { extractTextFromPDF, extractTextFromImage } from '../utils/ocr';
import { showToast } from '../components/Toast';
import { SUPABASE_URL, supabaseUpload } from '../core/db.js';

export function renderCambridgeTest(container) {
  let books = [];
  let lastExtractedText = '';
  let lastParsedJson = null;

  const state = {
    stage: 'skills', // skills -> subpart -> formats -> editor
    skill: null,
    subpart: null,
    book_num: 18,
    band_level: '7.0-8.0',
    title: '',
    selected_formats: [],
    structure: { sections: [] },
    content: '',
    answers: {},
    questions: {},
    meta: {
      media: {
        // listening audio stored here after upload
        // audio: { url, name, mime, size, duration_seconds }
      }
    }
  };

  const SKILL_THEME = {
    reading: { accent: '#2563eb', bg: 'rgba(37, 99, 235, 0.08)' },    // blue
    listening: { accent: '#7c3aed', bg: 'rgba(124, 58, 237, 0.08)' }, // purple
    speaking: { accent: '#059669', bg: 'rgba(5, 150, 105, 0.08)' },   // emerald
    writing: { accent: '#d97706', bg: 'rgba(217, 119, 6, 0.10)' }     // amber
  };

  const SKILL_CONFIG = {
    reading: {
      icon: '📖',
      title: 'Reading',
      desc: 'Upload & build Passage 1/2/3 with full Q&A',
      subparts: ['Passage 1', 'Passage 2', 'Passage 3'],
      formats: [
        { id: 'heading_match', label: 'Matching Headings', example: 'Example: Choose the correct heading for each paragraph (i–vii).' },
        { id: 'info_match', label: 'Matching Information / Features', example: 'Example: Match statements to paragraphs (A–G).' },
        { id: 'mcq', label: 'Multiple Choice', example: 'Example: Choose ONE correct answer (A, B, C or D).' },
        { id: 'tfng', label: 'True / False / Not Given', example: 'Example: Decide if statements are TRUE / FALSE / NOT GIVEN.' },
        { id: 'summary_completion', label: 'Summary / Note / Table / Flow-chart Completion', example: 'Example: Fill gaps in a summary with NO MORE THAN TWO WORDS.' },
        { id: 'sentence_completion', label: 'Sentence Completion', example: 'Example: Complete each sentence with ONE WORD from the passage.' },
        { id: 'short_answer', label: 'Short Answer Questions', example: 'Example: Answer the questions with NO MORE THAN THREE WORDS.' },
        { id: 'diagram_label', label: 'Diagram Label Completion', example: 'Example: Label a diagram using words from the passage.' }
      ]
    },
    listening: {
      icon: '🎧',
      title: 'Listening',
      desc: 'Upload audio + build Sections 1–4 with Q&A',
      subparts: ['Section 1', 'Section 2', 'Section 3', 'Section 4'],
      formats: [
        { id: 'form_completion', label: 'Form / Note / Table / Flow-chart Completion', example: 'Example: Complete notes using NO MORE THAN TWO WORDS AND/OR A NUMBER.' },
        { id: 'mcq', label: 'Multiple Choice', example: 'Example: Choose the correct answer (A, B or C).' },
        { id: 'matching', label: 'Matching', example: 'Example: Match people to places (A–H).' },
        { id: 'map_labelling', label: 'Map / Plan / Diagram Labeling', example: 'Example: Label locations on a map using a word list.' }
      ]
    },
    speaking: {
      icon: '💬',
      title: 'Speaking',
      desc: 'Part 1/2/3 prompts + cue card builder',
      subparts: ['Part 1', 'Part 2', 'Part 3'],
      formats: [
        { id: 'open_ended', label: 'Open Ended', example: 'Example: “Do you enjoy reading books? Why / why not?”' },
        { id: 'speaking_cue_card', label: 'Cue Card', example: 'Example: Topic + bullet prompts + follow-up questions.' }
      ]
    },
    writing: {
      icon: '✍️',
      title: 'Writing',
      desc: 'Task 1/2 prompt + sample answer builder',
      subparts: ['Task 1', 'Task 2'],
      formats: [
        { id: 'essay', label: 'Essay', example: 'Example: Discuss both views and give your opinion.' },
        { id: 'graph_report', label: 'Graph Report', example: 'Example: Describe trends in a chart/graph (≥150 words).' },
        { id: 'letter', label: 'Letter', example: 'Example: Formal / semi-formal / informal letter prompt.' }
      ]
    }
  };

  const FORMAT_LABELS = Object.fromEntries(
    Object.values(SKILL_CONFIG)
      .flatMap(s => s.formats)
      .map(f => [f.id, f.label])
  );

  const escapeAttr = (text) => escapeHtml(text).replace(/"/g, '&quot;');

  const getAccent = () => SKILL_THEME[state.skill]?.accent || '#0f172a';
  const getAccentBg = () => SKILL_THEME[state.skill]?.bg || 'rgba(15, 23, 42, 0.06)';

  const sanitizeFileName = (name = 'file') =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120) || 'file';

  const getPublicObjectUrl = (bucket, path) => `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;

  const getAudioDurationSeconds = (file) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const a = new Audio();
      const cleanup = () => URL.revokeObjectURL(url);
      a.preload = 'metadata';
      a.src = url;
      a.addEventListener('loadedmetadata', () => {
        const d = Number.isFinite(a.duration) ? a.duration : 0;
        cleanup();
        resolve(d);
      });
      a.addEventListener('error', () => {
        cleanup();
        reject(new Error('Could not read audio metadata'));
      });
    });

  const uploadListeningAudio = async (file) => {
    const bucket = 'exam-pdfs'; // existing public bucket used elsewhere
    const safe = sanitizeFileName(file.name || 'listening-audio');
    const path = `cambridge/listening/${state.book_num}/${Date.now()}_${safe}`;
    await supabaseUpload(bucket, path, file);
    return { bucket, path, url: getPublicObjectUrl(bucket, path) };
  };

  const uploadReadingPdf = async (file) => {
    const bucket = 'exam-pdfs';
    const safe = sanitizeFileName(file.name || 'reading-passage');
    const path = `cambridge/reading/${state.book_num}/${Date.now()}_${safe}.pdf`;
    await supabaseUpload(bucket, path, file);
    return { bucket, path, url: getPublicObjectUrl(bucket, path) };
  };

  const resetForSkill = (skill) => {
    state.stage = 'subpart';
    state.skill = skill;
    state.subpart = null;
    state.book_num = 18;
    state.band_level = '7.0-8.0';
    state.title = '';
    state.selected_formats = [];
    state.structure = { sections: [] };
    state.content = '';
    state.answers = {};
    state.questions = {};
    state.meta = { media: {} };
  };

  const buildDefaultStructureFromFormats = () => {
    // Single section for reading; 4 sections for listening (fixed). Others will be handled later.
    if (!state.skill) return;
    const selected = state.selected_formats.slice();
    if (selected.length === 0) return;

    const makeBlocks = (startIndex) => {
      let q = startIndex;
      return selected.map((fmt) => {
        const start = q;
        const end = q + 4; // default 5 questions per format block, editable later
        q = end + 1;
        return { question_start: start, question_end: end, type: fmt };
      });
    };

    if (state.skill === 'reading') {
      state.structure = {
        sections: [{ title: state.subpart || 'Passage', question_blocks: makeBlocks(1) }]
      };
      return;
    }

    if (state.skill === 'listening') {
      // Always 4 sections; selected formats apply to the currently selected section later in editor.
      state.structure = {
        sections: [1, 2, 3, 4].map((n) => ({
          title: `Section ${n}`,
          question_blocks: makeBlocks(1 + (n - 1) * 10)
        }))
      };
      return;
    }

    state.structure = { sections: [{ title: state.subpart || 'Content', question_blocks: makeBlocks(1) }] };
  };

  const renderDashboard = async () => {
    if (books.length === 0) {
      books = await db.books.list();
    }

    // Custom CSS for Premium Dashboard
    if (!document.getElementById('cambridge-premium-style')) {
      const style = document.createElement('style');
      style.id = 'cambridge-premium-style';
      style.textContent = `
        .dark-mode-passage {
          background: #1e293b !important;
          color: #f8fafc !important;
        }
        .cam-skill-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 24px;
          max-width: 1100px;
          margin: 0 auto;
          padding-top: 12px;
        }
        @media (min-width: 768px) {
          .cam-skill-grid {
            grid-template-columns: 1fr 1fr;
            gap: 32px;
          }
        }
        .cam-skill-tag {
          background: #ffffff;
          border: 2px solid rgba(2, 6, 23, 0.15);
          border-radius: 20px;
          transition: transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms ease, border-color 200ms ease, background 200ms ease;
          min-height: 220px;
          display: grid;
          place-items: center;
          text-align: center;
          padding: 40px 28px;
          cursor: pointer;
        }
        .cam-skill-tag .cam-skill-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: grid;
          place-items: center;
          font-size: 32px;
          font-weight: 900;
          margin: 0 auto 20px;
          transition: transform 200ms ease;
        }
        .cam-skill-tag[data-skill="reading"] { border-color: rgba(37, 99, 235, 0.3); }
        .cam-skill-tag[data-skill="listening"] { border-color: rgba(124, 58, 237, 0.3); }
        .cam-skill-tag[data-skill="speaking"] { border-color: rgba(5, 150, 105, 0.3); }
        .cam-skill-tag[data-skill="writing"] { border-color: rgba(217, 119, 6, 0.3); }
        
        .cam-skill-tag[data-skill="reading"] .cam-skill-icon { background: rgba(37, 99, 235, 0.12); color: #2563eb; }
        .cam-skill-tag[data-skill="listening"] .cam-skill-icon { background: rgba(124, 58, 237, 0.12); color: #7c3aed; }
        .cam-skill-tag[data-skill="speaking"] .cam-skill-icon { background: rgba(5, 150, 105, 0.12); color: #059669; }
        .cam-skill-tag[data-skill="writing"] .cam-skill-icon { background: rgba(217, 119, 6, 0.12); color: #d97706; }
        
        .cam-skill-tag[data-skill="reading"]:hover { border-color: #2563eb; box-shadow: 0 16px 40px -12px rgba(37, 99, 235, 0.25); }
        .cam-skill-tag[data-skill="listening"]:hover { border-color: #7c3aed; box-shadow: 0 16px 40px -12px rgba(124, 58, 237, 0.25); }
        .cam-skill-tag[data-skill="speaking"]:hover { border-color: #059669; box-shadow: 0 16px 40px -12px rgba(5, 150, 105, 0.25); }
        .cam-skill-tag[data-skill="writing"]:hover { border-color: #d97706; box-shadow: 0 16px 40px -12px rgba(217, 119, 6, 0.25); }
        
        .cam-skill-tag:focus-visible {
          outline: none;
          ring: 3px;
          ring-color: currentColor;
        }
        .cam-skill-tag:hover {
          transform: translateY(-4px);
        }
        .cam-skill-tag:active {
          transform: translateY(-2px);
        }
        .cam-skill-title {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.015em;
          color: #0f172a;
          line-height: 1.2;
        }
        .cam-skill-subtitle {
          margin-top: 12px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #64748b;
        }
        .cam-tag-chip {
          border: 1.5px solid #cbd5e1;
          background: #f1f5f9;
          border-radius: 12px;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #475569;
          white-space: nowrap;
          transition: all 160ms ease;
        }
        .cam-tag-chip:hover {
          border-color: #94a3b8;
          background: #e2e8f0;
        }
        .cam-step-pill {
          border-radius: 12px;
          padding: 10px 16px;
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          border: 1.5px solid #e2e8f0;
          color: #64748b;
          background: white;
          transition: all 160ms ease;
          cursor: pointer;
        }
        .cam-step-pill:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }
        .cam-step-pill.active {
          background: #0f172a;
          color: #ffffff;
          border-color: #0f172a;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);
        }
        .cam-format-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 900px) {
          .cam-format-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }
        }
        .cam-format-tile {
          border-radius: 16px;
          border: 2px solid #e2e8f0;
          background: #ffffff;
          padding: 24px;
          min-height: 180px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
        }
        .cam-format-tile:hover {
          border-color: #cbd5e1;
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
          transform: translateY(-3px);
          background: #f8fafc;
        }
        .cam-format-tile.selected {
          border-color: #0f172a;
          background: #0f172a;
          color: #e5e7eb;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.2);
          transform: translateY(-2px);
        }
        .cam-format-tile.selected .cam-format-title {
          color: #ffffff;
        }
        .cam-format-title {
          font-size: 18px;
          font-weight: 900;
          text-align: center;
          letter-spacing: -0.01em;
          color: #0f172a;
          line-height: 1.2;
        }
        .cam-format-meta {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          text-align: center;
          font-weight: 700;
          color: #94a3b8;
          margin-top: 4px;
        }
        .cam-format-tile.selected .cam-format-meta {
          color: #cbd5e1;
        }
        .cam-format-example {
          font-size: 13px;
          line-height: 1.6;
          text-align: center;
          color: #64748b;
          max-width: 36rem;
          margin: 0 auto 0;
        }
        .cam-format-tile.selected .cam-format-example {
          color: #cbd5e1;
        }
      `;
      document.head.appendChild(style);
    }

    container.innerHTML = `
      <div class="p-8 max-w-7xl mx-auto space-y-10 min-h-screen bg-slate-50/50">
        <!-- Dashboard Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 class="text-4xl font-black text-slate-900 tracking-tight mb-2">Cambridge Library</h1>
            <p class="text-slate-500 font-medium">Choose a skill to upload and build a Cambridge-style test.</p>
          </div>
        </div>

        <!-- Dashboard Content -->
        <div id="library-main-content">
          ${renderLibraryContent()}
        </div>
      </div>
    `;

    setupEvents();
  };

  const renderLibraryContent = () => {
    const steps = [
      { id: 'skills', label: 'Skill' },
      { id: 'subpart', label: 'Part' },
      { id: 'formats', label: 'Format' },
      { id: 'editor', label: 'Upload & Preview' }
    ];

    const stepBar = `
      <div class="flex flex-wrap gap-2 items-center">
        ${steps.map(s => `<span class="cam-step-pill ${state.stage === s.id ? 'active' : ''}">${s.label}</span>`).join('')}
        ${state.skill ? `<span class="cam-tag-chip ml-2">${SKILL_CONFIG[state.skill].title}</span>` : ''}
        ${state.subpart ? `<span class="cam-tag-chip">${escapeHtml(state.subpart)}</span>` : ''}
      </div>
    `;

    if (state.stage === 'skills') {
      const skills = ['reading', 'listening', 'speaking', 'writing'];
      return `
        <div class="space-y-8">
          ${stepBar}
          <div class="cam-skill-grid">
            ${skills.map((id) => {
              const s = SKILL_CONFIG[id];
              return `
                <button class="cam-skill-tag" data-skill-tag="${id}" data-skill="${id}">
                  <div>
                    <div class="cam-skill-icon">${escapeHtml(s.icon)}</div>
                    <div class="cam-skill-title">${escapeHtml(s.title)}</div>
                    <div class="cam-skill-subtitle">Choose</div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    if (state.stage === 'subpart') {
      const skill = SKILL_CONFIG[state.skill];
      return `
        <div class="space-y-8">
          <div class="flex items-center justify-between">
            ${stepBar}
            <button class="btn btn-ghost font-bold text-slate-500" id="cam-back-to-skills">← Back</button>
          </div>

          <div class="bg-white rounded-[28px] border border-slate-100 shadow-sm p-10" style="border-top: 6px solid ${getAccent()};">
            <div class="flex items-center justify-between gap-6 flex-wrap">
              <div>
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Choose Part</div>
                <div class="text-2xl font-black text-slate-900 mt-2">${skill.title}: pick the part you want to upload</div>
              </div>
              <div class="flex gap-3 items-center">
                <div>
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Book</div>
                  <select id="cam-book-num" class="input bg-slate-50 border-none rounded-xl font-black">
                    ${[18,17,16,15,14,13,12,11,10].map(n => `<option value="${n}" ${state.book_num === n ? 'selected' : ''}>Cambridge ${n}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Band</div>
                  <select id="cam-band" class="input bg-slate-50 border-none rounded-xl font-black">
                    ${['5.0-6.0','6.0-7.0','7.0-8.0','8.0+'].map(b => `<option value="${b}" ${state.band_level === b ? 'selected' : ''}>${b}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
              ${skill.subparts.map(sp => `
                <button class="card p-8 rounded-[22px] border border-slate-100 hover:shadow-md hover:border-slate-200 transition-all text-left cam-subpart-btn" data-subpart="${escapeAttr(sp)}" style="border-left: 6px solid ${getAccent()};">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.22em]">Selected skill</div>
                  <div class="text-xl font-black text-slate-900 mt-2">${escapeHtml(sp)}</div>
                  <div class="text-slate-500 font-medium mt-2">Continue to choose formats</div>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    if (state.stage === 'formats') {
      const skill = SKILL_CONFIG[state.skill];
      const selected = new Set(state.selected_formats);
      const section = state.structure.sections?.[0];
      return `
        <div class="space-y-8">
          <div class="flex items-center justify-between">
            ${stepBar}
            <button class="btn btn-ghost font-bold text-slate-500" id="cam-back-to-subpart">← Back</button>
          </div>

          <div class="bg-white rounded-[28px] border border-slate-100 shadow-sm p-10 space-y-8" style="border-top: 6px solid ${getAccent()};">
            <div class="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Choose Formats</div>
                <div class="text-2xl font-black text-slate-900 mt-2">Select question formats for this ${escapeHtml(state.subpart || 'part')}</div>
                <div class="text-slate-500 font-medium mt-2">You can edit question ranges now, then upload content in the next step.</div>
              </div>
              <div class="min-w-[320px]">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Title</div>
                <input id="cam-title" class="input w-full bg-slate-50 border-none rounded-xl font-black" placeholder="e.g. Cambridge 18 Test 1" value="${escapeAttr(state.title)}">
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div class="cam-format-grid">
                ${skill.formats.map(f => `
                  <div class="cam-format-tile ${selected.has(f.id) ? 'selected' : ''} cam-format-card" data-format="${f.id}">
                    <input type="checkbox" class="checkbox" data-format-checkbox="${f.id}" ${selected.has(f.id) ? 'checked' : ''} style="position:absolute;opacity:0;pointer-events:none;">
                    <div class="cam-format-title">${escapeHtml(f.label)}</div>
                    <div class="cam-format-meta">${escapeHtml(state.skill)} format</div>
                    ${f.example ? `<div class="cam-format-example">${escapeHtml(f.example)}</div>` : ''}
                  </div>
                `).join('')}

                <button id="cam-add-custom-format" class="w-full p-5 rounded-2xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/60 text-left transition-colors flex items-center gap-3 mt-4">
                  <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-500 text-lg font-bold border border-slate-300">+</div>
                  <div>
                    <div class="font-black text-slate-800 text-sm">Custom format</div>
                    <div class="text-xs text-slate-500 mt-1">Define your own question type name & short example.</div>
                  </div>
                </button>
              </div>

              <div class="rounded-[22px] border border-slate-100 p-8 bg-white">
                <div class="flex items-center justify-between mb-6">
                  <div>
                    <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Question Ranges</div>
                    <div class="text-lg font-black text-slate-900 mt-1">${escapeHtml(section?.title || state.subpart || 'Section')}</div>
                  </div>
                  <span class="cam-tag-chip">${(section?.question_blocks || []).length} blocks</span>
                </div>
                <div class="space-y-3" id="cam-range-list">
                  ${(section?.question_blocks || []).length === 0 ? `<div class="text-slate-400 font-medium italic">Select at least 1 format.</div>` : section.question_blocks.map((b, idx) => `
                    <div class="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span class="cam-tag-chip">${escapeHtml(FORMAT_LABELS[b.type] || b.type)}</span>
                      <input class="input w-20 text-center bg-white" type="number" value="${b.question_start}" data-range-idx="${idx}" data-key="question_start">
                      <span class="text-slate-400 font-black">→</span>
                      <input class="input w-20 text-center bg-white" type="number" value="${b.question_end}" data-range-idx="${idx}" data-key="question_end">
                    </div>
                  `).join('')}
                </div>

                <div class="mt-8 flex justify-end">
                  <button class="btn btn-primary px-10 rounded-2xl font-black" id="cam-go-editor" ${state.selected_formats.length === 0 ? 'disabled' : ''}>Next: Upload & Preview →</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (state.stage === 'editor') {
      const shell = `
        <div class="space-y-8">
          <div class="flex items-center justify-between">
            ${stepBar}
            <button class="btn btn-ghost font-bold text-slate-500" id="cam-back-to-formats">← Back</button>
          </div>
          <div id="cam-editor-host" class="h-[78vh] bg-white rounded-[28px] border border-slate-100 overflow-hidden shadow-sm"></div>
        </div>
      `;
      return shell;
    }

    return `<div class="text-slate-400 font-medium italic">Invalid state</div>`;
  };

  const setupEvents = () => {
    // Skill tag click
    container.querySelectorAll('[data-skill-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const skill = btn.dataset.skillTag;
        resetForSkill(skill);
        renderDashboard();
      });
    });

    // Back handlers
    document.getElementById('cam-back-to-skills')?.addEventListener('click', () => {
      state.stage = 'skills';
      state.skill = null;
      state.subpart = null;
      renderDashboard();
    });
    document.getElementById('cam-back-to-subpart')?.addEventListener('click', () => {
      state.stage = 'subpart';
      renderDashboard();
    });
    document.getElementById('cam-back-to-formats')?.addEventListener('click', () => {
      state.stage = 'formats';
      renderDashboard();
    });

    // Subpart selection
    container.querySelectorAll('.cam-subpart-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.subpart = btn.dataset.subpart;
        state.stage = 'formats';
        state.selected_formats = [];
        state.structure = { sections: [] };
        renderDashboard();
      });
    });

    // Book/band selection
    document.getElementById('cam-book-num')?.addEventListener('change', (e) => {
      state.book_num = parseInt(e.target.value);
    });
    document.getElementById('cam-band')?.addEventListener('change', (e) => {
      state.band_level = e.target.value;
    });

    // Formats selection
    container.querySelectorAll('[data-format-checkbox]').forEach(cb => {
      cb.addEventListener('change', () => {
        const fmt = cb.dataset.formatCheckbox;
        const set = new Set(state.selected_formats);
        if (cb.checked) set.add(fmt);
        else set.delete(fmt);
        state.selected_formats = Array.from(set);
        buildDefaultStructureFromFormats();
        renderDashboard();
      });
    });

    container.querySelectorAll('.cam-format-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const cb = card.querySelector('input[type="checkbox"][data-format-checkbox]');
        if (!cb || e.target === cb) return;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });
    });

    // Custom format
    document.getElementById('cam-add-custom-format')?.addEventListener('click', () => {
      const label = prompt('Name of custom question format (e.g. Gap-fill with pictures)');
      if (!label || !label.trim()) return;
      const example = prompt('Short example for teachers (will be shown under the title):', 'Example: Complete each caption with NO MORE THAN TWO WORDS.');
      const id = `custom_${Date.now()}`;
      const skillCfg = SKILL_CONFIG[state.skill];
      const fmt = { id, label: label.trim(), example: example ? example.trim() : '' };
      skillCfg.formats.push(fmt);
      FORMAT_LABELS[id] = fmt.label;
      state.selected_formats = [...state.selected_formats, id];
      buildDefaultStructureFromFormats();
      renderDashboard();
    });

    // Title input
    document.getElementById('cam-title')?.addEventListener('input', (e) => {
      state.title = e.target.value;
    });

    // Range edits
    container.querySelectorAll('[data-range-idx]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.rangeIdx);
        const key = inp.dataset.key;
        const val = parseInt(inp.value);
        if (!state.structure.sections?.[0]?.question_blocks?.[idx]) return;
        state.structure.sections[0].question_blocks[idx][key] = Number.isFinite(val) ? val : state.structure.sections[0].question_blocks[idx][key];
      });
    });

    // Go editor
    document.getElementById('cam-go-editor')?.addEventListener('click', () => {
      if (!state.title.trim()) {
        state.title = `Cambridge ${state.book_num} ${SKILL_CONFIG[state.skill].title} - ${state.subpart}`;
      }
      state.stage = 'editor';
      renderDashboard();
      mountEditor();
    });

    // Mount editor on stage
    if (state.stage === 'editor') {
      mountEditor();
    }
  };

  const mountEditor = () => {
    const host = document.getElementById('cam-editor-host');
    if (!host) return;
    if (state.skill === 'reading') renderReadingEditor(host);
    else if (state.skill === 'listening') renderListeningEditor(host);
    else host.innerHTML = `<div class="p-10 text-slate-500 font-medium">This skill editor will be implemented next.</div>`;
  };

    const renderListeningEditor = (container) => {
      container.innerHTML = `
        <div class="listening-editor-layout flex flex-col h-full bg-slate-50">
          <!-- Top: Audio Player Section -->
          <div class="p-8 bg-white border-b border-slate-100 shadow-sm relative z-10" style="border-top: 6px solid ${getAccent()};">
            <div class="max-w-4xl mx-auto flex flex-col items-center">
              <div class="w-full h-24 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 border-2 border-dashed border-slate-200 relative overflow-hidden group hover:border-blue-400 transition-colors cursor-pointer" id="audio-upload-zone">
                <input type="file" id="listening-audio-input" class="hidden" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac">
                <div class="flex flex-col items-center gap-2 group-hover:text-blue-600">
                  <span class="text-3xl">🎵</span>
                  <span class="font-bold text-slate-400" id="audio-filename">${escapeHtml(state.meta?.media?.audio?.name || 'Click to upload Audio (MP3/WAV/M4A/AAC/OGG/FLAC)')}</span>
                  <span class="text-xs font-bold text-slate-300 uppercase tracking-widest" id="audio-upload-status">${state.meta?.media?.audio?.url ? 'Uploaded' : 'Not uploaded'}</span>
                </div>
                <!-- Custom Waveform Mock -->
                <div id="waveform-visualizer" class="absolute inset-0 flex items-end justify-center gap-[2px] opacity-10 pointer-events-none px-10 pb-4">
                   ${Array.from({length: 60}).map(() => `<div class="bg-blue-600 w-[2px]" style="height: ${Math.random()*80}%"></div>`).join('')}
                </div>
              </div>
              
              <div class="flex items-center gap-8 w-full max-w-2xl">
                <div class="flex items-center gap-4">
                  <button class="btn btn-circle bg-blue-600 text-white border-none hover:bg-blue-700 shadow-lg shadow-blue-200" id="audio-play-pause">▶️</button>
                  <select id="audio-speed" class="input bg-slate-50 border-none font-bold text-sm h-10 w-24">
                    <option value="0.75">0.75x</option>
                    <option value="1.0" selected>1.0x (Normal)</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                  </select>
                </div>
                <div class="flex-1 flex flex-col gap-2">
                  <input type="range" id="audio-seek" class="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600" value="0">
                  <div class="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <span id="audio-current">00:00</span>
                    <span id="audio-total">00:00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Middle: Section Selector -->
          <div class="px-8 py-4 bg-slate-100/50 border-b flex justify-center gap-4">
            ${[1,2,3,4].map(n => `
              <button class="btn btn-ghost px-6 h-10 rounded-xl font-bold section-tab-btn ${n === 1 ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}" data-section="${n}">
                Section ${n}
              </button>
            `).join('')}
          </div>

          <!-- Bottom: Question Builder -->
          <div class="flex-1 overflow-auto p-10">
            <div class="max-w-4xl mx-auto bg-white p-12 rounded-[40px] shadow-sm min-h-full" id="listening-question-builder">
               <!-- Dynamic Section Content -->
            </div>
          </div>
        </div>
      `;
      setupListeningEditorEvents(container);
    };

    const setupListeningEditorEvents = (container) => {
      let activeSection = 1;
      const audio = new Audio();
      const playBtn = container.querySelector('#audio-play-pause');
      const seek = container.querySelector('#audio-seek');
      const speed = container.querySelector('#audio-speed');
      const timeVal = container.querySelector('#audio-current');
      const totalVal = container.querySelector('#audio-total');
      const uploadArea = container.querySelector('#audio-upload-zone');
      const fileInput = container.querySelector('#listening-audio-input');
      const statusEl = container.querySelector('#audio-upload-status');

      uploadArea?.addEventListener('click', () => fileInput.click());
      fileInput?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0]; if (!file) return;
        container.querySelector('#audio-filename').textContent = file.name;
        audio.src = URL.createObjectURL(file);
        container.querySelector('#waveform-visualizer').style.opacity = '0.4';

        // upload to storage + store public URL (nghiệp vụ chuẩn)
        try {
          if (statusEl) statusEl.textContent = 'Uploading...';
          const duration = await getAudioDurationSeconds(file).catch(() => 0);
          const uploaded = await uploadListeningAudio(file);
          state.meta.media.audio = {
            url: uploaded.url,
            name: file.name,
            mime: file.type || 'application/octet-stream',
            size: file.size || 0,
            duration_seconds: duration ? Math.round(duration) : 0
          };
          if (statusEl) statusEl.textContent = 'Uploaded';
          showToast('Audio uploaded successfully', 'success');
        } catch (err) {
          if (statusEl) statusEl.textContent = 'Upload failed';
          showToast(err.message, 'error');
        }
      });

      playBtn?.addEventListener('click', () => {
        if (audio.paused) { audio.play(); playBtn.textContent = '⏸️'; } 
        else { audio.pause(); playBtn.textContent = '▶️'; }
      });

      audio.addEventListener('timeupdate', () => {
        const progress = (audio.currentTime / audio.duration) * 100;
        seek.value = progress || 0;
        timeVal.textContent = formatTime(audio.currentTime);
      });

      audio.addEventListener('loadedmetadata', () => {
        totalVal.textContent = formatTime(audio.duration);
      });

      seek?.addEventListener('input', (e) => {
        audio.currentTime = (e.target.value / 100) * audio.duration;
      });

      speed?.addEventListener('change', (e) => audio.playbackRate = parseFloat(e.target.value));

      const formatTime = (s) => {
        const min = Math.floor(s / 60); const sec = Math.floor(s % 60);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
      };

      container.querySelectorAll('.section-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
           activeSection = parseInt(e.currentTarget.dataset.section);
           container.querySelectorAll('.section-tab-btn').forEach(b => b.classList.remove('bg-white', 'shadow-sm', 'text-blue-600'));
           btn.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
           renderListeningQuestions(activeSection);
        });
      });

      const renderListeningQuestions = (secIdx) => {
         const builder = container.querySelector('#listening-question-builder');
         const section = state.structure.sections[secIdx-1];
         if (!section) { builder.innerHTML = '<div class="text-center p-10 text-slate-400">Section not defined in structure</div>'; return; }
         
         builder.innerHTML = `
           <div class="flex justify-between items-center mb-10">
              <h3 class="text-2xl font-black text-slate-800 tracking-tight">${section.title}</h3>
              <span class="text-xs font-black text-slate-400 uppercase tracking-widest">${section.question_blocks.length} Configured Blocks</span>
           </div>
           <div class="mb-8 p-5 rounded-3xl border border-slate-100" style="background:${getAccentBg()};">
             <div class="flex items-center justify-between gap-4 flex-wrap">
               <div>
                 <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Audio</div>
                 <div class="font-black text-slate-900 mt-1">${escapeHtml(state.meta?.media?.audio?.name || 'No audio uploaded yet')}</div>
               </div>
               <div class="flex items-center gap-3">
                 ${state.meta?.media?.audio?.url ? `<a class="btn btn-secondary btn-sm" href="${escapeAttr(state.meta.media.audio.url)}" target="_blank" rel="noreferrer">Open file</a>` : ''}
                 <span class="cam-tag-chip">${state.meta?.media?.audio?.duration_seconds ? `${state.meta.media.audio.duration_seconds}s` : 'duration n/a'}</span>
               </div>
             </div>
           </div>
           
           <div class="space-y-12">
             ${section.question_blocks.map(block => `
                <div class="question-block-group bg-slate-50/50 p-8 rounded-3xl border border-slate-100">
                   <div class="flex items-center gap-3 mb-6">
                      <span class="w-8 h-8 rounded-full bg-blue-600 text-white flex-center font-bold text-xs">${block.question_start}-${block.question_end}</span>
                      <span class="font-bold text-slate-700">${escapeHtml(FORMAT_LABELS[block.type] || block.type)}</span>
                   </div>
                   <div class="grid gap-6">
                      ${Array.from({length: block.question_end - block.question_start + 1}).map((_, i) => {
                         const qNum = block.question_start + i;
                         if (!state.questions[qNum]) state.questions[qNum] = { text: '', explanation: '' };
                         return `
                           <div class="flex items-start gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all focus-within:border-blue-300 focus-within:shadow-md">
                              <span class="font-black text-slate-300 mt-2">${qNum}</span>
                              <div class="flex-1 space-y-3">
                                 <input type="text" class="input w-full bg-transparent border-none font-bold text-slate-700 focus:ring-0 p-0" placeholder="Question content..." value="${escapeAttr(state.questions?.[qNum]?.text || '')}" oninput="window.__cam_setQText(${qNum}, this.value)">
                                 <div class="flex gap-4">
                                    <input type="text" class="input flex-1 bg-slate-50 border-none rounded-xl text-sm h-10" placeholder="Correct Answer" value="${escapeAttr(state.answers?.[qNum] || '')}" oninput="window.__cam_setAns(${qNum}, this.value)">
                                    <input type="text" class="input flex-1 bg-slate-50 border-none rounded-xl text-sm h-10" placeholder="Explanation (Optional)" value="${escapeAttr(state.questions?.[qNum]?.explanation || '')}" oninput="window.__cam_setQExplain(${qNum}, this.value)">
                                 </div>
                              </div>
                           </div>
                         `;
                      }).join('')}
                   </div>
                </div>
             `).join('')}
           </div>
           <div class="pt-10 mt-10 border-t flex justify-end">
             <button class="btn btn-primary px-12 py-4 h-auto rounded-xl font-black" id="cam-publish-btn">🚀 Publish to Library</button>
           </div>
         `;
         builder.querySelector('#cam-publish-btn')?.addEventListener('click', publishToLibrary);
      };
      renderListeningQuestions(1);
    };

    const renderReadingEditor = (container) => {
      container.innerHTML = `
        <div class="reading-editor-layout flex h-full w-full bg-slate-50 overflow-hidden">
           <!-- LEFT COLUMN: 60% / Full when no PDF -->
           <div class="flex-1 flex flex-col min-h-0 border-r border-slate-200 shadow-sm relative z-10 bg-slate-50 transition-all ${state.meta?.media?.pdf?.url ? 'w-[60%]' : 'w-full'}">
              <div class="p-6 border-b bg-white border-slate-200 flex justify-between items-center shrink-0" style="border-top: 4px solid #2563eb;">
                 <div class="flex items-center gap-3">
                    <span class="w-3 h-3 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.4)]"></span>
                    <span class="font-bold text-slate-800 uppercase tracking-widest text-sm">Passage Viewer</span>
                 </div>
                 <div class="flex gap-2 items-center">
                    ${state.meta?.media?.pdf?.url ? `
                      <div class="h-6 w-[1px] bg-slate-300"></div>
                      <button class="btn btn-ghost btn-sm rounded-lg hover:bg-slate-100 font-bold text-slate-600" id="zoom-in-btn" title="Zoom In">➕</button>
                      <button class="btn btn-ghost btn-sm rounded-lg hover:bg-slate-100 font-bold text-slate-600" id="zoom-out-btn" title="Zoom Out">➖</button>
                      <button class="btn btn-ghost btn-sm rounded-lg hover:bg-slate-100 font-bold text-slate-600" title="Dark Mode" id="toggle-dark-btn">🌙</button>
                      <div class="h-6 w-[1px] bg-slate-300 mx-1"></div>
                      <button class="btn btn-ghost btn-sm text-red-600 font-bold hover:bg-red-50 rounded-lg" id="clear-pdf-btn">Clear</button>
                    ` : ''}
                    <button class="btn btn-primary btn-sm px-5 rounded-lg shadow-md font-bold" id="import-pdf-btn">${state.meta?.media?.pdf?.url ? 'Replace PDF' : '📄 Upload PDF'}</button>
                    <input type="file" id="pdf-input-hidden" class="hidden" accept="application/pdf">
                 </div>
              </div>
              
              <div class="flex-1 overflow-auto p-4 md:p-8 relative flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
                 <div id="passage-viewport" class="w-full flex-1 flex flex-col transition-all duration-300 min-h-[85vh]">
                    ${state.meta?.media?.pdf?.url 
                      ? `<iframe src="${state.meta.media.pdf.url}" class="w-full h-full rounded-2xl shadow-xl flex-1 bg-white" style="border: 1px solid #e2e8f0;"></iframe>`
                      : `<div class="flex items-center justify-center h-full">
                           <div class="flex flex-col items-center gap-3">
                             <svg class="w-16 h-16 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                             <p class="text-slate-500 text-sm font-medium uppercase tracking-widest">Upload file</p>
                           </div>
                         </div>`
                    }
                 </div>
                 <div id="pdf-upload-overlay" class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm items-center justify-center z-50 flex rounded-2xl" style="display: none;">
                   <div class="flex flex-col items-center gap-4 bg-white p-10 rounded-2xl shadow-2xl border border-slate-200">
                     <div class="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-2">
                       <div class="spinner-sm border-white border-t-transparent"></div>
                     </div>
                     <span class="font-bold text-slate-900 tracking-tight text-lg">Uploading PDF</span>
                     <span class="text-sm text-slate-500">Please wait while we process your file...</span>
                   </div>
                 </div>
              </div>
           </div>
           
           <!-- RIGHT COLUMN: 40% -->
           <div class="w-[40%] flex flex-col min-h-0 bg-white shadow-[-10px_0_30px_rgba(0,0,0,0.03)] z-20 transition-all ${!state.meta?.media?.pdf?.url ? 'hidden' : ''}">
              <div class="p-6 border-b border-slate-200 flex justify-between items-center bg-white shrink-0" style="border-top: 4px solid #059669;">
                 <div class="flex items-center gap-3">
                    <span class="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></span>
                    <span class="font-bold text-slate-800 uppercase tracking-widest text-sm">Question & Answer</span>
                 </div>
                 <button class="btn btn-outline btn-sm text-emerald-600 font-bold hover:bg-emerald-50 px-4 rounded-lg border-emerald-300" id="reading-add-block-btn">+ Add Block</button>
              </div>
              
              <div class="flex-1 overflow-auto p-6 bg-gradient-to-b from-slate-50 to-white" id="reading-q-builder-container"></div>
              
              <div class="p-6 border-t border-slate-200 bg-white flex justify-between items-center shrink-0">
                 <button class="btn btn-ghost font-bold text-slate-600 hover:text-slate-900" id="cam-back-to-formats-inline">← Back</button>
                 <button class="btn btn-primary px-8 py-2.5 h-auto rounded-lg font-bold shadow-md shadow-blue-200/50 hover:-translate-y-0.5 transition-all" id="cam-publish-btn">Publish to Library</button>
              </div>
           </div>
        </div>
      `;
      setupReadingEditorEvents(container);
    };

    const setupReadingEditorEvents = (container) => {
      let zoom = 1.0;
      const viewport = container.querySelector('#passage-viewport');
      const renderArea = container.querySelector('#passage-render');

      container.querySelector('#zoom-in-btn')?.addEventListener('click', () => { zoom += 0.1; viewport.style.transform = `scale(${zoom})`; viewport.style.transformOrigin = 'top center'; });
      container.querySelector('#zoom-out-btn')?.addEventListener('click', () => { if (zoom > 0.5) { zoom -= 0.1; viewport.style.transform = `scale(${zoom})`; viewport.style.transformOrigin = 'top center'; }});
      container.querySelector('#toggle-dark-btn')?.addEventListener('click', () => {
         viewport.classList.toggle('invert');
         viewport.classList.toggle('hue-rotate-180');
         if (renderArea) {
           renderArea.classList.toggle('dark-mode-passage');
           viewport.classList.toggle('bg-slate-900');
           viewport.classList.toggle('bg-white');
         }
      });
      
      container.querySelector('#highlight-btn')?.addEventListener('click', () => {
         if (!renderArea) { showToast('Highlight only works on pasted text, not PDFs.', 'info'); return; }
         const selection = window.getSelection();
         if (!selection.rangeCount || selection.isCollapsed) return;
         const range = selection.getRangeAt(0);
         const span = document.createElement('span');
         span.className = 'bg-yellow-200 rounded-sm px-1 selection-highlight';
         range.surroundContents(span);
      });

      renderArea?.addEventListener('input', () => state.content = renderArea.innerHTML);

      container.querySelector('#clear-pdf-btn')?.addEventListener('click', () => {
        state.meta.media.pdf = null;
        renderReadingEditor(document.getElementById('cam-editor-host'));
      });

      const overlay = container.querySelector('#pdf-upload-overlay');
      container.querySelector('#import-pdf-btn')?.addEventListener('click', () => container.querySelector('#pdf-input-hidden')?.click());
      container.querySelector('#pdf-input-hidden')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          if (overlay) overlay.style.display = 'flex';
          const uploaded = await uploadReadingPdf(file);
          state.meta.media.pdf = {
            url: uploaded.url,
            name: file.name,
            mime: file.type || 'application/pdf',
            size: file.size || 0
          };
          // Re-render editor with PDF iframe
          renderReadingEditor(document.getElementById('cam-editor-host'));
          showToast('PDF uploaded successfully!', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          if (overlay) overlay.style.display = 'none';
          e.target.value = '';
        }
      });

      container.querySelector('#cam-back-to-formats-inline')?.addEventListener('click', () => {
        state.stage = 'formats';
        renderDashboard();
      });

      container.querySelector('#cam-publish-btn')?.addEventListener('click', publishToLibrary);

      const renderReadingBlocks = () => {
         const builder = container.querySelector('#reading-q-builder-container');
         if (!builder) return;

         // Sync the 'Add Block' button visibility here as well to be safe
         const addBlockBtn = container.querySelector('#reading-add-block-btn');
         const isPdfActive = !!state.meta?.media?.pdf?.url;
         if (addBlockBtn) {
            if (isPdfActive) addBlockBtn.classList.remove('hidden');
            else addBlockBtn.classList.add('hidden');
         }

         if (!isPdfActive) {
            builder.innerHTML = `
               <div class="flex flex-col items-center justify-center h-full text-slate-600 bg-gradient-to-b from-slate-50 to-white rounded-2xl border border-slate-200 shadow-md p-10 relative">
                 <div class="absolute inset-0 bg-gradient-to-tr from-emerald-50/20 via-transparent to-transparent rounded-2xl opacity-50"></div>
                 <div class="relative z-10 flex flex-col items-center">
                   <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center mb-6 border border-emerald-200/50 shadow-sm">
                     <svg class="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                   </div>
                   <p class="font-bold text-xl text-slate-800">Upload PDF First</p>
                   <p class="text-sm mt-3 text-slate-600 max-w-xs text-center leading-relaxed">Upload your reading passage on the left panel, then return here to create and manage your questions.</p>
                   <div class="mt-6 pt-6 border-t border-slate-200 w-full">
                     <p class="text-xs text-slate-500 font-medium uppercase tracking-widest mb-2">What You'll Do</p>
                     <ul class="text-sm text-slate-600 space-y-1.5">
                       <li class="flex items-center gap-2"><span class="text-emerald-600 font-bold">✓</span> Create question blocks</li>
                       <li class="flex items-center gap-2"><span class="text-emerald-600 font-bold">✓</span> Set correct answers</li>
                       <li class="flex items-center gap-2"><span class="text-emerald-600 font-bold">✓</span> Publish to library</li>
                     </ul>
                   </div>
                 </div>
               </div>
            `;
            return;
         }

         const section = state.structure.sections[0];
         if (!section) return;

         builder.innerHTML = section.question_blocks.map((block, bIdx) => `
            <div class="mb-10 animate-fade-in relative bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
               <div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                  <div class="flex items-center gap-2">
                     <span class="bg-blue-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg tracking-widest">GROUP ${bIdx + 1}</span>
                  </div>
                  <button class="btn btn-ghost btn-xs text-red-500 hover:bg-red-50 rounded-lg text-xs font-bold px-3 transition-colors" onclick="window.__cam_removeBlock(${bIdx})">
                     Delete
                  </button>
               </div>
               
               <div class="space-y-4">
                  ${Array.from({length: block.question_end - block.question_start + 1}).map((_, i) => {
                     const qNum = block.question_start + i;
                     if (!state.questions[qNum]) state.questions[qNum] = { text: '', explanation: '', type: block.type || 'mcq' };
                     const qType = state.questions[qNum].type || block.type;
                     
                     let answerInputHtml = '';
                     if (qType === 'tfng') {
                        const currentAns = state.answers[qNum] || '';
                        answerInputHtml = `
                           <div class="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm w-full transition-colors focus-within:border-blue-300">
                              <label class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                                 <input type="radio" name="ans_${qNum}" value="TRUE" ${currentAns === 'TRUE' ? 'checked' : ''} onchange="window.__cam_setAns(${qNum}, this.value); renderReadingBlocks();" class="radio radio-success radio-sm">
                                 <span class="text-sm font-bold text-emerald-700">TRUE</span>
                              </label>
                              <label class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                                 <input type="radio" name="ans_${qNum}" value="FALSE" ${currentAns === 'FALSE' ? 'checked' : ''} onchange="window.__cam_setAns(${qNum}, this.value); renderReadingBlocks();" class="radio radio-error radio-sm">
                                 <span class="text-sm font-bold text-red-600">FALSE</span>
                              </label>
                              <label class="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                                 <input type="radio" name="ans_${qNum}" value="NOT GIVEN" ${currentAns === 'NOT GIVEN' ? 'checked' : ''} onchange="window.__cam_setAns(${qNum}, this.value); renderReadingBlocks();" class="radio radio-sm">
                                 <span class="text-sm font-bold text-slate-500">NOT GIVEN</span>
                              </label>
                           </div>
                        `;
                     } else {
                        answerInputHtml = `<input type="text" class="input input-bordered input-sm w-full font-bold text-slate-800 placeholder-slate-400 bg-white shadow-sm focus:border-blue-500 transition-colors" placeholder="Correct Answer... (Ex: A, B, C, or text)" value="${escapeAttr(state.answers[qNum] || '')}" oninput="window.__cam_setAns(${qNum}, this.value)">`;
                     }

                     return `
                        <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 flex flex-col gap-3 focus-within:bg-blue-50/30 focus-within:border-blue-200 transition-colors">
                           <div class="flex items-center gap-3">
                              <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-black flex items-center justify-center text-sm shrink-0 shadow-sm border border-blue-200/50">
                                ${qNum}
                              </div>
                              <select class="select select-bordered select-sm flex-1 font-bold text-slate-700 bg-white shadow-sm" onchange="window.__cam_setQType(${qNum}, this.value); renderReadingBlocks();">
                                 ${SKILL_CONFIG.reading.formats.map(f => `<option value="${f.id}" ${qType === f.id ? 'selected' : ''}>${escapeHtml(f.label)}</option>`).join('')}
                              </select>
                           </div>
                           <div class="pl-[48px] flex flex-col gap-3">
                              ${answerInputHtml}
                              <input type="text" class="input input-bordered input-sm w-full text-sm text-slate-600 placeholder-slate-400 bg-white/60 focus:bg-white transition-colors" placeholder="Explanation (opt)" value="${escapeAttr(state.questions?.[qNum]?.explanation || '')}" oninput="window.__cam_setQExplain(${qNum}, this.value)">
                           </div>
                        </div>
                     `;
                  }).join('')}
               </div>
            </div>
         `).join('');
      };

      window.__cam_setBlockType = (bIdx, val) => { state.structure.sections[0].question_blocks[bIdx].type = val; renderReadingBlocks(); };
      window.__cam_setQType = (qNum, val) => { 
        if (!state.questions[qNum]) state.questions[qNum] = { text: '', explanation: '', type: 'mcq' }; 
        state.questions[qNum].type = val; 
      };
      window.__cam_removeBlock = (bIdx) => { state.structure.sections[0].question_blocks.splice(bIdx, 1); renderReadingBlocks(); };
      window.__cam_setQText = (qNum, val) => { if (!state.questions[qNum]) state.questions[qNum] = { text: '', explanation: '', type: 'mcq' }; state.questions[qNum].text = val; };
      window.__cam_setQExplain = (qNum, val) => { if (!state.questions[qNum]) state.questions[qNum] = { text: '', explanation: '', type: 'mcq' }; state.questions[qNum].explanation = val; };
      window.__cam_setAns = (qNum, val) => { state.answers[qNum] = val; };
      
      container.querySelector('#reading-add-block-btn')?.addEventListener('click', () => {
         const section = state.structure.sections[0];
         const lastBlock = section.question_blocks[section.question_blocks.length - 1];
         const start = lastBlock ? lastBlock.question_end + 1 : 1;
         section.question_blocks.push({ question_start: start, question_end: start + 4, type: 'mcq' });
         renderReadingBlocks();
      });

      renderReadingBlocks();
    };

  const publishToLibrary = async () => {
    try {
      if (state.skill === 'listening' && !state.meta?.media?.audio?.url) {
        throw new Error('Please upload an audio file before publishing Listening.');
      }
      const finalData = {
        title: state.title,
        book_num: parseInt(state.book_num || 0),
        skill: state.skill,
        // Removed sub_category: state.subpart, because books schema doesn't have it!
        band_level: state.band_level,
        tests: [{
          title: state.title,
          test_num: 1,
          sections: state.structure.sections.map((sec) => {
            const questions = [];
            sec.question_blocks.forEach(block => {
              for (let q = block.question_start; q <= block.question_end; q++) {
                questions.push({
                  question_num: q,
                  type: state.questions?.[q]?.type || block.type || 'mcq',
                  correct_answer: state.answers?.[q] || '',
                  text: state.questions?.[q]?.text || '',
                  explanation: state.questions?.[q]?.explanation || ''
                });
              }
            });

            let content = '';
            if (state.skill === 'reading') {
              if (state.meta?.media?.pdf?.url) {
                content = JSON.stringify({ pdf: state.meta.media.pdf });
              } else {
                content = state.content || '';
              }
            } else if (state.skill === 'listening') {
              content = JSON.stringify({
                audio: state.meta?.media?.audio || null,
                section_num: sec.title?.match(/(\d+)/)?.[0] ? parseInt(sec.title.match(/(\d+)/)[0]) : null
              });
            }
            return { title: sec.title, content, questions };
          })
        }]
      };
      await saveBook(finalData);
      books = await db.books.list();
      showToast('Uploaded successfully!', 'success');
      state.stage = 'skills';
      state.skill = null;
      state.subpart = null;
      renderDashboard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };



  async function saveBook(data) {
     const { tests, ...meta } = data;
     const newBooks = await db.books.create({ ...meta });
     const bookId = newBooks[0].id;
     for (const t of tests) {
        const newTests = await db.tests.create({ book_id: bookId, test_num: t.test_num, title: t.title });
        const testId = newTests[0].id;
        for (let idx = 0; idx < t.sections.length; idx++) {
           const sec = t.sections[idx];
           const newSecs = await db.sections.create({ test_id: testId, module: meta.skill, section_num: idx + 1, title: sec.title, content: sec.content || '' });
           const secId = newSecs[0].id;
            for (const q of sec.questions) {
               await db.questions.create({ 
                 section_id: secId, 
                 question_num: q.question_num, 
                 type: q.type, 
                 correct_answer: q.correct_answer,
                 text: q.text || '',
                 explanation: q.explanation || ''
               });
            }
        }
     }
  }

  renderDashboard();
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
