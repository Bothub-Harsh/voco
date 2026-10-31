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
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// Active Groq candidate models in fallback order
const CANDIDATE_MODELS = [
  DEFAULT_MODEL,
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
  'mixtral-8x7b-32768'
].filter((m, i, arr) => arr.indexOf(m) === i && !m.startsWith('openai/') && !m.startsWith('qwen/'));

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
      ? `You are an expert, beginner-friendly English vocabulary tutor and professional quiz creator.
Target English word: "${cleanWord}"
Previous explanation: "${currentMeaning || ''}"
Previous example sentence: "${currentExample || ''}"

Goal: Provide a FRESH, ALTERNATIVE explanation, example sentence, Hindi meaning, and balanced quiz options for "${cleanWord}".

Requirements:
1. Provide the English word with proper capitalization.
2. English Meaning (meaning):
   - Explain the word in simple, everyday English (like an easy-to-understand dictionary definition).
   - Keep it concise and natural. Avoid long, overwhelming paragraphs.
   - Highlight 2 to 4 important, meaningful phrases or keywords by wrapping them in Markdown bold (**phrase**).
   - Do NOT bold entire sentences and do NOT bold the target word itself.
   - Example format: "${cleanWord} means being able to **recover quickly**, **stay strong**, and **continue moving forward** after facing difficulties."
3. Hindi Meaning (hindiMeaning):
   - Provide an accurate, natural Hindi translation using commonly understood, easy Hindi (avoid archaic terms).
   - Naturally highlight 2 to 3 important Hindi keywords or phrases in Markdown bold (**शब्द/वाक्यांश**).
   - Example format: "मुश्किलों के बाद भी **जल्दी संभलना**, **मजबूत बने रहना** और आगे बढ़ते रहना।"
4. Example Sentence (example):
   - Provide ONE natural example sentence showing how the word is used in everyday English.
   - Keep the example in normal plain text (do NOT include bold markdown here).
5. Four Balanced Quiz Options (options):
   - Exactly 4 multiple-choice definitions for what "${cleanWord}" means (array of 4 strings).
   - Exactly one option must be the accurate meaning.
   - Three options must be intelligent distractors in the same semantic theme.
   - All 4 options must be in clean plain text (NO markdown bold asterisks), very similar in length (within 3-5 words), similar grammar, and distinct.
6. Provide the correct answer index: 0, 1, 2, or 3.

Respond ONLY with a valid JSON object matching this schema:
{
  "word": "${cleanWord}",
  "meaning": "fresh simple definition with **2-4 key phrases** in bold",
  "example": "one natural example sentence in plain text",
  "hindiMeaning": "सरल हिंदी अर्थ **2-3 महत्वपूर्ण शब्दों** के साथ",
  "hindiExample": "हिंदी उदाहरण वाक्य",
  "options": [
    "plain text option 1",
    "plain text option 2",
    "plain text option 3",
    "plain text option 4"
  ],
  "correctIndex": 1
}`
      : `You are an expert, beginner-friendly English vocabulary tutor and professional quiz creator.
Target English word: "${cleanWord}"

Requirements:
1. Provide the English word with proper capitalization.
2. English Meaning (meaning):
   - Explain the word in simple, everyday English (like an easy-to-understand dictionary definition).
   - Keep it concise and natural. Avoid long, overwhelming paragraphs.
   - Highlight 2 to 4 important, meaningful phrases or keywords by wrapping them in Markdown bold (**phrase**).
   - Do NOT bold entire sentences and do NOT bold the target word itself.
   - Example format: "${cleanWord} means being able to **recover quickly**, **stay strong**, and **continue moving forward** after facing difficulties."
3. Hindi Meaning (hindiMeaning):
   - Provide an accurate, natural Hindi translation using commonly understood, easy Hindi (avoid archaic terms).
   - Naturally highlight 2 to 3 important Hindi keywords or phrases in Markdown bold (**शब्द/वाक्यांश**).
   - Example format: "मुश्किलों के बाद भी **जल्दी संभलना**, **मजबूत बने रहना** और आगे बढ़ते रहना।"
4. Example Sentence (example):
   - Provide ONE natural example sentence showing how the word is used in everyday English.
   - Keep the example in normal plain text (do NOT include bold markdown here).
5. Four Balanced Quiz Options (options):
   - Exactly 4 multiple-choice definitions for what "${cleanWord}" means (array of 4 strings).
   - Exactly one option must be the accurate meaning.
   - Three options must be intelligent distractors in the same semantic theme.
   - All 4 options must be in clean plain text (NO markdown bold asterisks), very similar in length (within 3-5 words), similar grammar, and distinct.
6. Provide the correct answer index: 0, 1, 2, or 3.

Respond ONLY with a valid JSON object matching this schema:
{
  "word": "${cleanWord}",
  "meaning": "simple definition with **2-4 key phrases** in bold",
  "example": "one natural example sentence in plain text",
  "hindiMeaning": "सरल हिंदी अर्थ **2-3 महत्वपूर्ण शब्दों** के साथ",
  "hindiExample": "हिंदी उदाहरण वाक्य",
  "options": [
    "plain text option 1",
    "plain text option 2",
    "plain text option 3",
    "plain text option 4"
  ],
  "correctIndex": 1
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

