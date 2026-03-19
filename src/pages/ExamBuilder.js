import { exerciseService } from '../services/exercise.service.js';
import { aiGradingService } from '../services/ai-grading.service.js';
import { getCurrentUser } from '../utils/supabase.js';
import { showToast } from '../components/Toast.js';
import { navigateTo } from '../router.js';
import { escapeHtml } from '../utils/helpers.js';
import { showModal } from '../components/Modal.js';

export async function renderExamBuilder(container, params) {
  const user = getCurrentUser();
  const examId = params.id; // If editing
  let isEditing = !!examId;

  let examData = {
    title: '',
    module: 'reading',
    time_limit_minutes: 60,
    instructions: '',
    status: 'draft',
    pdf_url: '',
    pdf_name: ''
  };

  let blocks = [];
  let currentStep = 1;
  let isSaving = false;

  // Initial Load
  if (isEditing) {
    container.innerHTML = `<div class="flex items-center justify-center p-20"><div class="spinner"></div></div>`;
    try {
      const fullExam = await exerciseService.getExam(examId);
      if (fullExam) {
        const { question_blocks, ...rest } = fullExam;
        examData = rest;
        blocks = question_blocks || [];
      }
    } catch (err) {
      showToast('Failed to load exam', 'error');
    }
  }

  const render = () => {
    container.innerHTML = `
      <div class="animate-fade-in-up" style="max-width:1000px;margin:0 auto;padding-bottom:100px;">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold">${isEditing ? 'Edit Exam' : 'Create New Exam'}</h1>
            <p class="text-muted">Step ${currentStep} of 3: ${getStepTitle(currentStep)}</p>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-ghost" id="cancel-btn">Cancel</button>
            ${currentStep > 1 ? `<button class="btn btn-secondary" id="prev-btn">Back</button>` : ''}
            ${currentStep < 3 ? `<button class="btn btn-primary" id="next-btn">Next Step</button>` : `<button class="btn btn-green" id="save-btn">${isSaving ? 'Saving...' : 'Publish Exam'}</button>`}
          </div>
        </div>

        <div class="step-content">
          ${renderStep(currentStep)}
        </div>
      </div>
    `;
    setupEvents();
  };

  const getStepTitle = (step) => {
    if (step === 1) return 'General Information';
    if (step === 2) return 'Question Blocks';
    return 'Review & Finalize';
  };

  const renderStep = (step) => {
    if (step === 1) return renderStep1();
    if (step === 2) return renderStep2();
    return renderStep3();
  };

  const renderStep1 = () => `
    <div class="card p-8 space-y-6">
      <div class="input-group">
        <label class="form-label font-bold text-gray-700">Exam Title *</label>
        <input type="text" id="ex-title" class="input text-lg py-4" placeholder="e.g. Cambridge 15 - Test 1 - Reading" value="${escapeHtml(examData.title)}" required>
      </div>

      <div class="grid grid-2 gap-6">
        <div class="input-group">
          <label class="form-label font-bold">Module</label>
          <select id="ex-module" class="input">
            <option value="reading" ${examData.module === 'reading' ? 'selected' : ''}>Reading</option>
            <option value="listening" ${examData.module === 'listening' ? 'selected' : ''}>Listening</option>
            <option value="writing" ${examData.module === 'writing' ? 'selected' : ''}>Writing</option>
            <option value="speaking" ${examData.module === 'speaking' ? 'selected' : ''}>Speaking</option>
          </select>
        </div>
        <div class="input-group">
          <label class="form-label font-bold">Time Limit (minutes)</label>
          <input type="number" id="ex-time" class="input" value="${examData.time_limit_minutes || 60}">
        </div>
      </div>

      <div class="input-group">
        <label class="form-label font-bold">PDF Material (Optional)</label>
        <div class="flex items-center gap-4 p-4 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 transition-colors" id="upload-trigger">
          <div class="text-3xl">📄</div>
          <div>
            <div class="font-bold">${examData.pdf_name || 'Click to upload PDF or paste URL'}</div>
            <div class="text-xxs text-muted">Supports direct URL or storage upload (MVP: URL only)</div>
          </div>
        </div>
        <input type="hidden" id="ex-pdf-url" value="${examData.pdf_url || ''}">
      </div>

      <div class="input-group">
        <label class="form-label font-bold">General Instructions</label>
        <textarea id="ex-instructions" class="input h-32 p-4" placeholder="Standard IELTS instructions...">${escapeHtml(examData.instructions || '')}</textarea>
      </div>
    </div>
  `;

  const renderStep2 = () => `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="font-bold">Total Blocks: ${blocks.length}</h3>
        <div class="flex gap-2">
          <button class="btn btn-blue-soft btn-sm gap-2" id="magic-build-btn">✨ Magic Build</button>
          <button class="btn btn-secondary btn-sm" id="add-block-btn">+ Add Block</button>
        </div>
      </div>

      <div id="blocks-list" class="space-y-4">
        ${blocks.length === 0 ? `
          <div class="card p-12 text-center text-muted italic bg-gray-50">No question blocks added yet.</div>
        ` : blocks.sort((a,b) => a.block_order - b.block_order).map((b, idx) => `
          <div class="card p-6 border-l-4 border-blue-500 flex items-center justify-between animate-fade-in">
            <div class="flex items-center gap-6">
              <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">${idx + 1}</div>
              <div>
                <div class="font-bold text-sm">${b.block_type.replace(/_/g, ' ').toUpperCase()} (Q${b.question_start}–${b.question_end})</div>
                <p class="text-xxs text-muted truncate max-w-sm">${escapeHtml(b.instruction || 'No instruction')}</p>
              </div>
            </div>
            <div class="flex gap-2">
              <button class="btn btn-ghost btn-xs edit-block-btn" data-idx="${idx}">Edit</button>
              <button class="btn btn-ghost btn-xs text-red-500 delete-block-btn" data-idx="${idx}">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const renderStep3 = () => `
    <div class="card p-8">
      <h3 class="text-xl font-bold mb-6">Review Exam Summary</h3>
      <div class="grid grid-2 gap-8 mb-8">
        <div>
          <div class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Title</div>
          <div class="font-bold">${examData.title || 'Untitled'}</div>
        </div>
        <div>
          <div class="text-xxs font-black text-muted uppercase tracking-widest mb-1">Module & Time</div>
          <div class="font-bold uppercase">${examData.module} · ${examData.time_limit_minutes} Mins</div>
        </div>
      </div>

      <div class="border-t pt-6">
        <div class="text-xxs font-black text-muted uppercase tracking-widest mb-4">Structure</div>
        <div class="space-y-2">
          ${blocks.map(b => `
            <div class="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
               <span>Q${b.question_start}–${b.question_end}: <b>${b.block_type.replace(/_/g, ' ')}</b></span>
               <span class="badge badge-outline text-xxs">${Object.keys(b.answers || {}).length} Answers defined</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  const setupEvents = () => {
    // Nav
    document.getElementById('cancel-btn')?.addEventListener('click', () => navigateTo('/exams'));
    document.getElementById('prev-btn')?.addEventListener('click', () => { currentStep--; render(); });
    document.getElementById('next-btn')?.addEventListener('click', () => {
      if (currentStep === 1) {
        examData.title = document.getElementById('ex-title').value.trim();
        examData.module = document.getElementById('ex-module').value;
        examData.time_limit_minutes = parseInt(document.getElementById('ex-time').value) || 60;
        examData.instructions = document.getElementById('ex-instructions').value;
        if (!examData.title) return showToast('Please enter a title', 'error');
      }
      currentStep++;
      render();
    });

    document.getElementById('save-btn')?.addEventListener('click', handleSave);

    // Step 1: Upload
    document.getElementById('upload-trigger')?.addEventListener('click', () => {
      const url = prompt('Enter PDF URL (In MVP, please provide a direct URL to the PDF):', examData.pdf_url);
      if (url !== null) {
        examData.pdf_url = url;
        examData.pdf_name = url.split('/').pop() || 'Remote PDF';
        render();
      }
    });

    // Magic Build
    document.getElementById('magic-build-btn')?.addEventListener('click', () => openMagicBuildModal());

    // Step 2: Blocks
    document.getElementById('add-block-btn')?.addEventListener('click', () => openBlockModal());
    container.querySelectorAll('.edit-block-btn').forEach(btn => {
      btn.addEventListener('click', () => openBlockModal(parseInt(btn.dataset.idx)));
    });
    container.querySelectorAll('.delete-block-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('Delete this block?')) {
          blocks.splice(parseInt(btn.dataset.idx), 1);
          render();
        }
      });
    });
  };

  const openMagicBuildModal = () => {
    const modal = showModal('Magic Build with AI', `
      <div class="p-4 space-y-6">
        <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-4">
          <div class="text-2xl">🪄</div>
          <div class="text-sm text-blue-800">
            <strong>How it works:</strong> Paste the text content from your IELTS PDF below. 
            Gemini will automatically identify the question blocks, types, and instructions for you.
          </div>
        </div>

        <div class="input-group">
          <label class="form-label font-bold">Paste PDF Content Here</label>
          <textarea id="ai-pdf-text" class="input h-64 text-sm" placeholder="Paste the text from the IELTS practice test here..."></textarea>
        </div>

        <div class="flex justify-end gap-2 pt-4">
          <button class="btn btn-ghost" id="ai-cancel">Cancel</button>
          <button class="btn btn-primary" id="ai-process-btn">✨ Build Exam Structure</button>
        </div>
      </div>
    `, { size: 'large' });

    document.getElementById('ai-cancel').addEventListener('click', () => modal.close());
    
    document.getElementById('ai-process-btn').addEventListener('click', async () => {
      const text = document.getElementById('ai-pdf-text').value;
      if (!text.trim()) return showToast('Please paste some text first.', 'warning');

      const btn = document.getElementById('ai-process-btn');
      btn.disabled = true;
      btn.textContent = 'Analyzing with AI...';

      try {
        const extractedBlocks = await aiGradingService.extractExamBlocks(text);
        if (Array.isArray(extractedBlocks)) {
          blocks.push(...extractedBlocks);
          showToast(`Succesfully extracted ${extractedBlocks.length} blocks!`, 'success');
          modal.close();
          render();
        } else {
          throw new Error('AI returned an invalid structure.');
        }
      } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = '✨ Build Exam Structure';
      }
    });
  };

  const openBlockModal = (blockIdx = -1) => {
    const isEditingBlock = blockIdx >= 0;
    const block = isEditingBlock ? blocks[blockIdx] : {
      block_type: 'fill_blank',
      question_start: blocks.length > 0 ? blocks[blocks.length - 1].question_end + 1 : 1,
      question_end: blocks.length > 0 ? blocks[blocks.length - 1].question_end + 10 : 10,
      instruction: '',
      config: {},
      answers: {}
    };

    const modal = showModal(isEditingBlock ? 'Edit Question Block' : 'Add Question Block', `
      <form id="block-form" class="space-y-4">
        <div class="grid grid-2 gap-4">
          <div class="input-group">
            <label class="form-label font-bold">Type</label>
            <select id="bl-type" class="input">
              <optgroup label="Listening & Reading">
                <option value="fill_blank" ${block.block_type === 'fill_blank' ? 'selected' : ''}>Fill in Blank (Form/Note/Table)</option>
                <option value="multiple_choice" ${block.block_type === 'multiple_choice' ? 'selected' : ''}>MCQ (Single Answer)</option>
                <option value="multiple_select" ${block.block_type === 'multiple_select' ? 'selected' : ''}>MCQ (Choose TWO/THREE)</option>
                <option value="matching" ${block.block_type === 'matching' ? 'selected' : ''}>Matching (Headings/Info)</option>
                <option value="true_false_ng" ${block.block_type === 'true_false_ng' ? 'selected' : ''}>T/F/NG or Y/N/NG</option>
              </optgroup>
              <optgroup label="Writing & Speaking">
                <option value="writing_task1" ${block.block_type === 'writing_task1' ? 'selected' : ''}>Writing Task 1</option>
                <option value="writing_task2" ${block.block_type === 'writing_task2' ? 'selected' : ''}>Writing Task 2</option>
                <option value="speaking_part1" ${block.block_type === 'speaking_part1' ? 'selected' : ''}>Speaking Part 1</option>
              </optgroup>
            </select>
          </div>
          <div class="grid grid-2 gap-2">
            <div class="input-group">
              <label class="form-label font-bold">Start</label>
              <input type="number" id="bl-start" class="input" value="${block.question_start}" required>
            </div>
            <div class="input-group">
              <label class="form-label font-bold">End</label>
              <input type="number" id="bl-end" class="input" value="${block.question_end}" required>
            </div>
          </div>
        </div>

        <div class="input-group">
          <label class="form-label font-bold">Block Instruction</label>
          <input type="text" id="bl-instruction" class="input" placeholder="e.g. Write NO MORE THAN TWO WORDS..." value="${escapeHtml(block.instruction || '')}">
        </div>

        <div id="type-specific-config" class="p-4 bg-gray-50 rounded-xl space-y-4">
           <!-- Dynamic based on type -->
        </div>

        <div class="input-group">
          <label class="form-label font-bold">Correct Answers (JSON Format for MVP)</label>
          <textarea id="bl-answers" class="input font-mono text-xs h-32" placeholder='{"1": "library", "2": ["reading room", "the reading room"]}'>${JSON.stringify(block.answers, null, 2)}</textarea>
          <div class="text-xxs text-muted mt-2">Example: {"1": "answer", "2": ["opt1", "opt2"]}</div>
        </div>

        <div class="flex justify-end gap-2 pt-4">
          <button type="button" class="btn btn-ghost" id="bl-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="bl-save">Save Block</button>
        </div>
      </form>
    `, { size: 'large' });

    const blType = document.getElementById('bl-type');
    const configContainer = document.getElementById('type-specific-config');

    const updateConfigUI = () => {
      const type = blType.value;
      if (type === 'multiple_choice' || type === 'matching' || type === 'multiple_select') {
        configContainer.innerHTML = `
          <div class="input-group">
            <label class="form-label font-bold text-xs">Options (One per line)</label>
            <textarea id="cf-options" class="input h-24 text-xs" placeholder="A. First option\nB. Second option">${(block.config.options || []).join('\n')}</textarea>
          </div>
        `;
      } else if (type === 'true_false_ng') {
        configContainer.innerHTML = `
          <div class="input-group">
            <label class="form-label font-bold text-xs">Variant</label>
            <select id="cf-variant" class="input">
              <option value="true_false" ${block.config.variant === 'true_false' ? 'selected' : ''}>TRUE / FALSE / NOT GIVEN</option>
              <option value="yes_no" ${block.config.variant === 'yes_no' ? 'selected' : ''}>YES / NO / NOT GIVEN</option>
            </select>
          </div>
        `;
      } else {
        configContainer.innerHTML = `<div class="text-xxs text-muted italic">No specific config for this type yet.</div>`;
      }
    };

    blType.addEventListener('change', updateConfigUI);
    updateConfigUI();

    document.getElementById('bl-cancel').addEventListener('click', () => modal.close());
    document.getElementById('block-form').addEventListener('submit', (e) => {
      e.preventDefault();
      
      let answers = {};
      try {
        answers = JSON.parse(document.getElementById('bl-answers').value);
      } catch (err) {
        return showToast('Invalid JSON for answers', 'error');
      }

      const newBlock = {
        block_type: blType.value,
        question_start: parseInt(document.getElementById('bl-start').value),
        question_end: parseInt(document.getElementById('bl-end').value),
        instruction: document.getElementById('bl-instruction').value,
        config: {},
        answers: answers,
        block_order: blockIdx >= 0 ? blockIdx : blocks.length
      };

      // Extract config
      if (['multiple_choice', 'matching', 'multiple_select'].includes(newBlock.block_type)) {
        newBlock.config.options = document.getElementById('cf-options').value.split('\n').filter(l => l.trim().length > 0);
      }
      if (newBlock.block_type === 'true_false_ng') {
        newBlock.config.variant = document.getElementById('cf-variant').value;
      }

      if (isEditingBlock) blocks[blockIdx] = newBlock;
      else blocks.push(newBlock);

      modal.close();
      render();
    });
  };

  async function handleSave() {
    if (isSaving) return;
    isSaving = true;
    render();

    try {
      const totalQuestions = blocks.reduce((sum, b) => sum + (b.question_end - b.question_start + 1), 0);
      const examToSave = {
        ...examData,
        teacher_id: user.id,
        total_questions: totalQuestions,
        status: 'published', // Publish immediately for MVP
        updated_at: new Date().toISOString()
      };

      const savedExam = await exerciseService.saveExam(examToSave);
      const finalExamId = savedExam[0].id;

      // Save blocks
      const blocksToSave = blocks.map(b => ({
        ...b,
        exam_id: finalExamId
      }));

      // Delete old blocks if editing to avoid duplicates (SupabaseSave might handle it if they have IDs)
      await exerciseService.saveQuestionBlock(blocksToSave);

      showToast('Exam published successfully!', 'success');
      navigateTo('/exams');
    } catch (err) {
      showToast(err.message, 'error');
      isSaving = false;
      render();
    }
  }

  render();
}
