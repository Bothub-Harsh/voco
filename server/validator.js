/**
 * Validates and sanitizes the vocabulary response from Groq AI.
 * Ensures the response strictly adheres to the required beginner-friendly schema.
 */
export function validateVocabularyPayload(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('AI response is not an object.');
  }

  const { word, meaning, example, options, correctIndex } = raw;

  if (typeof word !== 'string' || !word.trim()) {
    throw new Error('Missing or invalid "word" field in AI response.');
  }

  if (typeof meaning !== 'string' || !meaning.trim()) {
    throw new Error('Missing or invalid "meaning" field in AI response.');
  }

  if (typeof example !== 'string' || !example.trim()) {
    throw new Error('Missing or invalid "example" field in AI response.');
  }

  if (!Array.isArray(options) || options.length !== 4) {
    throw new Error('AI response must contain an array of exactly 4 options.');
  }

  const cleanOptions = options.map((opt, i) => {
    if (typeof opt !== 'string' || !opt.trim()) {
      throw new Error(`Option at index ${i} is empty or not a string.`);
    }
    return opt.trim();
  });

  // Ensure all 4 options are distinct (case-insensitive)
  const uniqueOptions = new Set(cleanOptions.map((opt) => opt.toLowerCase()));
  if (uniqueOptions.size !== 4) {
    throw new Error('All 4 options must be distinct meanings.');
  }

  const parsedIndex = Number(correctIndex);
  if (!Number.isInteger(parsedIndex) || parsedIndex < 0 || parsedIndex > 3) {
    throw new Error('correctIndex must be an integer between 0 and 3.');
  }

  // Randomize the answer position so correct answer never always appears as option A (index 0)
  const correctOptionText = cleanOptions[parsedIndex];
  const shuffledOptions = [...cleanOptions];
  for (let i = shuffledOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
  }
  const randomizedCorrectIndex = shuffledOptions.indexOf(correctOptionText);

  return {
    word: word.trim(),
    meaning: meaning.trim(),
    example: example.trim(),
    options: shuffledOptions,
    correctIndex: randomizedCorrectIndex,
  };
}

