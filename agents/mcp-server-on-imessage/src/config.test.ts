import { describe, expect, test } from 'bun:test'
import { agentConfig } from './config.js'

describe('MCP configuration', () => {
  test('defaults to a public service with no credentials', () => {
    const config = agentConfig({})
    expect(config.agent.capabilities[0].mcp).toEqual({
      url: 'https://learn.microsoft.com/api/mcp', auth: 'none',
    })
    expect(config.secrets).toBeUndefined()
    expect(config.agent.systemPrompt()).toContain('actual results')
  })

  test('syncs authentication as a secret, not in the manifest or prompt', () => {
    const config = agentConfig({
      MCP_SERVER_URL: 'https://example.com/mcp',
      MCP_AUTH_HEADER: 'X-Api-Key', MCP_AUTH_VALUE: 'test-token',
    })
    expect(config.secrets).toEqual({ MCP_AUTH_VALUE: 'test-token' })
    expect(config.agent.capabilities[0].mcp.headers).toEqual({ 'X-Api-Key': '{{MCP_AUTH_VALUE}}' })
    expect(JSON.stringify(config.agent)).not.toContain('test-token')
  })

  test('treats an empty optional credential as unauthenticated', () => {
    expect(agentConfig({ MCP_AUTH_VALUE: '' }).agent.capabilities[0].mcp.auth).toBe('none')
  })

  test('rejects invalid endpoints and header names', () => {
    for (const MCP_SERVER_URL of ['', 'not-a-url', 'http://example.com', 'https://user:pass@example.com']) {
      expect(() => agentConfig({ MCP_SERVER_URL })).toThrow()
    }
    expect(() => agentConfig({ MCP_AUTH_HEADER: 'bad\nheader' })).toThrow()
  })
})
