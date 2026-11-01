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
 * Implements internal planning, character consistency, natural emoji use, Hindi meaning support,
 * vocabulary validation summary, and contextual vocabulary integration modeled after
 * "The Journey of a Resilient Young Entrepreneur".
 */
async function executeMultiStageStoryGeneration(apiKey, words, onProgress) {
  // Stage 0: Clean and normalise input — support { word, meaning, hindiMeaning? }
  const cleanWords = words
    .filter((w) => w && w.word)
    .map((w) => ({
      word: String(w.word).trim(),
      meaning: String(w.meaning || '').trim(),
      hindiMeaning: w.hindiMeaning ? String(w.hindiMeaning).trim() : undefined,
    }));

  if (cleanWords.length === 0) {
    throw new Error('No valid vocabulary words provided.');
  }

  const totalWords = cleanWords.length;
  onProgress(3, 'Analyzing your vocabulary words...');

  // Stage 1: Vocabulary analysis — classify each word by likely part of speech
  onProgress(8, 'Building vocabulary reference map...');

  function classifyWordPos(meaning) {
    const m = meaning.toLowerCase();
    if (/\ba person who\b|\bsomeone who\b|\bone who\b/.test(m)) return 'noun/person';
    if (/^to |\bthe act of\b|\bprocess of\b/.test(m)) return 'verb';
    if (/\bfull of\b|\bhaving the quality\b|\bcharacterized by\b/.test(m)) return 'adjective';
    if (/\bin a .+ manner\b|\bthe state of being\b/.test(m)) return 'adverb/noun';
    return 'general';
  }

  // Build vocabulary reference map: word → { meaning, hindiMeaning, pos }
  const vocabRefMap = new Map();
  for (const w of cleanWords) {
    vocabRefMap.set(w.word.toLowerCase(), {
      meaning: w.meaning,
      hindiMeaning: w.hindiMeaning,
      pos: classifyWordPos(w.meaning),
    });
  }

  // Group words into chunks of 12–20 per scene
  const CHUNK_SIZE = Math.min(20, Math.max(12, Math.ceil(totalWords / Math.ceil(totalWords / 18))));
  const chunks = [];
  for (let i = 0; i < cleanWords.length; i += CHUNK_SIZE) {
    chunks.push(cleanWords.slice(i, i + CHUNK_SIZE));
  }
  const numChunks = chunks.length;

  // Stage 2: Story planning — rich JSON blueprint
  onProgress(13, 'Planning story structure, characters & scenes...');

  const fullWordList = cleanWords
    .map((w, idx) => `${idx + 1}. "${w.word}" — ${w.meaning}${w.hindiMeaning ? ` (Hindi: ${w.hindiMeaning})` : ''}`)
    .join('\n');

  const planPrompt = `You are an acclaimed creative writing expert designing a vocabulary learning story.

Reference quality standard: "The Journey of a Resilient Young Entrepreneur" — inspiring, relatable, humorous, heartfelt, natural dialogue, real-life problems.

VOCABULARY WORDS TO INCLUDE (${totalWords} total):
${fullWordList}

Your task: Create a detailed story blueprint.

STRICT RULES:
1. Choose protagonist and supporting character names that are NORMAL human names (e.g. Arjun, Priya, Sam, Mei). Names must NOT be any of the vocabulary words.
2. Every vocabulary word must be assigned to a specific scene based on its ACTUAL MEANING and appropriate context.
3. Words describing emotions go in emotional scenes. Business/work words go in professional scenes. Nature words in outdoor scenes. Etc.
4. The story must have a clear beginning (introduction + problem), middle (challenges + growth), and end (resolution + lesson).

Return ONLY valid JSON:
{
  "title": "Catchy 3-6 word story title (no asterisks)",
  "protagonist": "Name + brief personality (e.g. 'Arjun, a curious and determined young teacher')",
  "supportingChars": ["Character 2 name + role", "Character 3 name + role"],
  "setting": "Vivid, specific setting description",
  "conflict": "Central challenge or quest that drives the story",
  "lesson": "The meaningful lesson or theme",
  "scenes": [
    {
      "goal": "What happens in this scene",
      "tone": "emotional|humorous|tense|inspiring|reflective",
      "wordAssignments": ["word1", "word2"]
    }
  ]
}`;

  let storyTitle = 'The Journey of a Resilient Spirit';
  let protagonist = 'Arjun, a dedicated and optimistic creator';
  let supportingChars = ['Priya, a wise mentor', 'Sam, a cheerful friend'];
  let setting = 'A lively historic coastal town bustling with small workshops';
  let conflict = 'Building a community initiative against unexpected setbacks';
  let lesson = 'Perseverance and empathy lead to meaningful growth';
  let sceneGoals = [];
  let sceneTones = [];

  try {
    const planRaw = await callGroqWithRetry(
      apiKey,
      [
        { role: 'system', content: 'You are an expert story planner. Always return valid JSON only.' },
        { role: 'user', content: planPrompt },
      ],
      { maxTokens: 1200, temperature: 0.78 }
    );
    const cleaned = cleanJsonContent(planRaw);
    const parsed = JSON.parse(cleaned);
    if (parsed.title) storyTitle = parsed.title.replace(/\*\*/g, '').trim();
    if (parsed.protagonist) protagonist = parsed.protagonist.trim();
    if (Array.isArray(parsed.supportingChars) && parsed.supportingChars.length > 0) {
      supportingChars = parsed.supportingChars;
    }
    if (parsed.setting) setting = parsed.setting.trim();
    if (parsed.conflict) conflict = parsed.conflict.trim();
    if (parsed.lesson) lesson = parsed.lesson.trim();
    if (Array.isArray(parsed.scenes)) {
      sceneGoals = parsed.scenes.map((s) => s.goal || '');
      sceneTones = parsed.scenes.map((s) => s.tone || 'inspiring');
    }
  } catch {
    // Graceful fallback defaults
  }

  const storySections = [];

  // Stage 3: Sequential scene generation — track used words, pass remaining to later scenes
  const usedWordSet = new Set();

  for (let chunkIndex = 0; chunkIndex < numChunks; chunkIndex++) {
    const chunk = chunks[chunkIndex];
    const sceneNum = chunkIndex + 1;
    const totalScenes = numChunks;
    const isFirst = chunkIndex === 0;
    const isLast = chunkIndex === numChunks - 1;

    // Progress: linear from 18% to 80% across all scenes
    const scenePct = 18 + Math.round((chunkIndex / numChunks) * 62);
    onProgress(scenePct, `Writing scene ${sceneNum} of ${totalScenes}...`);

    const sceneGoal = sceneGoals[chunkIndex] || (isFirst ? 'Establish character and starting dilemma' : isLast ? 'Bring the journey to an uplifting resolution' : 'Overcome new hurdles through teamwork');
    const sceneTone = sceneTones[chunkIndex] || 'inspiring';
    const targetWordCount = Math.max(160, chunk.length * 24);

    const chunkWordList = chunk
      .map((w, idx) => `${idx + 1}. **${w.word}** — Meaning: ${w.meaning}${w.hindiMeaning ? ` (Hindi: ${w.hindiMeaning})` : ''}`)
      .join('\n');

    const prevContext = !isFirst ? storySections[storySections.length - 1].slice(-500) : '';

    const sectionPrompt = `STORY: "${storyTitle}"
PROTAGONIST: ${protagonist}
SUPPORTING CHARACTERS: ${supportingChars.join(', ')}
SETTING: ${setting}
CENTRAL CONFLICT: ${conflict}
STORY LESSON: ${lesson}

SCENE ${sceneNum} OF ${totalScenes} — ${sceneTone.toUpperCase()} TONE
Scene Goal: ${sceneGoal}

${!isFirst ? `PREVIOUS SCENE ENDING:\n"...${prevContext}"\n\nContinue seamlessly from this exact point.\n` : ''}
VOCABULARY WORDS FOR THIS SCENE (use ALL of these, each marked **word**):
${chunkWordList}

STORYTELLING RULES:
1. Write natural, flowing prose — NOT a list of sentences with words forced in.
2. Use EVERY vocabulary word authentically based on its true meaning: ${chunkWordList.replace(/\n/g, '; ')}
3. Mark every vocabulary word with **double asterisks** like **compassion** or **persevere**.
4. Include natural dialogue ("..."), character reactions, sensory details.
5. Use 1-2 contextually appropriate emojis (🌞 morning/hope, ⚡ surprise, 😄 funny, 🤝 teamwork, 🚀 achievement, ❤️ emotion, 🌱 growth, 🎉 celebration).
6. NO section headers, NO "Part N", NO chapter labels. Pure prose.
7. Grammar must be natural and correct.
8. Scene length: ${targetWordCount} words approximately.
${isLast ? '9. Bring the story to a satisfying, complete, meaningful conclusion.' : '9. End at a natural moment that flows into the next scene.'}`;

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

    // Track which words were successfully used in this scene
    for (const w of chunk) {
      const reg = new RegExp(`\\b${escapeRegex(w.word)}\\b`, 'i');
      if (reg.test(cleanedSection)) {
        usedWordSet.add(w.word.toLowerCase());
      }
    }

    storySections.push(cleanedSection);
  }

  // Stage 4: Validation pass — build validation records
  onProgress(83, 'Running vocabulary coverage check...');
  let combinedStory = storySections.join('\n\n').trim();

  const validationRecords = cleanWords.map((w) => {
    const wordRegex = new RegExp(`\\b${escapeRegex(w.word)}\\b`, 'gi');
    const matches = [...combinedStory.matchAll(wordRegex)];

    if (matches.length === 0) {
      return { word: w.word, status: 'missing', sentence: null, expectedMeaning: w.meaning };
    }

    // Extract the sentence containing the first match
    const matchIndex = combinedStory.search(new RegExp(`\\b${escapeRegex(w.word)}\\b`, 'i'));
    const sentenceStart = Math.max(0, combinedStory.lastIndexOf('.', matchIndex) + 1);
    const sentenceEnd = combinedStory.indexOf('.', matchIndex + w.word.length);
    const sentence = combinedStory
      .slice(sentenceStart, sentenceEnd > 0 ? sentenceEnd + 1 : sentenceStart + 200)
      .trim();

    return { word: w.word, expectedMeaning: w.meaning, sentence, status: 'used' };
  });

  const missingFromValidation = validationRecords.filter((r) => r.status === 'missing');
  const usedFromValidation = validationRecords.filter((r) => r.status === 'used');

  // Stage 5: Missing/failed word integration — weave unfound words into natural extended passages
  if (missingFromValidation.length > 0 && missingFromValidation.length <= 25) {
    onProgress(88, `Integrating ${missingFromValidation.length} missing vocabulary word${missingFromValidation.length === 1 ? '' : 's'} naturally...`);
    const missingList = missingFromValidation
      .map((r, idx) => `${idx + 1}. **${r.word}** — ${r.expectedMeaning}`)
      .join('\n');
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

      // Update validation records for words that are now present
      for (const record of validationRecords) {
        if (record.status === 'missing') {
          const checkRegex = new RegExp(`\\b${escapeRegex(record.word)}\\b`, 'i');
          if (checkRegex.test(cleanEpilogue)) {
            record.status = 'used';
            const matchIndex = cleanEpilogue.search(checkRegex);
            const sentenceStart = Math.max(0, cleanEpilogue.lastIndexOf('.', matchIndex) + 1);
            const sentenceEnd = cleanEpilogue.indexOf('.', matchIndex + record.word.length);
            record.sentence = cleanEpilogue
              .slice(sentenceStart, sentenceEnd > 0 ? sentenceEnd + 1 : sentenceStart + 200)
              .trim();
          }
        }
      }
    } catch {
      // Continue safely
    }
  }

  // Stage 6: Final assembly — fix bold formatting, remove duplicate paragraphs
  onProgress(93, 'Validating meaning accuracy...');

  // Ensure any vocab word in text has **word** formatting if asterisks were dropped by the model
  for (const w of cleanWords) {
    const regex = new RegExp(`(?<!\\*\\*)\\b(${escapeRegex(w.word)})\\b(?!\\*\\*)`, 'gi');
    combinedStory = combinedStory.replace(regex, '**$1**');
  }

  // Remove exact duplicate paragraphs
  const paragraphs = combinedStory.split(/\n\s*\n/);
  const seenParas = new Set();
  const deduplicatedParas = paragraphs.filter((para) => {
    const key = para.trim().slice(0, 80);
    if (seenParas.has(key)) return false;
    seenParas.add(key);
    return true;
  });
  combinedStory = deduplicatedParas.join('\n\n').trim();

  onProgress(97, 'Assembling final story...');

  // Calculate words successfully used (re-check after all modifications)
  const wordsUsedList = cleanWords.filter((w) => {
    const reg = new RegExp(`\\b${escapeRegex(w.word)}\\b`, 'i');
    return reg.test(combinedStory);
  });

  // Re-compute final validation state after assembly
  const finalValidationRecords = cleanWords.map((w) => {
    const reg = new RegExp(`\\b${escapeRegex(w.word)}\\b`, 'i');
    const found = reg.test(combinedStory);
    if (!found) {
      return { word: w.word, status: 'missing', sentence: null, expectedMeaning: w.meaning };
    }
    // Find stored record or recompute sentence
    const existing = validationRecords.find((r) => r.word === w.word);
    if (existing && existing.sentence) return existing;
    const matchIndex = combinedStory.search(new RegExp(`\\b${escapeRegex(w.word)}\\b`, 'i'));
    const sentenceStart = Math.max(0, combinedStory.lastIndexOf('.', matchIndex) + 1);
    const sentenceEnd = combinedStory.indexOf('.', matchIndex + w.word.length);
    const sentence = combinedStory
      .slice(sentenceStart, sentenceEnd > 0 ? sentenceEnd + 1 : sentenceStart + 200)
      .trim();
    return { word: w.word, expectedMeaning: w.meaning, sentence, status: 'used' };
  });

  const finalMissing = finalValidationRecords.filter((r) => r.status === 'missing');

  // Build validation summary
  const validationSummary = {
    totalChecked: cleanWords.length,
    successfullyUsed: wordsUsedList.length,
    missing: finalMissing.map((r) => r.word),
    records: finalValidationRecords,
  };

  onProgress(100, 'Your story is ready!');

  return {
    title: storyTitle,
    story: combinedStory,
    wordsUsed: wordsUsedList.map((w) => ({
      word: w.word,
      meaning: w.meaning,
      hindiMeaning: w.hindiMeaning,
    })),
    wordsUsedCount: wordsUsedList.length,
    totalWords: cleanWords.length,
    validationSummary,
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
        validationSummary: result.validationSummary || null,
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
    return res.json({
      title: result.title,
      story: result.story,
      wordsUsed: result.wordsUsed,
      wordsUsedCount: result.wordsUsedCount,
      totalWords: result.totalWords,
      validationSummary: result.validationSummary || null,
    });
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

