import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from '../../src/util/html';

describe('decodeHtmlEntities', () => {
  it('decodes common named entities', () => {
    expect(decodeHtmlEntities('AAPL &quot;소식&quot;')).toBe('AAPL "소식"');
    expect(decodeHtmlEntities('A &amp; B')).toBe('A & B');
    expect(decodeHtmlEntities('&lt;tag&gt;')).toBe('<tag>');
  });

  it('decodes numeric entities (decimal/hex)', () => {
    expect(decodeHtmlEntities('&#39;quoted&#39;')).toBe("'quoted'");
    expect(decodeHtmlEntities('&#x27;hex&#x27;')).toBe("'hex'");
  });

  it('handles double-encoded entities', () => {
    expect(decodeHtmlEntities('&amp;quot;x&amp;quot;')).toBe('"x"');
  });

  it('preserves text without entities', () => {
    expect(decodeHtmlEntities('plain text 한글')).toBe('plain text 한글');
  });

  it('handles null/empty safely', () => {
    expect(decodeHtmlEntities(null)).toBe('');
    expect(decodeHtmlEntities(undefined)).toBe('');
    expect(decodeHtmlEntities('')).toBe('');
  });

  it('leaves unknown entities intact', () => {
    expect(decodeHtmlEntities('&unknownentity;')).toBe('&unknownentity;');
  });
});
