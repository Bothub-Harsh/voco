import { describe, it, expect } from 'vitest';
import { validateVocabularyPayload } from '../server/validator.js';

describe('AI Word Generation Validator', () => {
  const validPayload = {
    word: 'Harsh',
    meaning: 'Rough, unkind, or very severe.',
    example: 'The teacher was harsh with the students.',
    options: [
      'Kind and caring',
      'Rough or unkind',
      'Very happy',
      'Tired and sleepy',
    ],
    correctIndex: 1,
  };

  it('accepts a valid beginner-friendly vocabulary payload', () => {
    const validated = validateVocabularyPayload(validPayload);
    expect(validated.word).toBe('Harsh');
    expect(validated.meaning).toBe('Rough, unkind, or very severe.');
    expect(validated.options).toHaveLength(4);
    expect(validated.correctIndex).toBe(1);
    expect(validated.options[validated.correctIndex]).toBe('Rough or unkind');
  });

  it('rejects payload missing word or meaning', () => {
    expect(() =>
      validateVocabularyPayload({ ...validPayload, word: '' })
    ).toThrow('Missing or invalid "word" field');

    expect(() =>
      validateVocabularyPayload({ ...validPayload, meaning: '   ' })
    ).toThrow('Missing or invalid "meaning" field');
  });

  it('rejects payload if options length is not exactly 4', () => {
    expect(() =>
      validateVocabularyPayload({
        ...validPayload,
        options: ['Option 1', 'Option 2', 'Option 3'],
      })
    ).toThrow('must contain an array of exactly 4 options');

    expect(() =>
      validateVocabularyPayload({
        ...validPayload,
        options: ['1', '2', '3', '4', '5'],
      })
    ).toThrow('must contain an array of exactly 4 options');
  });

  it('rejects duplicate options to ensure quality quiz questions', () => {
    expect(() =>
      validateVocabularyPayload({
        ...validPayload,
        options: [
          'Rough or unkind',
          'rough or UNKIND', // duplicate
          'Very happy',
          'Tired and sleepy',
        ],
      })
    ).toThrow('All 4 options must be distinct meanings');
  });

  it('rejects out-of-bounds or non-integer correctIndex', () => {
    expect(() =>
      validateVocabularyPayload({
        ...validPayload,
        correctIndex: 4,
      })
    ).toThrow('correctIndex must be an integer between 0 and 3');

    expect(() =>
      validateVocabularyPayload({
        ...validPayload,
        correctIndex: -1,
      })
    ).toThrow('correctIndex must be an integer between 0 and 3');

    expect(() =>
      validateVocabularyPayload({
        ...validPayload,
        correctIndex: 1.5,
      })
    ).toThrow('correctIndex must be an integer between 0 and 3');
  });
});

