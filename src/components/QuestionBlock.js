import { escapeHtml } from '../utils/helpers.js';
import { renderAudioRecorder, setupAudioRecorder } from './AudioRecorder.js';

/**
 * QuestionBlock Component
 * Renders a group of questions based on block_type and config.
 * Used in ExamPlayer (Student) and potentially Preview (Teacher).
 */
export function renderQuestionBlock(block, options = {}) {
  const { 
    isReadOnly = false, 
    userAnswers = {}, // { questionNum: value }
    onAnswerChange = () => {} 
  } = options;

  const {
    block_type,
    question_start,
    question_end,
    instruction,
    config = {},
    context_text
  } = block;

  const questionNums = Array.from(
    { length: question_end - question_start + 1 }, 
    (_, i) => question_start + i
  );

  return `
    <div class="question-block mb-10 p-6 bg-white border border-gray-100 rounded-2xl shadow-sm animate-fade-in" data-block-id="${block.id}">
      <div class="flex items-center gap-3 mb-4">
        <span class="badge badge-primary px-3 py-1 text-xs font-bold">Questions ${question_start}–${question_end}</span>
        <span class="text-xxs font-black text-muted uppercase tracking-widest">${block_type.replace(/_/g, ' ')}</span>
      </div>
      
      ${instruction ? `<div class="block-instruction italic text-sm text-gray-600 mb-6 bg-blue-50/50 p-4 rounded-xl border border-blue-100">${escapeHtml(instruction)}</div>` : ''}

      ${context_text ? `<div class="block-context prose prose-sm max-w-none mb-6 p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">${escapeHtml(context_text)}</div>` : ''}

        ${questionNums.map(num => renderSingleQuestion(num, block, isReadOnly, userAnswers[num], onAnswerChange)).join('')}
      </div>
      
      <div class="mt-8 pt-4 border-t border-gray-50 flex items-center justify-between text-xxs font-black text-muted uppercase tracking-widest">
        <span>* Evidence & Notes help in review</span>
        <span class="text-blue-600">Tip: Link your proof here</span>
      </div>
    </div>
  `;
}

function renderSingleQuestion(num, block, isReadOnly, currentValue, onAnswerChange) {
  const { block_type, config = {} } = block;

  switch (block_type) {
    case 'fill_blank':
    case 'sentence_completion':
    case 'short_answer':
      return `
        <div class="question-item animate-fade-in" data-qnum="${num}">
          <div class="flex items-center gap-4">
            <span class="font-bold text-blue-600 min-w-[24px]">${num}.</span>
            <input type="text" 
              class="input flex-1 q-input" 
              data-qnum="${num}" 
              value="${escapeHtml(currentValue || '')}" 
              ${isReadOnly ? 'disabled' : ''}
              placeholder="..."
            />
            ${!isReadOnly ? `<button class="btn btn-ghost btn-xxs btn-note" data-qnum="${num}" title="Add Evidence">📝</button>` : ''}
          </div>
          <div class="note-container hidden mt-2 ml-10 animate-slide-up" id="note-${num}">
            <textarea class="input text-xxs p-3 bg-yellow-50/50 border-yellow-100 h-16 w-full q-note" data-qnum="${num}" placeholder="Link evidence from text here..."></textarea>
          </div>
        </div>
      `;

    case 'true_false_ng':
    case 'multiple_choice':
      const mcOptions = block_type === 'true_false_ng' 
        ? (config.variant === 'yes_no' ? ['YES', 'NO', 'NOT GIVEN'] : ['TRUE', 'FALSE', 'NOT GIVEN'])
        : (config.options || ['A', 'B', 'C', 'D']);

      return `
        <div class="question-item animate-fade-in" data-qnum="${num}">
          <div class="flex items-center justify-between mb-3">
            <div class="font-bold text-blue-600">${num}.</div>
            ${!isReadOnly ? `<button class="btn btn-ghost btn-xxs btn-note" data-qnum="${num}" title="Add Evidence">📝</button>` : ''}
          </div>
          <div class="flex flex-wrap gap-3">
            ${mcOptions.map(opt => {
              const val = opt.split('.')[0].trim(); // Extract letter A, B, C or label
              const isChecked = currentValue === val;
              return `
                <label class="flex-1 min-w-[120px]">
                  <input type="radio" name="q-${num}" value="${val}" class="hidden q-radio" ${isChecked ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}>
                  <div class="mc-option p-3 text-center border rounded-xl cursor-pointer transition-all hover:bg-blue-50 ${isChecked ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200'}">
                    ${escapeHtml(opt)}
                  </div>
                </label>
              `;
            }).join('')}
          </div>
          <div class="note-container hidden mt-4 animate-slide-up" id="note-${num}">
            <textarea class="input text-xxs p-3 bg-yellow-50/50 border-yellow-100 h-16 w-full q-note" data-qnum="${num}" placeholder="Link evidence from text here..."></textarea>
          </div>
        </div>
      `;

    case 'matching':
      const matchingOptions = config.options || [];
      return `
        <div class="question-item animate-fade-in" data-qnum="${num}">
          <div class="flex items-center gap-4">
            <span class="font-bold text-blue-600 min-w-[24px]">${num}.</span>
            <select class="input flex-1 q-select" data-qnum="${num}" ${isReadOnly ? 'disabled' : ''}>
              <option value="">-- Select option --</option>
              ${matchingOptions.map(opt => {
                const val = opt.split('.')[0].trim();
                return `<option value="${val}" ${currentValue === val ? 'selected' : ''}>${escapeHtml(opt)}</option>`;
              }).join('')}
            </select>
            ${!isReadOnly ? `<button class="btn btn-ghost btn-xxs btn-note" data-qnum="${num}" title="Add Evidence">📝</button>` : ''}
          </div>
          <div class="note-container hidden mt-2 ml-10 animate-slide-up" id="note-${num}">
            <textarea class="input text-xxs p-3 bg-yellow-50/50 border-yellow-100 h-16 w-full q-note" data-qnum="${num}" placeholder="Link evidence from text here..."></textarea>
          </div>
        </div>
      `;

    case 'multiple_select':
      const msOptions = config.options || [];
      const userArray = Array.isArray(currentValue) ? currentValue : [];
      return `
        <div class="question-item">
          <div class="font-bold text-blue-600 mb-3">${num}. (Choose ${config.select_count || 2})</div>
          <div class="grid grid-cols-2 gap-3">
            ${msOptions.map(opt => {
              const val = opt.split('.')[0].trim();
              const isChecked = userArray.includes(val);
              return `
                <label>
                  <input type="checkbox" value="${val}" class="hidden q-checkbox" name="q-${num}" ${isChecked ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}>
                  <div class="mc-option p-3 text-sm border rounded-xl cursor-pointer transition-all hover:bg-blue-50 ${isChecked ? 'border-blue-500 bg-blue-50 text-blue-700 font-bold' : 'border-gray-200'}">
                    ${escapeHtml(opt)}
                  </div>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      `;

    case 'writing_task1':
    case 'writing_task2':
      return `
        <div class="question-item space-y-4">
          <div class="flex items-center justify-between">
             <div class="font-bold text-blue-600">${num}. ${block_type === 'writing_task1' ? 'Task 1' : 'Task 2'} Essay</div>
             <div class="text-xxs font-mono text-muted uppercase">Word Count: <span class="q-word-count font-bold text-gray-800">0</span></div>
          </div>
          <textarea 
            class="input w-full h-80 p-6 text-md leading-relaxed q-textarea" 
            data-qnum="${num}"
            placeholder="Type your essay here..."
            ${isReadOnly ? 'disabled' : ''}
          >${escapeHtml(currentValue || '')}</textarea>
        </div>
      `;

    case 'speaking_part1':
    case 'speaking_part2':
    case 'speaking_part3':
      return `
        <div class="question-item space-y-4">
          <div class="font-bold text-blue-600">${num}. Speaking Response</div>
          ${isReadOnly && currentValue ? `
            <audio src="${currentValue}" controls class="w-full"></audio>
          ` : isReadOnly ? `
            <div class="p-6 bg-gray-50 rounded-xl text-center text-muted italic">No recording found</div>
          ` : `
            <div class="audio-recorder-container" data-qnum="${num}">
              ${renderAudioRecorder({ id: `rec-${num}` })}
            </div>
          `}
        </div>
      `;

    default:
      return `<div>Unsupported type: ${block_type}</div>`;
  }
}

/**
 * Attaches event listeners to the container to detect answer and note changes
 */
export function setupQuestionBlockEvents(container, callbacks = {}) {
  const { onAnswerChange = () => {}, onNoteChange = () => {} } = callbacks;
  
  // Use event delegation
  container.addEventListener('input', (e) => {
    const target = e.target;
    if (target.classList.contains('q-input')) {
      onAnswerChange(target.dataset.qnum, target.value);
    }
    if (target.classList.contains('q-textarea')) {
      const qNum = target.dataset.qnum;
      const text = target.value;
      const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
      const countEl = target.closest('.question-item')?.querySelector('.q-word-count');
      if (countEl) countEl.textContent = wordCount;
      onAnswerChange(qNum, text);
    }
    if (target.classList.contains('q-note')) {
      const qNum = target.dataset.qnum;
      onNoteChange(qNum, target.value);
    }
  });

  // Attach Audio Recorders
  container.querySelectorAll('.audio-recorder-container').forEach(div => {
    const qNum = div.dataset.qnum;
    setupAudioRecorder(div, (blob) => {
      onAnswerChange(qNum, blob);
    });
  });

  container.addEventListener('change', (e) => {
    const target = e.target;
    if (target.classList.contains('q-radio')) {
      onAnswerChange(target.name.replace('q-', ''), target.value);
    }
    if (target.classList.contains('q-select')) {
      onAnswerChange(target.dataset.qnum, target.value);
    }
    if (target.classList.contains('q-checkbox')) {
      const qNum = target.name.replace('q-', '');
      const selected = Array.from(container.querySelectorAll(`input[name="q-${qNum}"]:checked`)).map(el => el.value);
      onAnswerChange(qNum, selected);
    }
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-note');
    if (btn) {
      const qNum = btn.dataset.qnum;
      const noteEl = container.querySelector(`#note-${qNum}`);
      if (noteEl) noteEl.classList.toggle('hidden');
    }
  });
}
