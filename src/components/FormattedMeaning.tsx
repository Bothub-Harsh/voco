import React from 'react';

interface FormattedMeaningProps {
  text: string;
  className?: string;
}

/**
 * Normalizes text by removing escaped backslashes in front of markdown symbols
 * and cleaning odd formatting returned by various AI models or JSON encoders.
 */
function normalizeMarkdownText(raw: string): string {
  if (!raw) return '';
  return raw
    // Unescape escaped asterisks, underscores, and backticks: e.g. \*\* -> **
    .replace(/\\(\*|_|`)/g, '$1')
    // Normalize triple asterisks or triple underscores to double (bold)
    .replace(/\*{3,}/g, '**')
    .replace(/_{3,}/g, '__');
}

/**
 * Cleans any leftover stray markdown symbols (like unmatched ** or __) from plain text
 * to guarantee that the user NEVER sees raw syntax characters like ** or __.
 */
function cleanStraySyntax(str: string): string {
  if (!str) return '';
  return str
    .replace(/\*{2,}/g, '')
    .replace(/_{2,}/g, '')
    .replace(/\\/g, '');
}

/**
 * Safely renders AI-generated vocabulary meanings and explanations with bold keyword formatting.
 * Robustly parses:
 * - **bold words** (including multiple occurrences: **word 1** and **word 2**)
 * - __bold words__
 * - Escaped markdown (\*\*word\*\*)
 * - Internal whitespace (** word **)
 * - Hindi, English, and multilingual unicode characters
 *
 * Guaranteed: No raw ** or __ symbols are ever displayed to the user.
 */
export const FormattedMeaning: React.FC<FormattedMeaningProps> = ({ text, className = '' }) => {
  if (!text || typeof text !== 'string') return null;

  const normalized = normalizeMarkdownText(text);

  // Regex matches **...** or __...__ with non-greedy content
  const boldRegex = /(?:\*\*\s*([\s\S]+?)\s*\*\*|__\s*([\s\S]+?)\s*__)/g;

  // Check if there is at least one bold match
  if (!boldRegex.test(normalized)) {
    const cleanAll = cleanStraySyntax(normalized);
    return <span className={className}>{cleanAll}</span>;
  }

  // Reset regex index after test()
  boldRegex.lastIndex = 0;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = boldRegex.exec(normalized)) !== null) {
    // 1. Text segment before the bold match
    if (match.index > lastIndex) {
      const plainText = cleanStraySyntax(normalized.slice(lastIndex, match.index));
      if (plainText) {
        elements.push(
          <React.Fragment key={`plain-${keyIdx++}`}>
            {plainText}
          </React.Fragment>
        );
      }
    }

    // 2. Bold segment
    const boldContent = (match[1] || match[2] || '').trim();
    if (boldContent) {
      // Clean any stray nested formatting within the bold group
      const cleanBold = cleanStraySyntax(boldContent);
      elements.push(
        <strong
          key={`bold-${keyIdx++}`}
          className="font-bold text-slate-950 dark:text-white"
        >
          {cleanBold}
        </strong>
      );
    }

    lastIndex = boldRegex.lastIndex;
  }

  // 3. Trailing text segment after the last match
  if (lastIndex < normalized.length) {
    const trailingText = cleanStraySyntax(normalized.slice(lastIndex));
    if (trailingText) {
      elements.push(
        <React.Fragment key={`plain-${keyIdx++}`}>
          {trailingText}
        </React.Fragment>
      );
    }
  }

  return <span className={className}>{elements}</span>;
};
