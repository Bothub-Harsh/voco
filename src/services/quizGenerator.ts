import type { VocabularyWord, ActiveQuizSession } from '../types';

/**
 * Curated pool of general English definitions suitable for basic fallbacks.
 * Preserved for backwards compatibility with tests and basic lookups.
 */
export const BEGINNER_DISTRACTOR_POOL: string[] = [
  'Kind, caring, and helpful to others',
  'Rough, unkind, or very severe',
  'Hardworking and showing care in one\'s work',
  'Calm, peaceful, and untroubled',
  'Very happy, cheerful, and full of joy',
  'Tired, sleepy, and needing rest',
  'Quick, fast, and moving with speed',
  'Quiet, making very little or no sound',
  'Bright, full of shining light',
  'Dark, gloomy, or without any light',
  'Strong, tough, and full of power',
  'Careful, paying close attention to avoid mistakes',
  'Lazy, unwilling to work or use energy',
  'Friendly, pleasant, and easy to talk to',
  'Angry, upset, or showing displeasure',
  'Generous, willing to give and share freely',
  'Selfish, caring only about oneself',
  'Honest, telling the truth without lies',
  'Brave, showing courage in difficult situations',
  'Afraid, fearful, or feeling scared',
  'Simple, plain, and easy to understand',
  'Confused, puzzled, and unable to think clearly',
  'Strange, unusual, or surprising',
  'Polite, having good manners and respect',
  'Rude, not polite and hurting feelings',
  'Neat, clean, and well-organized',
  'Messy, dirty, or untidy',
  'Curious, eager to learn and know things',
  'Proud, feeling deep pleasure from achievement',
  'Patient, able to wait calmly without annoyance',
  'Gentle, mild, and not rough or violent',
  'Dangerous, likely to cause harm or injury',
  'Safe, protected from danger or harm',
  'Clever, quick at learning and understanding',
  'Slow, taking a long time to move or act',
  'Heavy, having great weight and difficult to lift',
  'Light, easy to carry and not heavy',
  'Cold, having a low temperature or feeling chilled',
  'Warm, having a pleasant degree of heat',
  'Clean, free from dirt, marks, or stains',
  'Loud, producing a lot of noise',
  'Soft, pleasant to touch and not hard',
  'Hard, firm and solid, not easily bent',
  'Busy, having a lot of things to do',
  'Free, not under the control of another',
  'Lonely, sad because one has no friends or company',
  'Eager, wanting to do or have something very much',
  'Grateful, feeling or showing thanks',
  'Worried, anxious or unhappy about something',
  'Surprised, feeling wonder because of something unexpected',
];

/**
 * Standard Fisher-Yates array shuffling algorithm.
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Normalizes text for comparison (lowercased, trimmed, punctuation stripped).
 */
function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/[.,!?;:'"()[\]{}]/g, '');
}

/**
 * Word count helper to measure option length.
 */
function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Generates a fresh ActiveQuizSession for a saved word where:
 * 1. The correct option is the accurate meaning of the current quiz word.
 * 2. The 3 incorrect options are selected from other words already saved in the user's vocabulary list.
 * 3. Turns every quiz into a vocabulary revision exercise using actual saved word meanings.
 * 4. If fewer than 3 other saved words exist, available saved meanings are used and remaining slots are filled gracefully.
 * 5. All 4 options are randomly shuffled and the correctIndex is tracked accurately.
 */
export function generateFreshQuizSession(
  targetWord: VocabularyWord,
  allSavedWords: VocabularyWord[] = [],
  previousIndex?: number
): ActiveQuizSession {
  const rawCorrectMeaning = targetWord.meaning.trim();
  // Strip markdown bold asterisks if present for clean option display
  const cleanCorrectMeaning = rawCorrectMeaning.replace(/\*\*/g, '').trim();
  // Preserve exact original string if it had no asterisks, otherwise use clean text
  const correctOption = rawCorrectMeaning.includes('**') ? cleanCorrectMeaning : rawCorrectMeaning;
  const normalizedCorrect = normalizeText(cleanCorrectMeaning);
  const correctWordCount = getWordCount(cleanCorrectMeaning);

  const seenMeanings = new Set<string>();
  seenMeanings.add(normalizedCorrect);

  // 1. Gather distinct, valid meanings from other saved words in the user's vocabulary list
  const validOtherWords: VocabularyWord[] = [];
  for (const otherWord of allSavedWords) {
    if (!otherWord || !otherWord.meaning) continue;
    // Exclude the target word itself by ID or spelling
    if (otherWord.id === targetWord.id) continue;
    if (otherWord.word.trim().toLowerCase() === targetWord.word.trim().toLowerCase()) continue;

    const rawOther = otherWord.meaning.trim();
    const cleanOther = rawOther.replace(/\*\*/g, '').trim();
    if (!cleanOther) continue;

    const norm = normalizeText(cleanOther);
    // Avoid duplicate meanings and avoid using current word's meaning as a distractor
    if (!seenMeanings.has(norm)) {
      seenMeanings.add(norm);
      validOtherWords.push({
        ...otherWord,
        meaning: rawOther.includes('**') ? cleanOther : rawOther,
      });
    }
  }

  // 2. Randomly select distractors from other saved words
  const shuffledOtherWords = shuffleArray(validOtherWords);
  const chosenDistractors: string[] = [];

  for (const other of shuffledOtherWords) {
    if (chosenDistractors.length >= 3) break;
    chosenDistractors.push(other.meaning);
  }

  // 3. If fewer than 3 other saved words exist, gracefully fill remaining slots from the fallback pool
  if (chosenDistractors.length < 3) {
    // Sort fallback pool by length closeness to maintain balanced option appearance
    const sortedPool = shuffleArray(BEGINNER_DISTRACTOR_POOL).sort((a, b) => {
      const diffA = Math.abs(getWordCount(a) - correctWordCount);
      const diffB = Math.abs(getWordCount(b) - correctWordCount);
      return diffA - diffB;
    });

    for (const fallbackDef of sortedPool) {
      if (chosenDistractors.length >= 3) break;
      const norm = normalizeText(fallbackDef);
      if (!seenMeanings.has(norm)) {
        seenMeanings.add(norm);
        chosenDistractors.push(fallbackDef);
      }
    }
  }

  // Absolute safety fallback to guarantee exactly 3 distractors
  while (chosenDistractors.length < 3) {
    chosenDistractors.push(`Alternative definition ${chosenDistractors.length + 1}`);
  }

  // 4. Assemble the four options: 1 correct meaning + 3 saved distractors
  const rawChoices = [
    correctOption,
    chosenDistractors[0],
    chosenDistractors[1],
    chosenDistractors[2],
  ];

  // 5. Randomly shuffle all four options using Fisher-Yates
  let shuffledChoices = shuffleArray(rawChoices) as [string, string, string, string];
  let correctIndex = shuffledChoices.indexOf(correctOption);

  // 6. If previousIndex is provided (e.g. Try Again), avoid repeating the same letter position
  if (previousIndex !== undefined && correctIndex === previousIndex && shuffledChoices.length === 4) {
    const alternativeIndices = [0, 1, 2, 3].filter((i) => i !== previousIndex);
    const targetSwapIndex = alternativeIndices[Math.floor(Math.random() * alternativeIndices.length)];
    const temp = shuffledChoices[correctIndex];
    shuffledChoices[correctIndex] = shuffledChoices[targetSwapIndex];
    shuffledChoices[targetSwapIndex] = temp;
    correctIndex = shuffledChoices.indexOf(correctOption);
  }

  if (correctIndex === -1 || shuffledChoices[correctIndex] !== correctOption) {
    throw new Error('Integrity error: Correct answer position misaligned during quiz generation.');
  }

  return {
    wordId: targetWord.id,
    word: targetWord.word,
    meaning: correctOption,
    example: targetWord.example,
    hindiMeaning: targetWord.hindiMeaning,
    hindiExample: targetWord.hindiExample,
    options: shuffledChoices,
    correctIndex,
  };
}

/**
 * Asynchronously generates a quiz session where distractors are pulled from the user's
 * saved vocabulary entries, turning every quiz into a revision exercise.
 */
export async function generateChallengingQuizSessionAsync(
  targetWord: VocabularyWord,
  allSavedWords: VocabularyWord[] = [],
  previousIndex?: number
): Promise<ActiveQuizSession> {
  return generateFreshQuizSession(targetWord, allSavedWords, previousIndex);
}
