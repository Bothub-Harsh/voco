import React from 'react';

interface FormattedMeaningProps {
  text: string;
  className?: string;
}

/**
 * Safely renders vocabulary meanings with selective bold formatting.
 * Splits on markdown `**bold text**` syntax and outputs native React elements
 * without dangerouslySetInnerHTML, completely preventing XSS while providing
 * clear, readable keyword emphasis.
 */
export const FormattedMeaning: React.FC<FormattedMeaningProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // Split by markdown bold syntax (**phrase**)
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
          const content = part.slice(2, -2).trim();
          return (
            <strong
              key={index}
              className="font-bold text-slate-900 dark:text-zinc-100"
            >
              {content}
            </strong>
          );
        }
        return <React.Fragment key={index}>{part}</React.Fragment>;
      })}
    </span>
  );
};

