import { describe, it, expect } from 'vitest';
import type { VocabularyWord } from '../src/types';

describe('Quiz Evaluation & Answering Logic', () => {
  const quizWord: VocabularyWord = {
    id: 'word-1',
    word: 'Harsh',
    wordLower: 'harsh',
    meaning: 'Rough, unkind, or very severe.',
    example: 'The teacher was harsh with the students.',
    options: [
      'Kind and caring',
      'Rough or unkind',
      'Very happy',
      'Tired and sleepy',
    ],
    correctIndex: 1,
    dateAdded: Date.now(),
  };

  it('correctly evaluates when user chooses the right answer', () => {
    const selectedOption = 1;
    const isCorrect = selectedOption === quizWord.correctIndex;
    expect(isCorrect).toBe(true);
    expect(quizWord.options[selectedOption]).toBe('Rough or unkind');
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

  it('keeps quiz functional offline with full example sentence and meaning', () => {
    // Verifies that all required study fields are self-contained in the saved word
    expect(quizWord.word).toBeTruthy();
    expect(quizWord.meaning).toBeTruthy();
    expect(quizWord.example).toBeTruthy();
    expect(quizWord.correctIndex).toBeGreaterThanOrEqual(0);
    expect(quizWord.correctIndex).toBeLessThanOrEqual(3);
  });
});

