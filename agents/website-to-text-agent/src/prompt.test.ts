import { describe, expect, test } from 'bun:test'
import { siteUrl, websitePrompt } from './prompt.js'

describe('website configuration', () => {
  test('normalizes a source URL and strips the fragment', () => {
    expect(siteUrl(' https://example.com/help#hours ')).toBe('https://example.com/help')
  })

  test('rejects missing or empty configuration', () => {
    for (const value of [undefined, '', '  ']) {
      expect(() => siteUrl(value)).toThrow('Missing SITE_URL')
    }
  })

  test('rejects invalid URLs, non-web protocols and embedded credentials', () => {
    for (const value of ['not a URL', 'file:///etc/passwd', 'https://user:password@example.com']) {
      expect(() => siteUrl(value)).toThrow()
    }
  })

  test('binds research to the configured URL and exact origin', () => {
    const prompt = websitePrompt(siteUrl('https://example.com:8443/help'))
    expect(prompt).toContain('Starting URL: "https://example.com:8443/help"')
    expect(prompt).toContain('Allowed origin: "https://example.com:8443"')
  })
})
