import { describe, it, expect } from 'vitest';
import React from 'react';
import { FormattedMeaning } from '../src/components/FormattedMeaning';

describe('FormattedMeaning Component', () => {
  it('renders null when text is empty', () => {
    const el = FormattedMeaning({ text: '' });
    expect(el).toBeNull();
  });

  it('renders plain text when no bold markdown is present', () => {
    const el = FormattedMeaning({ text: 'A simple vocabulary definition without bold.' });
    expect(el).not.toBeNull();
    const children = (el as React.ReactElement).props.children;
    expect(children).toHaveLength(1);
    expect(children[0].props.children).toBe('A simple vocabulary definition without bold.');
  });

  it('highlights phrases enclosed in double asterisks as strong elements', () => {
    const text =
      'Resilient means being able to **recover quickly**, **stay strong**, and **continue moving forward** after facing difficulties.';
    const el = FormattedMeaning({ text });
    expect(el).not.toBeNull();
    const children = (el as React.ReactElement).props.children;
    // Check that strong elements were created
    const strongNodes = children.filter(
      (c: React.ReactElement) => c.type === 'strong'
    );
    expect(strongNodes).toHaveLength(3);
    expect(strongNodes[0].props.children).toBe('recover quickly');
    expect(strongNodes[1].props.children).toBe('stay strong');
    expect(strongNodes[2].props.children).toBe('continue moving forward');
  });

  it('handles Hindi text with selective bolding', () => {
    const text = 'मुश्किलों के बाद भी **जल्दी संभलना**, **मजबूत बने रहना** और आगे बढ़ते रहना।';
    const el = FormattedMeaning({ text });
    expect(el).not.toBeNull();
    const children = (el as React.ReactElement).props.children;
    const strongNodes = children.filter(
      (c: React.ReactElement) => c.type === 'strong'
    );
    expect(strongNodes).toHaveLength(2);
    expect(strongNodes[0].props.children).toBe('जल्दी संभलना');
    expect(strongNodes[1].props.children).toBe('मजबूत बने रहना');
  });
});

