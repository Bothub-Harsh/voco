import { describe, it, expect } from 'vitest';
import {
  validateInputWord,
  validateAiQuizResponse,
  getApiBaseUrl,
  PRODUCTION_BACKEND_URL,
  classifyError,
  GenerationError,
} from '../src/services/api';

describe('API Input & Output Quality Validation', () => {
  it('validates legitimate English words and trims whitespace', () => {
    expect(validateInputWord('  Benevolent  ')).toBe('Benevolent');
    expect(validateInputWord('peace-loving')).toBe('peace-loving');
  });

  it('rejects words that are empty, too short, or non-alphabetic', () => {
    expect(() => validateInputWord('')).toThrow('Please enter an English word.');
    expect(() => validateInputWord('   ')).toThrow('Please enter an English word.');
    expect(() => validateInputWord('a')).toThrow('Word is too short');
    expect(() => validateInputWord('12345')).toThrow('alphabetical characters');
    expect(() => validateInputWord('!@#$%')).toThrow('alphabetical characters');
  });

  it('accepts complete, high quality AI quiz responses', () => {
    const valid = {
      word: 'Serene',
      meaning: 'Serene means calm, peaceful, and untroubled.',
      example: 'She felt serene sitting beside the mountain stream.',
      options: [
        'Calm, peaceful, and untroubled',
        'Loud and angry',
        'Fast and reckless',
        'Confused and lost',
      ],
      correctIndex: 0,
    };

    const validated = validateAiQuizResponse(valid);
    expect(validated.word).toBe('Serene');
    expect(validated.meaning).toBe('Serene means calm, peaceful, and untroubled.');
    expect(validated.options).toHaveLength(4);
    expect(validated.correctIndex).toBe(0);
  });

  it('rejects malformed responses, placeholders, or empty fields', () => {
    expect(() => validateAiQuizResponse(null)).toThrow('Invalid response structure');
    expect(() =>
      validateAiQuizResponse({
        word: 'Test',
        meaning: 'N/A', // too short / placeholder
        example: 'This is a valid example sentence.',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      })
    ).toThrow('incomplete definition');

    expect(() =>
      validateAiQuizResponse({
        word: 'Test',
        meaning: 'Valid meaning explanation here.',
        example: 'Short', // too short
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctIndex: 0,
      })
    ).toThrow('incomplete example');

    expect(() =>
      validateAiQuizResponse({
        word: 'Test',
        meaning: 'Valid meaning explanation here.',
        example: 'This is a valid example sentence.',
        options: ['Option 1', 'Option 2', 'Option 3'], // only 3 options
        correctIndex: 0,
      })
    ).toThrow('exactly 4 quiz options');
  });

  it('separately classifies rate limits, server errors, network failures, malformed JSON, and missing fields', () => {
    // 1. Rate limit (429)
    const rateLimit = classifyError(new Error('Groq API rate limit (429) reached'), 'Swift');
    expect(rateLimit.type).toBe('RATE_LIMIT');
    expect(rateLimit.word).toBe('Swift');

    // 2. Server error (5xx)
    const serverErr = classifyError(new Error('Request failed with HTTP 503'), 'Nimble');
    expect(serverErr.type).toBe('SERVER_ERROR');

    // 3. Network failure / timeout
    const networkErr = classifyError(new Error('Network timeout after 40s'), 'Vivid');
    expect(networkErr.type).toBe('NETWORK_FAILURE');

    // 4. Malformed JSON
    const jsonErr = classifyError(new SyntaxError('Unexpected token in JSON at position 12'), 'Keen');
    expect(jsonErr.type).toBe('MALFORMED_JSON');

    // 5. Missing fields
    const missingErr = classifyError(new Error('Server must provide exactly 4 quiz options'), 'Sage');
    expect(missingErr.type).toBe('MISSING_FIELDS');

    // 6. Direct GenerationError
    const genErr = classifyError(new GenerationError('RATE_LIMIT', 'Rate limit on model', 'Echo'));
    expect(genErr.type).toBe('RATE_LIMIT');
    expect(genErr.word).toBe('Echo');
  });

  it('resolves correct API base URL', () => {
    const url = getApiBaseUrl();
    expect(typeof url).toBe('string');
    expect(url).toBe(PRODUCTION_BACKEND_URL);
  });
});
