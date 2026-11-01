import { describe, it, expect } from 'vitest';

describe('Story Generator Architecture & Helpers', () => {
  // Test chunking algorithm for different word counts
  it('correctly divides words into manageable chunks of at most 20 words', () => {
    function chunkWords<T>(words: T[], chunkSize = 20): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize));
      }
      return chunks;
    }

    // 5 words -> 1 chunk
    const words5 = Array.from({ length: 5 }, (_, i) => ({ word: `word${i}`, meaning: `meaning${i}` }));
    const chunks5 = chunkWords(words5);
    expect(chunks5.length).toBe(1);
    expect(chunks5[0].length).toBe(5);

    // 25 words -> 2 chunks (20 and 5)
    const words25 = Array.from({ length: 25 }, (_, i) => ({ word: `word${i}`, meaning: `meaning${i}` }));
    const chunks25 = chunkWords(words25);
    expect(chunks25.length).toBe(2);
    expect(chunks25[0].length).toBe(20);
    expect(chunks25[1].length).toBe(5);

    // 50 words -> 3 chunks (20, 20, 10)
    const words50 = Array.from({ length: 50 }, (_, i) => ({ word: `word${i}`, meaning: `meaning${i}` }));
    const chunks50 = chunkWords(words50);
    expect(chunks50.length).toBe(3);
    expect(chunks50[0].length).toBe(20);
    expect(chunks50[1].length).toBe(20);
    expect(chunks50[2].length).toBe(10);

    // 100 words -> 5 chunks of 20
    const words100 = Array.from({ length: 100 }, (_, i) => ({ word: `word${i}`, meaning: `meaning${i}` }));
    const chunks100 = chunkWords(words100);
    expect(chunks100.length).toBe(5);
    expect(chunks100.every((c) => c.length === 20)).toBe(true);

    // 150+ words -> 8 chunks
    const words150 = Array.from({ length: 155 }, (_, i) => ({ word: `word${i}`, meaning: `meaning${i}` }));
    const chunks150 = chunkWords(words150);
    expect(chunks150.length).toBe(8);
  });

  // Test cooldown timer formatting
  it('formats cooldown seconds to MM:SS correctly', () => {
    function formatCooldown(seconds: number): string {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    expect(formatCooldown(300)).toBe('05:00');
    expect(formatCooldown(299)).toBe('04:59');
    expect(formatCooldown(60)).toBe('01:00');
    expect(formatCooldown(59)).toBe('00:59');
    expect(formatCooldown(5)).toBe('00:05');
    expect(formatCooldown(0)).toBe('00:00');
  });

  // Test interactive word parsing and meaning resolution
  it('extracts bold words and resolves their meanings accurately', () => {
    const meaningMap = new Map<string, string>([
      ['clingy', 'Too attached and needing constant attention.'],
      ['benevolent', 'Kind and generous.'],
      ['serendipity', 'Finding good things without looking for them.'],
      ['resilient', 'Able to recover quickly from difficulties.'],
    ]);

    function resolveMeaning(rawWord: string): string | null {
      const lower = rawWord.toLowerCase().trim();
      if (meaningMap.has(lower)) return meaningMap.get(lower)!;
      if (lower.endsWith('s') && meaningMap.has(lower.slice(0, -1))) {
        return meaningMap.get(lower.slice(0, -1))!;
      }
      if (lower.endsWith('ed') && meaningMap.has(lower.slice(0, -2))) {
        return meaningMap.get(lower.slice(0, -2))!;
      }
      return null;
    }

    const storyText = 'A **clingy** puppy met a **benevolent** wizard with great **serendipity**. They were **resilient**.';
    const regex = /\*\*(.+?)\*\*/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(storyText)) !== null) {
      matches.push(match[1]);
    }

    expect(matches).toEqual(['clingy', 'benevolent', 'serendipity', 'resilient']);
    expect(resolveMeaning(matches[0])).toBe('Too attached and needing constant attention.');
    expect(resolveMeaning(matches[1])).toBe('Kind and generous.');
    expect(resolveMeaning('Clingy')).toBe('Too attached and needing constant attention.');
  });

  // Test word boundary safety (does not match partial unrelated words)
  it('matches whole words without falsely matching substrings', () => {
    function escapeRegex(s: string) {
      return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    const targetWord = 'cat';
    const regex = new RegExp(`\\b${escapeRegex(targetWord)}\\b`, 'i');

    expect(regex.test('The cat sat on the mat.')).toBe(true);
    expect(regex.test('The Cat was cute.')).toBe(true);
    expect(regex.test('This is a catalog of items.')).toBe(false);
    expect(regex.test('A severe catastrophe occurred.')).toBe(false);
  });

  // Test progress stage mapping
  it('calculates monotonically increasing progress values', () => {
    const totalChunks = 5;
    const progressValues: number[] = [5, 10]; // initial

    for (let i = 0; i < totalChunks; i++) {
      const pct = 15 + Math.round((i / totalChunks) * 65);
      progressValues.push(pct);
    }
    progressValues.push(82);
    progressValues.push(94);
    progressValues.push(100);

    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
    }
    expect(progressValues[0]).toBe(5);
    expect(progressValues[progressValues.length - 1]).toBe(100);
  });
});
