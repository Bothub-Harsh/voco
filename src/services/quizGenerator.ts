import type { VocabularyWord, ActiveQuizSession } from '../types';
import { generateQuizDistractorsFromAI } from './api';

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
 * Intelligent, domain-categorized distractor pools designed to challenge the learner.
 * Grouped by semantic field and grammatical structure so all 4 options share
 * comparable sentence structures, complexity, and vocabulary depth.
 */
export const SEMANTIC_DISTRACTOR_DOMAINS: Record<string, string[]> = {
  // Category 1: Social, Cultural, Identity & Governance
  social: [
    'Relating to physical strength, endurance, and bodily structure.',
    'Relating to cultural traditions, social customs, and collective behaviour.',
    'Relating to personal beliefs, philosophy, and individual moral identity.',
    'Relating to legal authorities, statutory rules, and constitutional rights.',
    'Relating to geographic boundaries, territorial borders, and regional trade.',
    'Relating to economic systems, financial markets, and material resource allocation.',
    'Relating to public administration, civil bureaucracy, and community management.',
    'Relating to ancient ancestral lineages, historical heritage, and tribal customs.',
  ],

  // Category 2: Personality, Character & Human Demeanor
  character: [
    'Showing deep empathy and active consideration for the suffering of others.',
    'Showing strong determination and refusal to yield despite prolonged adversity.',
    'Showing steady emotional poise and calmness during turbulent circumstances.',
    'Showing humble modesty and reluctance to boast about personal accomplishments.',
    'Showing cautious hesitation and wariness before trusting unfamiliar individuals.',
    'Showing sharp skepticism and an inclination to doubt unsupported claims.',
    'Showing generous willingness to sacrifice personal comfort for a broader cause.',
    'Showing meticulous attention to ethical standards and fairness in judgment.',
  ],

  // Category 3: Conditions, States of Being & Subtle Qualities
  state: [
    'Existing or continuing for only a brief and fleeting duration of time.',
    'Remaining stable, constant, and unyielding in the face of continuous disruption.',
    'Characterized by remarkable clarity, precision, and absence of ambiguity.',
    'Possessing subtle complexity and depth that is not immediately apparent.',
    'Existing in an orderly and harmonious balance among competing elements.',
    'Marked by deliberate restraint, simplicity, and freedom from extravagance.',
    'Characterized by profound significance and influential long-term outcomes.',
    'Showing fragile delicacy that requires careful and attentive preservation.',
  ],

  // Category 4: Actions, Processes & Systematic Change
  process: [
    'To systematically examine, decompose, and evaluate the components of a problem.',
    'To gradually adapt, adjust, and reorient oneself to changing environments.',
    'To actively reconcile, unify, and harmonize previously conflicting viewpoints.',
    'To deliberately mask, conceal, or downplay the true magnitude of a situation.',
    'To steadily cultivate, nurture, and develop a set of skills or habits over time.',
    'To openly challenge, contest, and dispute prevailing conventions or dogmas.',
    'To restore energy, vigor, and purposeful direction after a prolonged setback.',
    'To establish firm boundaries and clearly outline expectations before proceeding.',
  ],

  // Category 5: Perception, Cognition & Thought
  cognition: [
    'Involving systematic logical reasoning based on empirical observation and facts.',
    'Involving intuitive awareness that arises independently of conscious deduction.',
    'Involving philosophical reflection on fundamental questions of knowledge and truth.',
    'Involving acute sensory discernment and immediate recognition of subtle details.',
    'Involving creative synthesis of diverse concepts into an original synthesis.',
    'Involving critical evaluation to differentiate between appearance and reality.',
    'Involving cautious deliberation to avoid hasty or ill-informed conclusions.',
    'Involving open-minded inquiry willing to revise assumptions upon new evidence.',
  ],
};

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
 * Detects the most relevant semantic domain based on keyword and grammatical hints
 * within the target word and definition.
 */
function detectSemanticDomain(word: string, meaning: string): string {
  const combined = `${word} ${meaning}`.toLowerCase();

  if (/relat(ing|ed)|social|cultur|group|race|ethnic|nation|govern|peopl|politic|communit|tradition/i.test(combined)) {
    return 'social';
  }
  if (/think|mind|reason|intellect|know|perceiv|understand|logic|conscious|philosoph|theor/i.test(combined)) {
    return 'cognition';
  }
  if (/^to\s|process|becom|adapt|chang|action|develop|creat|transform|examin/i.test(combined)) {
    return 'process';
  }
  if (/feel|person|charact|moral|behav|empath|courage|kind|anger|attitud|patient|modest/i.test(combined)) {
    return 'character';
  }
  return 'state';
}

/**
 * Generates a fresh ActiveQuizSession for a saved word with:
 * 1. Intelligent, domain-coherent distractors that match the grammatical structure,
 *    complexity, and length of the correct answer.
 * 2. Randomized answer position among A, B, C, and D with zero bias toward A or B.
 * 3. Prevention of position repeats when an existing/previous attempt index is provided.
 * 4. Strictly one correct answer with verified index alignment.
 */
export function generateFreshQuizSession(
  targetWord: VocabularyWord,
  allSavedWords: VocabularyWord[] = [],
  previousIndex?: number
): ActiveQuizSession {
  const correctMeaning = targetWord.meaning.trim();
  const normalizedCorrect = normalizeText(correctMeaning);
  const correctWordCount = getWordCount(correctMeaning);

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

  // 1. If the target word already has pre-saved balanced options from Groq AI, prioritize them
  if (Array.isArray(targetWord.options) && targetWord.options.length === 4) {
    for (let i = 0; i < targetWord.options.length; i++) {
      if (i !== targetWord.correctIndex) {
        addCandidateIfValid(targetWord.options[i]);
      }
    }
  }

  // 2. Collect distractors from the target word's best matching semantic domain
  const domain = detectSemanticDomain(targetWord.word, correctMeaning);
  const domainDistractors = SEMANTIC_DISTRACTOR_DOMAINS[domain] || SEMANTIC_DISTRACTOR_DOMAINS.state;
  for (const item of shuffleArray(domainDistractors)) {
    addCandidateIfValid(item);
  }

  // 3. Collect meanings from other saved words that have comparable length
  for (const otherWord of allSavedWords) {
    if (otherWord.id !== targetWord.id && otherWord.meaning) {
      const otherCount = getWordCount(otherWord.meaning);
      // Only include other saved words if within a reasonable length ratio
      if (Math.abs(otherCount - correctWordCount) <= 6) {
        addCandidateIfValid(otherWord.meaning);
      }
    }
  }

  // 4. Fill from adjacent semantic domains to guarantee ample candidate choices
  for (const key of Object.keys(SEMANTIC_DISTRACTOR_DOMAINS)) {
    if (key !== domain) {
      for (const item of shuffleArray(SEMANTIC_DISTRACTOR_DOMAINS[key])) {
        addCandidateIfValid(item);
      }
    }
  }

  // 5. Final fallback to beginner pool if still needed
  for (const generalDef of shuffleArray(BEGINNER_DISTRACTOR_POOL)) {
    addCandidateIfValid(generalDef);
  }

  // Filter and sort candidates: prioritize those closest in word count to the correct meaning
  // so the correct answer NEVER stands out by being noticeably longer or shorter!
  const sortedCandidates = candidatePool.sort((a, b) => {
    const diffA = Math.abs(getWordCount(a) - correctWordCount);
    const diffB = Math.abs(getWordCount(b) - correctWordCount);
    return diffA - diffB;
  });

  // Pick top 3 most balanced distractors
  const chosenDistractors = sortedCandidates.slice(0, 3);

  while (chosenDistractors.length < 3) {
    chosenDistractors.push(`Alternative definition ${chosenDistractors.length + 1}`);
  }

  // Assemble choices: correct meaning + 3 chosen distractors
  const rawChoices = [
    correctMeaning,
    chosenDistractors[0],
    chosenDistractors[1],
    chosenDistractors[2],
  ];

  // Randomize choices order using Fisher-Yates
  let shuffledChoices = shuffleArray(rawChoices) as [string, string, string, string];
  let correctIndex = shuffledChoices.indexOf(correctMeaning);

  // If previous attempt index is specified, avoid repeating the same letter position if possible
  if (previousIndex !== undefined && correctIndex === previousIndex && shuffledChoices.length === 4) {
    const alternativeIndices = [0, 1, 2, 3].filter((i) => i !== previousIndex);
    const targetSwapIndex = alternativeIndices[Math.floor(Math.random() * alternativeIndices.length)];
    const temp = shuffledChoices[correctIndex];
    shuffledChoices[correctIndex] = shuffledChoices[targetSwapIndex];
    shuffledChoices[targetSwapIndex] = temp;
    correctIndex = shuffledChoices.indexOf(correctMeaning);
  }

  if (correctIndex === -1 || shuffledChoices[correctIndex] !== correctMeaning) {
    throw new Error('Integrity error: Correct answer position misaligned during quiz generation.');
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

/**
 * Asynchronously generates an intelligent quiz session using Groq AI when online,
 * falling back to the local semantic engine if offline or if backend request fails.
 */
export async function generateChallengingQuizSessionAsync(
  targetWord: VocabularyWord,
  allSavedWords: VocabularyWord[] = [],
  previousIndex?: number
): Promise<ActiveQuizSession> {
  try {
    // Attempt Groq AI dynamic generation first
    const aiResult = await generateQuizDistractorsFromAI(targetWord.word, targetWord.meaning);
    if (aiResult && aiResult.options.length === 4) {
      let options = [...aiResult.options] as [string, string, string, string];
      let correctIndex = aiResult.correctIndex;

      // Ensure no position repetition if previousIndex provided
      if (previousIndex !== undefined && correctIndex === previousIndex) {
        const altIndices = [0, 1, 2, 3].filter((i) => i !== previousIndex);
        const swapTo = altIndices[Math.floor(Math.random() * altIndices.length)];
        const correctText = options[correctIndex];
        options[correctIndex] = options[swapTo];
        options[swapTo] = correctText;
        correctIndex = swapTo;
      }

      return {
        wordId: targetWord.id,
        word: targetWord.word,
        meaning: targetWord.meaning.trim(),
        example: targetWord.example,
        options,
        correctIndex,
      };
    }
  } catch (e) {
    console.warn('[Quiz] AI distractor generation note, using semantic fallback:', e);
  }

  // Graceful semantic fallback
  return generateFreshQuizSession(targetWord, allSavedWords, previousIndex);
}
