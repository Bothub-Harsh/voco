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
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

// Candidate models in fallback order
const CANDIDATE_MODELS = [
  DEFAULT_MODEL,
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant'
].filter((m, i, arr) => arr.indexOf(m) === i); // deduplicate

function cleanJsonContent(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
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
      ? `You are an expert, beginner-friendly English vocabulary tutor.
Target English word: "${cleanWord}"
Previous explanation: "${currentMeaning || ''}"
Previous example sentence: "${currentExample || ''}"

Goal: Provide a FRESH, ALTERNATIVE explanation and example sentence for "${cleanWord}" using different wording. Do NOT repeat or simply paraphrase the previous explanation.

Requirements:
1. Provide the English word with proper capitalization.
2. Provide an accurate, clear explanation in simple English written like a beginner's dictionary definition (easy to understand for an English learner, grammatically correct, concise).
3. Provide one natural, fresh example sentence showing how the word is used in everyday English.
4. Provide exactly four multiple-choice options (A, B, C, D) for what the word means.
   - Exactly one option must be the correct meaning (matching the refreshed explanation).
   - The other three options must be plausible but clearly incorrect alternate definitions.
   - All four options must be distinct.
5. Provide the correct answer index: 0 for 1st option, 1 for 2nd option, 2 for 3rd option, or 3 for 4th option.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "word": "${cleanWord}",
  "meaning": "fresh simple definition in clear everyday English",
  "example": "fresh natural example sentence",
  "options": [
    "option 1",
    "option 2",
    "option 3",
    "option 4"
  ],
  "correctIndex": 1
}`
      : `You are an expert, beginner-friendly English vocabulary tutor.
Target English word: "${cleanWord}"

Requirements:
1. Provide the English word with proper capitalization.
2. Provide one accurate, easy-to-understand explanation in simple English, like a dictionary explanation written for a beginner (e.g. for "Discrimination": "Discrimination means treating someone unfairly or differently because of their identity, such as their caste, religion, gender, skin colour, or background."). Keep the explanation short, clear, and grammatically correct.
3. Provide one natural example sentence showing how the word is used in everyday English (e.g. "Discrimination in the workplace is unfair and should not be allowed.").
4. Provide exactly four multiple-choice options (A, B, C, D) for what the word means (for quiz practice).
   - Exactly one option must be the correct meaning.
   - The other three options must be plausible but clearly incorrect alternate definitions.
   - All four options must be distinct.
5. Provide the correct answer index: 0 for 1st option, 1 for 2nd option, 2 for 3rd option, or 3 for 4th option.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "word": "${cleanWord}",
  "meaning": "simple dictionary-style definition in everyday English",
  "example": "one natural example sentence",
  "options": [
    "option 1",
    "option 2",
    "option 3",
    "option 4"
  ],
  "correctIndex": 1
}`;

    let lastError = null;
    let successfulData = null;

    // Try candidate models with automatic fallback if a model is unavailable
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

          // If model doesn't exist, try next candidate model
          if (
            groqResponse.status === 404 ||
            errorMessage.includes('does not exist') ||
            errorMessage.includes('do not have access')
          ) {
            lastError = { status: 404, message: errorMessage };
            continue;
          }

          if (groqResponse.status === 429) {
            return res.status(429).json({
              error: 'Groq API rate limit reached. Please wait a few moments and click Retry.',
              details: errorMessage,
            });
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

