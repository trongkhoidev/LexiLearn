/* ============================================
   LexiLearn — AI Gateway Service
   ============================================
   Central routing layer for all AI calls.
   Routes tasks to the optimal model provider:
   - Groq (Llama 3.3 70B): Speed-critical tasks (vocab, tooltips, distractors)
   - DeepSeek (R1/V3): Reasoning-heavy tasks (Writing/Speaking grading)
   - Gemini (1.5/2.5 Flash): Vision tasks & fallback (Cambridge PDF parsing)
*/

// ─── Provider Config ────────────────────────────────────────────────
const PROVIDERS = {
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama-3.3-70b-versatile',
    keyName: 'lexilearn_groq_key',
    format: 'openai', // Uses OpenAI-compatible format
  },
  deepseek: {
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    keyName: 'lexilearn_deepseek_key',
    format: 'openai',
  },
  gemini: {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-2.0-flash',
    keyName: 'lexilearn_gemini_key',
    format: 'gemini',
  },
};

// ─── Task → Provider Routing ────────────────────────────────────────
const TASK_ROUTING = {
  // Groq primary (speed)
  vocab_extract:      { primary: 'groq', backup: 'gemini' },
  passage_insights:   { primary: 'groq', backup: 'gemini' },
  tooltip:            { primary: 'groq', backup: 'gemini' },
  answer_validation:  { primary: 'groq', backup: 'gemini' },
  distractors:        { primary: 'groq', backup: 'gemini' },
  speaking_prompt:    { primary: 'groq', backup: 'gemini' },
  exercise_gen:       { primary: 'groq', backup: 'deepseek' },
  exam_blocks:        { primary: 'groq', backup: 'gemini' },

  // DeepSeek primary (reasoning)
  writing_grade:      { primary: 'deepseek', backup: 'groq' },
  speaking_eval:      { primary: 'deepseek', backup: 'groq' },
  speaking_eval_full: { primary: 'deepseek', backup: 'groq' },

  // Gemini primary (vision / PDF)
  cambridge_parse:    { primary: 'gemini', backup: 'groq' },
};

// ─── Key Management ─────────────────────────────────────────────────

function getProviderKey(providerName) {
  const provider = PROVIDERS[providerName];
  if (!provider) return null;

  // 1. Check direct key
  const directKey = localStorage.getItem(provider.keyName);
  if (directKey) return directKey;

  // 2. Fallback to settings object
  try {
    const settings = JSON.parse(localStorage.getItem('lexilearn_settings') || '{}');
    const settingsKeyMap = {
      groq: 'groqApiKey',
      deepseek: 'deepseekApiKey',
      gemini: 'geminiApiKey',
    };
    const key = settings[settingsKeyMap[providerName]];
    if (key) return key;
  } catch {}

  // 3. Fallback to Vite environment variables
  const envKeyMap = {
    groq: import.meta.env.VITE_GROQ_API_KEY,
    deepseek: import.meta.env.VITE_DEEPSEEK_API_KEY,
    gemini: import.meta.env.VITE_GEMINI_API_KEY,
  };
  const envKey = envKeyMap[providerName];
  if (envKey) return envKey;

  return null;
}

// ─── Provider Call Adapters ─────────────────────────────────────────

async function callOpenAI(provider, prompt, options = {}) {
  const apiKey = getProviderKey(provider);
  if (!apiKey) throw new Error(`${PROVIDERS[provider].name} API key not configured. Go to Settings to add it.`);

  const config = PROVIDERS[provider];
  const messages = [
    { role: 'system', content: options.systemPrompt || 'You are a helpful assistant. Return ONLY valid JSON unless instructed otherwise.' },
    { role: 'user', content: prompt },
  ];

  const body = {
    model: options.model || config.model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens || 4096,
  };

  // Request JSON output if supported
  if (options.jsonMode !== false) {
    body.response_format = { type: 'json_object' };
  }

  const response = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = errorData.error?.message || `${config.name} API Error: ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${config.name} returned an empty response.`);

  if (options.jsonMode !== false) {
    try {
      return JSON.parse(text.replace(/```json\n?|```/g, '').trim());
    } catch (e) {
      console.error(`Malformed JSON from ${config.name}:`, text);
      throw new Error(`Failed to parse ${config.name} response as JSON.`);
    }
  }
  return text;
}

async function callGemini(prompt, options = {}) {
  const apiKey = getProviderKey('gemini');
  if (!apiKey) throw new Error('Gemini API key not configured. Go to Settings to add it.');

  const config = PROVIDERS.gemini;
  const model = options.model || config.model;
  const url = `${config.baseUrl}/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
    },
  };

  if (options.jsonMode !== false) {
    body.generationConfig.response_mime_type = 'application/json';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const msg = errorData.error?.message || `Gemini API Error: ${response.status}`;
    const err = new Error(msg);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response.');

  if (options.jsonMode !== false) {
    try {
      return JSON.parse(text.replace(/```json\n?|```/g, '').trim());
    } catch (e) {
      console.error('Malformed JSON from Gemini:', text);
      throw new Error('Failed to parse Gemini response as JSON.');
    }
  }
  return text;
}

// ─── Main Gateway ───────────────────────────────────────────────────

/**
 * Central AI call with automatic fallback.
 * @param {string} task - Task key from TASK_ROUTING (e.g. 'vocab_extract', 'writing_grade')
 * @param {string} prompt - The full prompt text
 * @param {object} options - { temperature, maxTokens, jsonMode, model, systemPrompt }
 * @returns {Promise<any>} Parsed JSON response (or raw text if jsonMode=false)
 */
export async function callAI(task, prompt, options = {}) {
  const route = TASK_ROUTING[task];
  if (!route) {
    console.warn(`Unknown AI task "${task}", defaulting to Gemini.`);
    return callGemini(prompt, options);
  }

  const tryProvider = async (providerName) => {
    const config = PROVIDERS[providerName];
    if (!config) throw new Error(`Unknown provider: ${providerName}`);

    if (config.format === 'openai') {
      return await callOpenAI(providerName, prompt, options);
    } else {
      return await callGemini(prompt, options);
    }
  };

  // Try primary
  try {
    const primaryKey = getProviderKey(route.primary);
    if (!primaryKey && route.backup) {
      console.warn(`No API key for ${route.primary}, trying backup ${route.backup}`);
      return await tryProvider(route.backup);
    }
    return await tryProvider(route.primary);
  } catch (primaryErr) {
    console.warn(`Primary (${route.primary}) failed for task "${task}":`, primaryErr.message);

    // Fallback to backup
    if (route.backup) {
      try {
        console.log(`Falling back to ${route.backup} for task "${task}"...`);
        return await tryProvider(route.backup);
      } catch (backupErr) {
        console.error(`Backup (${route.backup}) also failed:`, backupErr.message);
        throw backupErr;
      }
    }
    throw primaryErr;
  }
}

// ─── Convenience Exports ────────────────────────────────────────────

export { getProviderKey, PROVIDERS, TASK_ROUTING };
