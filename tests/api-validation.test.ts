import { describe, it, expect } from 'vitest';
import {
  validateInputWord,
  validateAiQuizResponse,
  getApiBaseUrl,
  PRODUCTION_BACKEND_URL,
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

  it('resolves correct API base URL', () => {
    const url = getApiBaseUrl();
    expect(typeof url).toBe('string');
    // In our test environment with VITE_API_URL set in .env:
    expect(url).toBe(PRODUCTION_BACKEND_URL);
  });
});
