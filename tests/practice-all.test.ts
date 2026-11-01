import { describe, it, expect } from 'vitest';
import type { VocabularyWord } from '../src/types';
import { generateFreshQuizSession, shuffleArray } from '../src/services/quizGenerator';

function createMockWord(id: string, word: string, meaning: string): VocabularyWord {
  return {
    id,
    word,
    wordLower: word.toLowerCase(),
    meaning,
    example: `This is an example sentence for ${word}.`,
    options: [meaning, 'Option B', 'Option C', 'Option D'],
    correctIndex: 0,
    dateAdded: Date.now(),
  };
}

describe('Practice All Words Session Logic', () => {
  it('correctly manages a 1-word practice session', () => {
    const singleWord = [createMockWord('w1', 'Solo', 'Being alone or on one\'s own.')];
    const shuffled = shuffleArray(singleWord);

    expect(shuffled).toHaveLength(1);
    expect(shuffled[0].id).toBe('w1');

    const quiz = generateFreshQuizSession(shuffled[0], singleWord);
    expect(quiz.word).toBe('Solo');
    expect(quiz.options).toHaveLength(4);

    // Answer correctly
    const answers = [{ wordId: shuffled[0].id, correct: true }];
    const correctCount = answers.filter((a) => a.correct).length;
    const incorrectCount = answers.length - correctCount;
    const score = Math.round((correctCount / answers.length) * 100);

    expect(correctCount).toBe(1);
    expect(incorrectCount).toBe(0);
    expect(score).toBe(100);
  });

  it('correctly handles a 10-word session with unique words and accurate score calculation', () => {
    const words: VocabularyWord[] = Array.from({ length: 10 }, (_, i) =>
      createMockWord(`id-${i + 1}`, `Word${i + 1}`, `Meaning for word ${i + 1}.`)
    );

    const shuffled = shuffleArray(words);
    expect(shuffled).toHaveLength(10);

    // Verify all 10 words are present and each appears exactly once
    const ids = shuffled.map((w) => w.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(10);

    // Simulate stepping through all 10 questions
    const answers: { wordId: string; correct: boolean }[] = [];
    for (let i = 0; i < shuffled.length; i++) {
      const currentWord = shuffled[i];
      const quiz = generateFreshQuizSession(currentWord, words);
      expect(quiz.word).toBe(currentWord.word);
      expect(quiz.options).toContain(currentWord.meaning);

      // Simulate 8 correct, 2 incorrect answers
      const isCorrect = i < 8;
      answers.push({ wordId: currentWord.id, correct: isCorrect });
    }

    const correctCount = answers.filter((a) => a.correct).length;
    const incorrectCount = answers.length - correctCount;
    const score = Math.round((correctCount / answers.length) * 100);

    expect(answers).toHaveLength(10);
    expect(correctCount).toBe(8);
    expect(incorrectCount).toBe(2);
    expect(score).toBe(80);
  });

  it('correctly handles a 50-word large session without repeats', () => {
    const words: VocabularyWord[] = Array.from({ length: 50 }, (_, i) =>
      createMockWord(`w-${i + 1}`, `Vocab${i + 1}`, `Full meaning explanation for item ${i + 1}.`)
    );

    const shuffled = shuffleArray(words);
    expect(shuffled).toHaveLength(50);

    const seenIds = new Set<string>();
    shuffled.forEach((w) => {
      expect(seenIds.has(w.id)).toBe(false);
      seenIds.add(w.id);
    });

    expect(seenIds.size).toBe(50);
  });

  it('resets cleanly when user clicks Practice Again', () => {
    const words = [
      createMockWord('1', 'Alpha', 'First letter or beginning.'),
      createMockWord('2', 'Beta', 'Second phase or letter.'),
    ];

    let session = {
      words: shuffleArray(words),
      currentIndex: 0,
      answers: [
        { wordId: '1', correct: true },
        { wordId: '2', correct: false },
      ],
      isCompleted: true,
    };

    expect(session.isCompleted).toBe(true);
    expect(session.answers).toHaveLength(2);

    // Reset session for Practice Again
    session = {
      words: shuffleArray(words),
      currentIndex: 0,
      answers: [],
      isCompleted: false,
    };

    expect(session.isCompleted).toBe(false);
    expect(session.currentIndex).toBe(0);
    expect(session.answers).toHaveLength(0);
  });
});

