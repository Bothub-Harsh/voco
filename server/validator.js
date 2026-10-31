/**
 * Validates and sanitizes the vocabulary response from Groq AI.
 * Ensures the response strictly adheres to the required beginner-friendly schema
 * and rejects malformed responses, raw JSON fragments, or placeholder text.
 */

function isJsonFragment(str) {
  if (typeof str !== 'string') return true;
  const t = str.trim();
  return (
    (t.startsWith('{') && t.endsWith('}')) ||
    (t.startsWith('[') && t.endsWith(']')) ||
    t.includes('```') ||
    t.includes('"meaning":') ||
    t.includes('"example":') ||
    t.includes('"options":')
  );
}

const PLACEHOLDER_STRINGS = new Set([
  'n/a',
  'none',
  'null',
  'undefined',
  '...',
  'unknown',
  'placeholder',
  'definition here',
  'example here',
  'test',
]);

export function validateVocabularyPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI response is not an object.');
  }

  const { word, meaning, example, options, correctIndex, hindiMeaning, hindiExample } = raw;

  // 1. Validate word
  if (typeof word !== 'string' || !word.trim()) {
    throw new Error('Missing or invalid "word" field in AI response.');
  }
  const cleanWord = word.trim();
  if (cleanWord.length < 2) {
    throw new Error('Word is too short to be a valid vocabulary word.');
  }
  if (!/[a-zA-Z]/.test(cleanWord)) {
    throw new Error('Word must contain alphabetical characters.');
  }
  if (isJsonFragment(cleanWord)) {
    throw new Error('Word appears to be a malformed JSON fragment.');
  }

  // 2. Validate meaning
  if (typeof meaning !== 'string' || !meaning.trim()) {
    throw new Error('Missing or invalid "meaning" field in AI response.');
  }
  const cleanMeaning = meaning.trim();
  if (cleanMeaning.length < 5) {
    throw new Error('Meaning is too short to be a complete explanation.');
  }
  if (PLACEHOLDER_STRINGS.has(cleanMeaning.toLowerCase())) {
    throw new Error('Meaning contains placeholder text.');
  }
  if (isJsonFragment(cleanMeaning)) {
    throw new Error('Meaning appears to contain raw JSON code.');
  }

  // 3. Validate example sentence
  if (typeof example !== 'string' || !example.trim()) {
    throw new Error('Missing or invalid "example" field in AI response.');
  }
  const cleanExample = example.trim();
  if (cleanExample.length < 8) {
    throw new Error('Example sentence is too short.');
  }
  if (PLACEHOLDER_STRINGS.has(cleanExample.toLowerCase())) {
    throw new Error('Example sentence contains placeholder text.');
  }
  if (isJsonFragment(cleanExample)) {
    throw new Error('Example sentence appears to contain raw JSON code.');
  }

  // 4. Validate options
  if (!Array.isArray(options) || options.length !== 4) {
    throw new Error('AI response must contain an array of exactly 4 options.');
  }

  const cleanOptions = options.map((opt, i) => {
    if (typeof opt !== 'string' || !opt.trim()) {
      throw new Error(`Option at index ${i} is empty or not a string.`);
    }
    const o = opt.trim();
    if (o.length < 2 || PLACEHOLDER_STRINGS.has(o.toLowerCase()) || isJsonFragment(o)) {
      throw new Error(`Option at index ${i} is invalid or contains placeholder text.`);
    }
    return o;
  });

  // Ensure all 4 options are distinct (case-insensitive)
  const uniqueOptions = new Set(cleanOptions.map((opt) => opt.toLowerCase()));
  if (uniqueOptions.size !== 4) {
    throw new Error('All 4 options must be distinct meanings.');
  }

  // 5. Validate correctIndex
  const parsedIndex = Number(correctIndex);
  if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex > 3) {
    throw new Error('correctIndex must be an integer between 0 and 3.');
  }

  // Randomize the answer position so correct answer never always appears at index 0
  const correctOptionText = cleanOptions[parsedIndex];
  const shuffledOptions = [...cleanOptions];
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }
  const randomizedCorrectIndex = shuffledOptions.indexOf(correctOptionText);

  let cleanHindiMeaning = undefined;
  if (typeof hindiMeaning === 'string' && hindiMeaning.trim().length >= 2 && !PLACEHOLDER_STRINGS.has(hindiMeaning.toLowerCase().trim())) {
    cleanHindiMeaning = hindiMeaning.trim();
  }

  let cleanHindiExample = undefined;
  if (typeof hindiExample === 'string' && hindiExample.trim().length >= 4 && !PLACEHOLDER_STRINGS.has(hindiExample.toLowerCase().trim())) {
    cleanHindiExample = hindiExample.trim();
  }

  return {
    word: cleanWord,
    meaning: cleanMeaning,
    example: cleanExample,
    hindiMeaning: cleanHindiMeaning,
    hindiExample: cleanHindiExample,
    options: shuffledOptions,
    correctIndex: randomizedCorrectIndex,
  };
}
