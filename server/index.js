import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { validateVocabularyPayload } from './validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const rawEnvModel = process.env.GROQ_MODEL?.trim();
const DEFAULT_MODEL = rawEnvModel || 'openai/gpt-oss-120b';

// Active Groq candidate models in fallback order (excluding decommissioned models)
const CANDIDATE_MODELS = [
  DEFAULT_MODEL,
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
].filter((m, i, arr) => arr.indexOf(m) === i && !m.includes('mixtral'));

function cleanJsonContent(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const firstBrace = s.indexOf('{');
  const lastBrace = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    s = s.substring(firstBrace, lastBrace + 1);
  }
  return s.trim();
}

app.use(cors());
app.use(express.json());

// Health check endpoint for cloud platforms like Render
app.get(['/api/health', '/healthz'], (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'my-vocabulary-backend',
    timestamp: new Date().toISOString(),
  });
});

// Status endpoint: tells frontend if API key is configured without exposing it
app.get('/api/status', (req, res) => {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const isConfigured = Boolean(apiKey && apiKey !== 'your_groq_api_key_here');
  res.json({
    configured: isConfigured,
    model: DEFAULT_MODEL,
    message: isConfigured
      ? 'Groq API key is configured.'
      : 'GROQ_API_KEY not configured. Set your key in .env to add new words.',
  });
});

// Endpoint to generate beginner-friendly vocabulary quiz using Groq
async function handleVocabularyGeneration(req, res) {
  try {
    const { word, currentMeaning, currentExample, isRefresh } = req.body;

    if (!word || typeof word !== 'string' || !word.trim()) {
      return res.status(400).json({
        error: 'Please enter a valid English word.',
      });
    }

    const cleanWord = word.trim();
    if (cleanWord.length > 50) {
      return res.status(400).json({
        error: 'Word is too long. Please enter a single word or short phrase.',
      });
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      return res.status(503).json({
        error: 'Groq API key is not configured. Please open .env and set your GROQ_API_KEY.',
        hint: 'Get a free key at https://console.groq.com/keys',
      });
    }

    const isRefreshing = Boolean(isRefresh || currentMeaning);

    const prompt = isRefreshing
      ? `You are an expert, beginner-friendly English vocabulary tutor explaining words simply and naturally.
Target English word: "${cleanWord}"
Previous explanation: "${currentMeaning || ''}"
Previous example sentence: "${currentExample || ''}"

Goal: Provide a NOTICEABLY SIMPLER, EASIER, BEGINNER-FRIENDLY explanation for "${cleanWord}". Make it easier to understand than the previous explanation so a beginner understands immediately.

Requirements:
1. "word": "${cleanWord}" (keep original word unchanged with proper capitalization).
2. "meaning": Explain the complete meaning of the word (not just a synonym) in ONE short, simple, crystal-clear sentence using everyday English.
   - Format: "**${cleanWord}** means [simple everyday explanation with 2 to 4 key words in bold]."
   - Example: "**Compelled** means being **forced or required** to do something, even if you do not want to do it."
   - Bold the target word (**${cleanWord}**) and 2 to 4 important keywords (**phrase**).
   - Keep it short, natural, and conversational. Avoid complex vocabulary or long clauses.
3. "hindiMeaning": Give a simple, natural Hindi translation in everyday language.
   - Example: "मजबूर होना या किसी काम को करने के लिए विवश होना।"
4. "example": Give ONE short, realistic everyday English sentence showing how the word is used.
   - Example: "He was compelled to tell the truth."
   - Keep the example in clean plain text.
5. "options": Exactly 4 distinct multiple-choice definitions for what "${cleanWord}" means (array of 4 plain text strings, no markdown asterisks). One correct meaning, three clear distractors.
6. "correctIndex": Integer 0, 1, 2, or 3 pointing to the correct option.

Respond ONLY with a valid JSON object matching this schema:
{
  "word": "${cleanWord}",
  "meaning": "**${cleanWord}** means being **forced or required** to do something, even if you do not want to do it.",
  "example": "He was compelled to tell the truth.",
  "hindiMeaning": "मजबूर होना या किसी काम को करने के लिए विवश होना।",
  "options": [
    "being forced or required to do something",
    "feeling completely relaxed and calm",
    "showing great hesitation or doubt",
    "having a strong desire to learn"
  ],
  "correctIndex": 0
}`
      : `You are an expert, beginner-friendly English vocabulary tutor explaining words naturally like ChatGPT in conversation.
Target English word: "${cleanWord}"

Requirements:
1. "word": The target English word with proper capitalization (e.g. "${cleanWord}").
2. "meaning": Explain the word in ONE natural, complete, and easy-to-understand sentence using simple everyday English.
   - Format: "**${cleanWord}** means [natural explanation with 2 to 4 key words or phrases in bold]."
   - Example: "**Compelled** means being **forced or required** to do something because of a situation."
   - Explain the complete meaning, not just synonyms.
   - Bold the vocabulary word (**${cleanWord}**) and 2 to 4 important related words or phrases (**phrase**).
   - Exactly ONE natural conversational sentence. Avoid long paragraphs, complicated vocabulary, or unnecessary explanations.
3. "hindiMeaning": Give a simple, accurate, concise Hindi translation.
   - Example: "मजबूर होना / विवश होना।"
   - Use simple, natural everyday Hindi.
4. "example": Give ONE short, realistic everyday English sentence showing how the word is used.
   - Example: "He was compelled to leave because of the circumstances."
   - Keep the example in clean plain text (no bold asterisks).
5. "options": Exactly 4 distinct multiple-choice definitions for what "${cleanWord}" means (array of 4 plain text strings, no markdown asterisks). One correct meaning, three intelligent distractors.
6. "correctIndex": Integer 0, 1, 2, or 3 pointing to the correct option.

Respond ONLY with a valid JSON object matching this schema:
{
  "word": "${cleanWord}",
  "meaning": "**${cleanWord}** means being **forced or required** to do something because of a situation.",
  "example": "He was compelled to leave because of the circumstances.",
  "hindiMeaning": "मजबूर होना / विवश होना।",
  "options": [
    "being forced or required to do something",
    "feeling completely relaxed and calm",
    "showing great hesitation or doubt",
    "having a strong desire to learn"
  ],
  "correctIndex": 0
}`;

    let lastError = null;
    let successfulData = null;

    // Try candidate models with automatic fallback if a model is unavailable or rate-limited
    for (const model of CANDIDATE_MODELS) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a vocabulary tutor for beginners. Output ONLY a valid JSON object with word, meaning, example, options (array of exactly 4 strings), and correctIndex (integer 0-3). No markdown fences, no explanatory text.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: isRefreshing ? 0.6 : 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        if (!groqResponse.ok) {
          const errorText = await groqResponse.text();
          let errorMessage = `Groq API returned HTTP ${groqResponse.status}`;
          try {
            const errJson = JSON.parse(errorText);
            if (errJson.error?.message) {
              errorMessage = errJson.error.message;
            }
          } catch {
            // ignore
          }

          if (groqResponse.status === 401) {
            return res.status(401).json({
              error: 'Invalid Groq API key. Please check GROQ_API_KEY in your .env file.',
              details: errorMessage,
            });
          }

          // If rate limited or unavailable, try fallback model
          if (groqResponse.status === 429) {
            lastError = {
              status: 429,
              message: `Rate limit on ${model}: ${errorMessage}`,
            };
            continue; // Try next model in CANDIDATE_MODELS
          }

          // If model doesn't exist or is not supported, try next model
          if (
            groqResponse.status === 404 ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('do not have access')
          ) {
            lastError = { status: 404, message: errorMessage };
            continue;
          }

          lastError = { status: groqResponse.status, message: errorMessage };
          continue;
        }

        const data = await groqResponse.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (!rawContent) {
          lastError = { status: 502, message: 'Empty response received from Groq AI' };
          continue;
        }

        const cleaned = cleanJsonContent(rawContent);
        const parsed = JSON.parse(cleaned);
        const validated = validateVocabularyPayload(parsed);
        successfulData = validated;
        break; // Success!
      } catch (loopErr) {
        lastError = { status: 500, message: loopErr instanceof Error ? loopErr.message : String(loopErr) };
      }
    }

    if (!successfulData) {
      return res.status(lastError?.status || 502).json({
        error: 'Failed to generate vocabulary definition from Groq AI.',
        details: lastError?.message || 'None of the tested models were reachable.',
      });
    }

    return res.json(successfulData);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return res.status(500).json({
      error: 'An unexpected error occurred while processing the word.',
      details: message,
    });
  }
}

// Generate new word definition
app.post('/api/vocabulary/generate', handleVocabularyGeneration);

// Refresh existing word definition with fresh alternative wording
app.post('/api/vocabulary/refresh', (req, res) => {
  req.body.isRefresh = true;
  return handleVocabularyGeneration(req, res);
});

// Endpoint to generate definitions for a batch of up to 3 words
app.post('/api/vocabulary/generate-batch', async (req, res) => {
  try {
    const { words } = req.body;
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of words.' });
    }

    const cleanWords = words
      .map((w) => (typeof w === 'string' ? w.trim() : ''))
      .filter((w) => w.length >= 2 && w.length <= 50)
      .slice(0, 3); // Strictly 3 words per batch

    if (cleanWords.length === 0) {
      return res.status(400).json({ error: 'No valid words provided in batch.' });
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      return res.status(503).json({
        error: 'Groq API key is not configured on the server.',
      });
    }

    const prompt = `You are an expert English vocabulary tutor explaining words naturally like ChatGPT in conversation.
Target words to define: ${JSON.stringify(cleanWords)}

For EACH of the ${cleanWords.length} target words, generate a beginner-friendly definition entry:
1. "word": The target English word with proper capitalization.
2. "meaning": ONE natural, complete, and easy-to-understand sentence in simple everyday English.
   Format: "**[Word]** means [natural explanation with 2 to 4 key words or phrases in bold]."
   Example: "**Compelled** means being **forced or required** to do something because of a situation."
   Bold the vocabulary word and 2 to 4 key words/phrases. Exactly ONE sentence. No long paragraphs.
3. "hindiMeaning": Simple, accurate, concise Hindi translation.
   Example: "मजबूर होना / विवश होना।"
4. "example": ONE short, realistic everyday English sentence in clean plain text (no bold).
   Example: "He was compelled to leave because of the circumstances."
5. "options": Exactly 4 distinct multiple-choice definitions in plain text (no markdown asterisks). One correct meaning, three intelligent distractors.
6. "correctIndex": Integer 0, 1, 2, or 3 pointing to the correct option.

Respond ONLY with valid JSON matching this schema:
{
  "items": [
    {
      "word": "${cleanWords[0]}",
      "meaning": "**${cleanWords[0]}** means being **forced or required** to do something because of a situation.",
      "example": "He was compelled to leave because of the circumstances.",
      "hindiMeaning": "मजबूर होना / विवश होना।",
      "options": ["option 1", "option 2", "option 3", "option 4"],
      "correctIndex": 0
    }
  ]
}`;

    let lastError = null;
    let successfulItems = null;

    for (const model of CANDIDATE_MODELS) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a vocabulary tutor for beginners. Output ONLY a valid JSON object with "items" array containing word objects. No markdown code blocks, no commentary.',
              },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        if (!groqResponse.ok) {
          const errorText = await groqResponse.text();
          let errorMessage = `Groq API returned HTTP ${groqResponse.status}`;
          try {
            const errJson = JSON.parse(errorText);
            if (errJson.error?.message) errorMessage = errJson.error.message;
          } catch {}

          if (groqResponse.status === 401) {
            return res.status(401).json({ error: 'Invalid Groq API key.', details: errorMessage });
          }
          if (groqResponse.status === 429) {
            lastError = { status: 429, message: `Rate limit on ${model}: ${errorMessage}` };
            continue;
          }
          if (groqResponse.status === 404 || errorMessage.includes('does not exist') || errorMessage.includes('decommissioned')) {
            lastError = { status: 404, message: errorMessage };
            continue;
          }
          lastError = { status: groqResponse.status, message: errorMessage };
          continue;
        }

        const data = await groqResponse.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (!rawContent) {
          lastError = { status: 502, message: 'Empty response received from Groq AI' };
          continue;
        }

        const cleaned = cleanJsonContent(rawContent);
        let parsed;
        try {
          parsed = JSON.parse(cleaned);
        } catch (jsonErr) {
          lastError = { status: 502, message: 'Malformed JSON from AI: ' + jsonErr.message };
          continue;
        }

        const rawList = Array.isArray(parsed.items)
          ? parsed.items
          : Array.isArray(parsed)
          ? parsed
          : Object.values(parsed).find((v) => Array.isArray(v)) || [];

        if (!Array.isArray(rawList) || rawList.length === 0) {
          lastError = { status: 502, message: 'AI response did not contain items array' };
          continue;
        }

        const validatedList = [];
        for (const rawItem of rawList) {
          try {
            const valid = validateVocabularyPayload(rawItem);
            validatedList.push(valid);
          } catch (valErr) {
            console.warn('Skipping item failing validation:', rawItem?.word, valErr?.message);
          }
        }

        if (validatedList.length > 0) {
          successfulItems = validatedList;
          break; // Success!
        }
      } catch (loopErr) {
        lastError = { status: 500, message: loopErr instanceof Error ? loopErr.message : String(loopErr) };
      }
    }

    if (!successfulItems || successfulItems.length === 0) {
      return res.status(lastError?.status || 502).json({
        error: 'Failed to generate vocabulary batch from Groq AI.',
        details: lastError?.message || 'Could not validate generated word items.',
      });
    }

    return res.json({ items: successfulItems });
  } catch (err) {
    return res.status(500).json({
      error: 'An unexpected error occurred while processing batch.',
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

// Endpoint to generate intelligent, balanced quiz distractors for a word
app.post('/api/quiz/generate-distractors', async (req, res) => {
  try {
    const { word, meaning } = req.body;
    if (!word || !meaning || typeof word !== 'string' || typeof meaning !== 'string') {
      return res.status(400).json({ error: 'Please provide both word and meaning.' });
    }

    const cleanWord = word.trim();
    const cleanMeaning = meaning.trim();
    const apiKey = process.env.GROQ_API_KEY?.trim();

    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      return res.status(503).json({ error: 'Groq API key is not configured.' });
    }

    const prompt = `You are an expert vocabulary quiz designer creating challenging, fair multiple-choice quizzes.
Target Word: "${cleanWord}"
Accurate Meaning: "${cleanMeaning}"

Task:
Generate 3 intelligent, believable distractors (incorrect meanings) for "${cleanWord}".

Requirements:
1. The 3 distractors must belong to the SAME general semantic category, theme, or topic as "${cleanWord}", but must NOT be meanings of "${cleanWord}".
2. All 3 distractors MUST match the sentence structure, tone, level of detail, and length of the accurate meaning ("${cleanMeaning}").
3. Do NOT make the correct answer longer or more descriptive than the distractors.
4. Distractors must be sufficiently plausible that a student must actually understand the word.
5. Provide exactly 4 options in total: the 1 accurate meaning and the 3 distractors, shuffled randomly.
6. Provide correctIndex (integer 0 to 3) pointing to the accurate meaning.

Respond ONLY with a valid JSON object:
{
  "options": [
    "option 1",
    "option 2",
    "option 3",
    "option 4"
  ],
  "correctIndex": 1
}`;

    for (const model of CANDIDATE_MODELS) {
      try {
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'system',
                content: 'Output ONLY valid JSON with options (array of 4 strings) and correctIndex (integer 0-3). No markdown or explanation.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            temperature: 0.4,
            response_format: { type: 'json_object' },
          }),
        });

        if (!groqResponse.ok) continue;

        const data = await groqResponse.json();
        const rawContent = data.choices?.[0]?.message?.content;
        if (!rawContent) continue;

        const parsed = JSON.parse(cleanJsonContent(rawContent));
        if (Array.isArray(parsed.options) && parsed.options.length === 4) {
          const opts = parsed.options.map((o) => String(o).trim());
          const idx = Number(parsed.correctIndex);

          // Verify options are distinct
          if (new Set(opts.map((o) => o.toLowerCase())).size === 4 && Number.isInteger(idx) && idx >= 0 && idx <= 3) {
            // Guarantee final randomization
            const correctText = opts[idx];
            const shuffled = [...opts];
            for (let i = shuffled.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return res.json({
              options: shuffled,
              correctIndex: shuffled.indexOf(correctText),
            });
          }
        }
      } catch {
        continue;
      }
    }

    return res.status(502).json({ error: 'Could not generate AI distractors at this time.' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to process distractor request.' });
  }
});

// ─── AI Story Generator Helper Functions & Cooldown Management ───
const storyCooldowns = new Map();
const STORY_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function getClientIdentifier(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'anonymous-client';
}

function getRemainingCooldown(req) {
  const clientKey = getClientIdentifier(req);
  const lastTime = storyCooldowns.get(clientKey);
  if (!lastTime) return 0;
  const elapsed = Date.now() - lastTime;
  if (elapsed >= STORY_COOLDOWN_MS) {
    storyCooldowns.delete(clientKey);
    return 0;
  }
  return Math.ceil((STORY_COOLDOWN_MS - elapsed) / 1000);
}

function recordSuccessfulStory(req) {
  const clientKey = getClientIdentifier(req);
  storyCooldowns.set(clientKey, Date.now());
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Robust Groq call with retries and exponential backoff.
 */
async function callGroqWithRetry(apiKey, messages, { maxTokens = 2000, temperature = 0.8, preferredModels = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'openai/gpt-oss-120b'] } = {}) {
  let lastError = null;

  for (const model of preferredModels) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 55000);

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.status === 429) {
          // Rate limit - wait with backoff
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }

        if (res.status >= 500) {
          // Server error - wait or try next attempt
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          throw new Error(errData?.error?.message || `Groq API responded with HTTP ${res.status}`);
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content?.trim() || '';
        if (content) return content;
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') {
          // Timeout, break to next model
          break;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }

  throw lastError || new Error('All Groq candidate models failed to respond.');
}

/**
 * High-quality multi-stage story generator supporting 5 to 200+ vocabulary words.
 * Implements internal planning, character consistency, natural emoji use,
 * and contextual vocabulary integration modeled after "The Journey of a Resilient Young Entrepreneur".
 */
async function executeMultiStageStoryGeneration(apiKey, words, onProgress) {
  const cleanWords = words
    .filter((w) => w && w.word)
    .map((w) => ({
      word: String(w.word).trim(),
      meaning: String(w.meaning || '').trim(),
    }));

  if (cleanWords.length === 0) {
    throw new Error('No valid vocabulary words provided.');
  }

  const totalWords = cleanWords.length;
  onProgress(5, 'Preparing saved vocabulary...');

  // Group words into batches of 15-20 words per scene to prevent context overflow
  const CHUNK_SIZE = Math.min(20, Math.max(12, Math.ceil(totalWords / Math.ceil(totalWords / 18))));
  const chunks = [];
  for (let i = 0; i < cleanWords.length; i += CHUNK_SIZE) {
    chunks.push(cleanWords.slice(i, i + CHUNK_SIZE));
  }

  const numChunks = chunks.length;
  onProgress(10, 'Planning storyline, characters & scenes...');

  // Stage 1: Architectural Story Planning
  // Plan overarching story premise, characters, setting, and scene breakdown
  const sampleWordsPreview = cleanWords
    .slice(0, Math.min(25, cleanWords.length))
    .map((w) => `"${w.word}" (${w.meaning})`)
    .join(', ');

  const planPrompt = `You are an acclaimed creative author designing a story for English vocabulary learners.
Benchmark style: "The Journey of a Resilient Young Entrepreneur" — inspiring, relatable, humorous, heartfelt.

Total Vocabulary Words to include across the full story: ${totalWords}.
Sample words include: ${sampleWordsPreview}.

Task: Create an architectural story plan for a continuous story spanning ${numChunks} connected scene${numChunks > 1 ? 's' : ''}:
1. Story Title (catchy, 3-6 words, creative, NO asterisks).
2. Main Character (relatable protagonist name, their passion or profession, personality trait).
3. Setting (a vibrant, descriptive setting where events unfold naturally).
4. Central Conflict / Quest (a challenge that tests their perseverance, trust, or creativity).
5. Outline for ${numChunks} scene${numChunks > 1 ? 's' : ''} describing the progression from beginning to a meaningful resolution.

Respond ONLY with valid JSON:
{
  "title": "A Great Catchy Title",
  "protagonist": "Character name and personality details",
  "setting": "Specific setting description",
  "conflict": "The central obstacle or mission",
  "sceneGoals": [
    "Scene 1 goal: Introduction to character, setting, and initial spark",
    "Scene 2 goal: The obstacle emerges..."
  ]
}`;

  let storyTitle = 'The Journey of a Resilient Spirit';
  let protagonist = 'Alex, a dedicated and optimistic creator';
  let setting = 'A lively historic coastal town bustling with small workshops';
  let conflict = 'Building a community initiative against unexpected setbacks';
  let sceneGoals = [];

  try {
    const planRaw = await callGroqWithRetry(
      apiKey,
      [
        { role: 'system', content: 'You are an expert story planner. Always return valid JSON only.' },
        { role: 'user', content: planPrompt },
      ],
      { maxTokens: 800, temperature: 0.78 }
    );
    const cleaned = cleanJsonContent(planRaw);
    const parsed = JSON.parse(cleaned);
    if (parsed.title) storyTitle = parsed.title.replace(/\*\*/g, '').trim();
    if (parsed.protagonist) protagonist = parsed.protagonist.trim();
    if (parsed.setting) setting = parsed.setting.trim();
    if (parsed.conflict) conflict = parsed.conflict.trim();
    if (Array.isArray(parsed.sceneGoals)) sceneGoals = parsed.sceneGoals;
  } catch {
    // Graceful fallback defaults
  }

  const storySections = [];

  // Stage 2: Sequential Section Generation following the plan
  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    const chunkPct = 15 + Math.round(((chunkIndex) / numChunks) * 65);
    const statusMsg =
      numChunks === 1
        ? 'Writing your story and integrating vocabulary...'
        : `Writing scene ${chunkIndex + 1} of ${numChunks}...`;

    onProgress(chunkPct, statusMsg);

    const chunkWordList = chunk.map((w, idx) => `${idx + 1}. **${w.word}** — Meaning: ${w.meaning}`).join('\n');
    const isFirst = chunkIndex === 0;
    const isLast = chunkIndex === numChunks - 1;
    const currentSceneGoal = sceneGoals[chunkIndex] || (isFirst ? 'Establish character and starting dilemma' : isLast ? 'Bring the journey to an uplifting resolution' : 'Overcome new hurdles through teamwork');

    let sectionPrompt = '';
    if (isFirst) {
      sectionPrompt = `Story Title: "${storyTitle}"
Protagonist: ${protagonist}
Setting: ${setting}
Central Mission: ${conflict}
Scene 1 Goal: ${currentSceneGoal}

Target Vocabulary Words for this scene (${chunk.length} words):
${chunkWordList}

STORYTELLING & FORMATTING RULES:
1. Write the opening section of this continuous story in simple, natural, everyday English.
2. Naturally integrate EVERY target vocabulary word in an authentic context that matches its true meaning and part of speech. Do NOT write dictionary definition sentences.
3. Every time one of the target vocabulary words appears, enclose it in double asterisks like **word**.
4. Use story-appropriate emojis naturally (e.g. 🌞 for morning, ⚡ for surprise, 😄 for humor, 🤝 for friendship/teamwork, 🚀 for milestone, ❤️ for kindness, 🌱 for growth). Use 1-3 emojis per scene where they fit best.
5. Do NOT include section headers, chapter labels, or markdown titles. Start directly with the narrative prose.
${isLast ? 'Bring the story to a satisfying, meaningful conclusion.' : 'End this scene at a natural transition point seamlessly leading to the next event.'}
Approximate length: ${Math.max(160, chunk.length * 24)} words.`;
    } else {
      const prevContext = storySections[storySections.length - 1].slice(-500);
      sectionPrompt = `Story Title: "${storyTitle}"
Protagonist: ${protagonist}
Setting: ${setting}
Overall Conflict: ${conflict}
Scene ${chunkIndex + 1} Goal: ${currentSceneGoal}

Previous Scene Narrative (for seamless continuity):
"...${prevContext}"

Target Vocabulary Words for this scene (${chunk.length} words):
${chunkWordList}

STORYTELLING & FORMATTING RULES:
1. Continue this exact story seamlessly from where the previous scene left off. Maintain the exact same characters, setting, dialogue, and engaging tone.
2. Naturally integrate EVERY target vocabulary word in an authentic context that makes sense.
3. Every time one of the target vocabulary words appears, enclose it in double asterisks like **word**.
4. Use emojis naturally where appropriate (⚡, 😄, 🤝, 🚀, ❤️, 🌱).
5. Do NOT write "Part ${chunkIndex + 1}" or any headings. Continue the prose directly.
${isLast ? 'Conclude the story with a satisfying, memorable resolution and positive lesson.' : 'End at a natural transition leading to the next step.'}
Approximate length: ${Math.max(160, chunk.length * 24)} words.`;
    }

    const sectionContent = await callGroqWithRetry(
      apiKey,
      [
        {
          role: 'system',
          content:
            'You are an award-winning creative author writing engaging, accessible fiction for English vocabulary learners. Your reference is "The Journey of a Resilient Young Entrepreneur". Write continuous, natural prose with target words in **bold**.',
        },
        { role: 'user', content: sectionPrompt },
      ],
      { maxTokens: 1400, temperature: 0.8 }
    );

    // Clean any accidental markdown headers or code fences
    const cleanedSection = sectionContent
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/\s*```$/i, '')
      .replace(/^(Part \d+|Chapter \d+|Section \d+|Scene \d+)[:\s-]*/gim, '')
      .trim();

    storySections.push(cleanedSection);
  }

  // Stage 3: Verification of Vocabulary Coverage
  onProgress(82, 'Checking vocabulary coverage & context...');
  let combinedStory = storySections.join('\n\n').trim();

  // Find any omitted words
  const missingWords = cleanWords.filter((w) => {
    const reg = new RegExp(`\\b${escapeRegex(w.word)}\\b`, 'i');
    return !reg.test(combinedStory);
  });

  if (missingWords.length > 0 && missingWords.length <= 25) {
    onProgress(88, `Integrating ${missingWords.length} vocabulary word${missingWords.length === 1 ? '' : 's'} naturally...`);
    const missingList = missingWords.map((w, idx) => `${idx + 1}. **${w.word}** — ${w.meaning}`).join('\n');
    const revisionPrompt = `Here is the current concluding part of our story about ${protagonist}:
"${combinedStory.slice(-500)}"

Task: Write a smooth 1-2 paragraph epilogue to naturally conclude the story while authentically incorporating these remaining vocabulary words:
${missingList}

Rules:
1. Enclose each vocabulary word in double asterisks like **word**.
2. Use every word naturally according to its true meaning in natural sentences.
3. Flow directly from the story with natural emojis (🌱, ❤️, 🚀). No headers.`;

    try {
      const epilogue = await callGroqWithRetry(
        apiKey,
        [
          { role: 'system', content: 'You are a master creative writer. Write heartwarming, concise paragraphs.' },
          { role: 'user', content: revisionPrompt },
        ],
        { maxTokens: 700, temperature: 0.78 }
      );
      const cleanEpilogue = epilogue
        .replace(/^```[a-z]*\s*/i, '')
        .replace(/\s*```$/i, '')
        .replace(/^(Epilogue|Conclusion)[:\s-]*/gim, '')
        .trim();
      combinedStory += '\n\n' + cleanEpilogue;
    } catch {
      // Continue safely
    }
  }

  // Stage 4: Grammar check and bold word formatting
  onProgress(94, 'Finalizing your complete story...');

  // Ensure any saved word in the text has **word** formatting if asterisks were dropped by the model
  for (const w of cleanWords) {
    const regex = new RegExp(`(?<!\\*\\*)\\b(${escapeRegex(w.word)})\\b(?!\\*\\*)`, 'gi');
    combinedStory = combinedStory.replace(regex, '**$1**');
  }

  // Calculate words successfully used
  const wordsUsedList = cleanWords.filter((w) => {
    const reg = new RegExp(`\\b${escapeRegex(w.word)}\\b`, 'i');
    return reg.test(combinedStory);
  });

  onProgress(100, 'Story ready!');

  return {
    title: storyTitle,
    story: combinedStory,
    wordsUsed: wordsUsedList,
    wordsUsedCount: wordsUsedList.length,
    totalWords: cleanWords.length,
  };
}

// ─── Cooldown Status Endpoint ───
app.get('/api/story/cooldown', (req, res) => {
  const remaining = getRemainingCooldown(req);
  res.json({ cooldownSeconds: remaining });
});

// ─── AI Story Generator (SSE Streaming Endpoint) ───
app.post('/api/story/generate-stream', async (req, res) => {
  try {
    const remainingCooldown = getRemainingCooldown(req);
    if (remainingCooldown > 0) {
      return res.status(429).json({
        error: `Please wait ${remainingCooldown}s before generating another story.`,
        cooldownSeconds: remainingCooldown,
      });
    }

    const { words } = req.body;
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of vocabulary words.' });
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      return res.status(503).json({ error: 'Groq API key is not configured on the server.' });
    }

    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const sendEvent = (eventData) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(eventData)}\n\n`);
      }
    };

    try {
      const result = await executeMultiStageStoryGeneration(
        apiKey,
        words,
        (percent, status) => {
          sendEvent({ type: 'progress', percent, status });
        }
      );

      // Record successful cooldown
      recordSuccessfulStory(req);

      sendEvent({
        type: 'complete',
        title: result.title,
        story: result.story,
        wordsUsed: result.wordsUsed,
        wordsUsedCount: result.wordsUsedCount,
        totalWords: result.totalWords,
      });
      res.end();
    } catch (genErr) {
      sendEvent({
        type: 'error',
        message: genErr.message || 'Story generation failed. Please try again.',
      });
      res.end();
    }
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to initialize story stream.' });
    }
    res.end();
  }
});

// ─── AI Story Generator (Standard Fallback Endpoint) ───
app.post('/api/story/generate', async (req, res) => {
  try {
    const remainingCooldown = getRemainingCooldown(req);
    if (remainingCooldown > 0) {
      return res.status(429).json({
        error: `Please wait ${remainingCooldown}s before generating another story.`,
        cooldownSeconds: remainingCooldown,
      });
    }

    const { words } = req.body;
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of vocabulary words.' });
    }

    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
      return res.status(503).json({ error: 'Groq API key is not configured on the server.' });
    }

    const result = await executeMultiStageStoryGeneration(apiKey, words, () => {});
    recordSuccessfulStory(req);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to process story generation request.' });
  }
});

// Serve frontend build if dist folder exists
const distPath = path.resolve(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Backend Proxy] Listening on port ${PORT}`);
});

