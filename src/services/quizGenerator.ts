import type { VocabularyWord, ActiveQuizSession } from '../types';

/**
 * Curated pool of simple, everyday English definitions suitable for beginners.
 * Used for generating diverse, plausible distractors locally without network calls.
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
 * Generates a fresh ActiveQuizSession for a saved word with:
 * 1. The original word, correct meaning, and example preserved permanently.
 * 2. Randomized answer position among A, B, C, and D (never fixed at option A).
 * 3. Fresh, varying distractors pulled locally from saved words and the beginner pool.
 * 4. Exactly one correct answer, with correctIndex always matching the actual position.
 */
export function generateFreshQuizSession(
  targetWord: VocabularyWord,
  allSavedWords: VocabularyWord[] = []
): ActiveQuizSession {
  const correctMeaning = targetWord.meaning.trim();
  const normalizedCorrect = normalizeText(correctMeaning);

  // Candidate pool for distractors
  const candidatePool: string[] = [];
  const seenNormalized = new Set<string>();
  seenNormalized.add(normalizedCorrect);

  const addCandidateIfValid = (text: string | undefined) => {
    if (!text || typeof text !== 'string') return;
    const clean = text.trim();
    if (!clean) return;
    const norm = normalizeText(clean);
    if (!seenNormalized.has(norm)) {
      seenNormalized.add(norm);
      candidatePool.push(clean);
    }
  };

  // 1. Collect meanings from other saved words (highest contextual relevance)
  for (const otherWord of allSavedWords) {
    if (otherWord.id !== targetWord.id) {
      addCandidateIfValid(otherWord.meaning);
    }
  }

  // 2. Collect existing distractors from target word's saved options
  if (Array.isArray(targetWord.options)) {
    for (let i = 0; i < targetWord.options.length; i++) {
      if (i !== targetWord.correctIndex) {
        addCandidateIfValid(targetWord.options[i]);
      }
    }
  }

  // 3. Fallback to beginner distractor pool to ensure plenty of fresh options
  const shuffledGeneral = shuffleArray(BEGINNER_DISTRACTOR_POOL);
  for (const generalDef of shuffledGeneral) {
    addCandidateIfValid(generalDef);
  }

  // Shuffle the candidate distractors so different attempts get different distractors
  const randomizedCandidates = shuffleArray(candidatePool);

  // Pick exactly 3 distinct distractors
  const chosenDistractors = randomizedCandidates.slice(0, 3);

  // Fallback guard in case candidates are somehow fewer than 3
  while (chosenDistractors.length < 3) {
    chosenDistractors.push(`Definition option ${chosenDistractors.length + 1}`);
  }

  // Assemble the 4 choices: exactly one correct answer + 3 distractors
  const unshiftedChoices = [
    correctMeaning,
    chosenDistractors[0],
    chosenDistractors[1],
    chosenDistractors[2],
  ];

  // Randomize the position among A, B, C, D using Fisher-Yates
  const shuffledChoices = shuffleArray(unshiftedChoices) as [string, string, string, string];

  // Find the exact index where the correct meaning landed
  const correctIndex = shuffledChoices.indexOf(correctMeaning);

  if (correctIndex === -1) {
    throw new Error('Integrity error: Correct answer not found in quiz options.');
  }

  return {
    wordId: targetWord.id,
    word: targetWord.word,
    meaning: correctMeaning,
    example: targetWord.example,
    options: shuffledChoices,
    correctIndex,
  };
}

