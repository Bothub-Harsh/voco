import { describe, it, expect } from 'vitest';
import React from 'react';
import { FormattedMeaning } from '../src/components/FormattedMeaning';

describe('FormattedMeaning Component', () => {
  it('renders null when text is empty or non-string', () => {
    expect(FormattedMeaning({ text: '' })).toBeNull();
  });

  it('renders plain text when no bold markdown is present', () => {
    const el = FormattedMeaning({ text: 'A simple definition without bold.' });
    expect(el).not.toBeNull();
    const children = (el as React.ReactElement).props.children;
    expect(children).toBe('A simple definition without bold.');
  });

  it('correctly parses user case: **calms worries** and **gives confidence**', () => {
    const text = 'It **calms worries** and **gives confidence** during tough times.';
    const el = FormattedMeaning({ text });
    expect(el).not.toBeNull();
    const children = (el as React.ReactElement).props.children;

    const strongNodes = children.filter(
      (c: React.ReactElement) => c.type === 'strong'
    );
    expect(strongNodes).toHaveLength(2);
    expect(strongNodes[0].props.children).toBe('calms worries');
    expect(strongNodes[1].props.children).toBe('gives confidence');
  });

  it('handles escaped markdown syntax from AI (\\*\\*word\\*\\*)', () => {
    const text = 'She \\*\\*calms worries\\*\\* when speaking.';
    const el = FormattedMeaning({ text });
    expect(el).not.toBeNull();
    const children = (el as React.ReactElement).props.children;

    const strongNodes = children.filter(
      (c: React.ReactElement) => c.type === 'strong'
    );
    expect(strongNodes).toHaveLength(1);
    expect(strongNodes[0].props.children).toBe('calms worries');
  });

  it('handles double underscores (__phrase__)', () => {
    const text = 'Always __stays strong__ in difficulties.';
    const el = FormattedMeaning({ text });
    expect(el).not.toBeNull();
    const children = (el as React.ReactElement).props.children;

    const strongNodes = children.filter(
      (c: React.ReactElement) => c.type === 'strong'
    );
    expect(strongNodes).toHaveLength(1);
    expect(strongNodes[0].props.children).toBe('stays strong');
  });

  it('handles extra internal whitespace (** word **)', () => {
    const text = 'Being **  resilient  ** is key.';
    const el = FormattedMeaning({ text });
    expect(el).not.toBeNull();
    const children = (el as React.ReactElement).props.children;

    const strongNodes = children.filter(
      (c: React.ReactElement) => c.type === 'strong'
    );
    expect(strongNodes).toHaveLength(1);
    expect(strongNodes[0].props.children).toBe('resilient');
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

  it('never displays raw ** or __ to users even if unclosed', () => {
    const text = 'Here is **an unclosed bold phrase';
    const el = FormattedMeaning({ text });
    expect(el).not.toBeNull();
    const rendered = (el as React.ReactElement).props.children;
    expect(rendered).not.toContain('**');
    expect(rendered).toContain('Here is an unclosed bold phrase');
  });
});
