import { describe, it, expect } from 'vitest';
import type { VocabularyWord } from '../src/types';
import { generateFreshQuizSession } from '../src/services/quizGenerator';
import { validateVocabularyPayload } from '../server/validator.js';

describe('Quiz Evaluation & Randomized Distractor Engine', () => {
  const quizWord: VocabularyWord = {
    id: 'word-1',
    word: 'Harsh',
    wordLower: 'harsh',
    meaning: 'Rough, unkind, or very severe.',
    example: 'The teacher was harsh with the students.',
    options: [
      'Kind and caring',
      'Rough, unkind, or very severe.',
      'Very happy',
      'Tired and sleepy',
    ],
    correctIndex: 1,
    dateAdded: Date.now(),
  };

  const otherWords: VocabularyWord[] = [
    {
      id: 'word-2',
      word: 'Diligent',
      wordLower: 'diligent',
      meaning: 'Hardworking and showing care in one\'s work.',
      example: 'She is a diligent student.',
      options: ['Hardworking', 'Lazy', 'Loud', 'Slow'],
      correctIndex: 0,
      dateAdded: Date.now() - 1000,
    },
    {
      id: 'word-3',
      word: 'Benevolent',
      wordLower: 'benevolent',
      meaning: 'Kind, generous, and caring.',
      example: 'A benevolent donor helped the school.',
      options: ['Selfish', 'Angry', 'Kind, generous, and caring.', 'Silent'],
      correctIndex: 2,
      dateAdded: Date.now() - 2000,
    },
  ];

  it('correctly evaluates when user chooses the right answer', () => {
    const selectedOption = 1;
    const isCorrect = selectedOption === quizWord.correctIndex;
    expect(isCorrect).toBe(true);
    expect(quizWord.options[selectedOption]).toBe('Rough, unkind, or very severe.');
  });

  it('correctly evaluates when user chooses a wrong answer', () => {
    const wrongOptions = [0, 2, 3];
    wrongOptions.forEach((optionIndex) => {
      const isCorrect = optionIndex === quizWord.correctIndex;
      expect(isCorrect).toBe(false);
      expect(quizWord.options[optionIndex]).not.toBe(quizWord.meaning);
    });
  });

  it('contains exactly four distinct choices', () => {
    expect(quizWord.options).toHaveLength(4);
    const unique = new Set(quizWord.options.map((o) => o.toLowerCase()));
    expect(unique.size).toBe(4);
  });

  it('generates fresh quiz session where correct answer position varies among A, B, C, D (not always option A)', () => {
    const observedIndices = new Set<number>();
    const totalAttempts = 40;

    for (let i = 0; i < totalAttempts; i++) {
      const session = generateFreshQuizSession(quizWord, otherWords);

      // 1. Must always have 4 options
      expect(session.options).toHaveLength(4);

      // 2. correctIndex must strictly match the position of the actual correct meaning
      expect(session.correctIndex).toBeGreaterThanOrEqual(0);
      expect(session.correctIndex).toBeLessThanOrEqual(3);
      expect(session.options[session.correctIndex]).toBe(quizWord.meaning);

      // 3. Exactly one answer must be correct
      const matchingCount = session.options.filter((opt) => opt === quizWord.meaning).length;
      expect(matchingCount).toBe(1);

      // 4. All 4 options must be distinct
      const unique = new Set(session.options.map((o) => o.toLowerCase().trim()));
      expect(unique.size).toBe(4);

      observedIndices.add(session.correctIndex);
    }

    // Over 40 attempts, the correct answer must have appeared in multiple different slots (not always slot 0/A)
    expect(observedIndices.size).toBeGreaterThan(1);
    expect(observedIndices.has(0) || observedIndices.has(1) || observedIndices.has(2) || observedIndices.has(3)).toBe(true);
  });

  it('varies distractors between different quiz attempts', () => {
    const attempt1 = generateFreshQuizSession(quizWord, otherWords);
    let foundDifferentAttempt = false;

    // Run a few attempts to check distractor variation
    for (let i = 0; i < 20; i++) {
      const attemptN = generateFreshQuizSession(quizWord, otherWords);
      const distractors1 = attempt1.options.filter((o) => o !== quizWord.meaning).sort();
      const distractorsN = attemptN.options.filter((o) => o !== quizWord.meaning).sort();

      if (distractors1.join('|') !== distractorsN.join('|')) {
        foundDifferentAttempt = true;
        break;
      }
    }

    expect(foundDifferentAttempt).toBe(true);
  });

  it('preserves the original word, meaning, and example permanently without overwriting them', () => {
    const originalMeaning = quizWord.meaning;
    const originalWord = quizWord.word;
    const originalExample = quizWord.example;

    for (let i = 0; i < 10; i++) {
      generateFreshQuizSession(quizWord, otherWords);
    }

    // Ensure target word properties were never mutated
    expect(quizWord.meaning).toBe(originalMeaning);
    expect(quizWord.word).toBe(originalWord);
    expect(quizWord.example).toBe(originalExample);
  });

  it('randomizes answer position during AI word validation on the server', () => {
    // Simulated AI response where correct answer was originally placed at index 0 (option A)
    const rawAiPayload = {
      word: 'Serene',
      meaning: 'Calm, peaceful, and untroubled.',
      example: 'The morning was serene.',
      options: [
        'Calm, peaceful, and untroubled.', // placed at 0 by AI
        'Noisy and loud',
        'Angry and upset',
        'Fast and hurried',
      ],
      correctIndex: 0,
    };

    const observedServerIndices = new Set<number>();
    for (let i = 0; i < 30; i++) {
      const validated = validateVocabularyPayload(rawAiPayload);
      expect(validated.options[validated.correctIndex]).toBe(rawAiPayload.meaning);
      observedServerIndices.add(validated.correctIndex);
    }

    // Confirms correct answer is shuffled and not locked to 0
    expect(observedServerIndices.size).toBeGreaterThan(1);
  });
});
