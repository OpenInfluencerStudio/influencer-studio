import { describe, it, expect } from 'vitest';
import { openBrowser } from '../src/open.js';
describe('openBrowser', () => {
  it('refuses anything that is not the local http address', () => {
    for (const u of ['https://example.com/', 'http://example.com:8787/', 'file:///etc/passwd', 'javascript:alert(1)', 'not a url', 'http://127.0.0.1.evil.com/']) expect(openBrowser(u)).toBe(false);
  });
});
