import type { CapabilityManifest } from '@onkeiki/agents'
import { mcpPrompt } from './prompt.js'

export function agentConfig(env: Record<string, string | undefined>) {
  const endpoint = env.MCP_SERVER_URL ?? 'https://learn.microsoft.com/api/mcp'
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('MCP_SERVER_URL must use HTTPS without embedded credentials.')
  }
  const header = env.MCP_AUTH_HEADER ?? 'Authorization'
  if (!/^[!#$%&'*+.^_`|~\w-]+$/.test(header)) {
    throw new Error('MCP_AUTH_HEADER must be a valid HTTP header name.')
  }
  const authenticated = !!env.MCP_AUTH_VALUE
  const capability = {
    slug: 'imessage-mcp-service',
    version: '1.0.0',
    title: 'Connected service',
    description: 'Use the configured MCP service from an iMessage conversation.',
    runtime: 'mcp',
    mcp: {
      url: endpoint,
      auth: authenticated ? 'headers' : 'none',
      ...(authenticated ? { headers: { [header]: '{{MCP_AUTH_VALUE}}' } } : {}),
    },
    ...(authenticated ? { secrets: [{ name: 'MCP_AUTH_VALUE', required: true }] } : {}),
    prompt: 'Use this service for customer requests. Inspect its tools and use actual results; never invent tool output.',
  } satisfies CapabilityManifest

  return {
    name: env.AGENT_NAME ?? 'MCP on iMessage',
    secrets: authenticated ? { MCP_AUTH_VALUE: env.MCP_AUTH_VALUE! } : undefined,
    agent: {
      model: 'openai/gpt-6.1-sol',
      maxSteps: 20,
      historyLimit: 60,
      reasoningEffort: 'low' as const,
      systemPrompt: () => mcpPrompt,
      tools: [],
      sandbox: { enabled: true, persistent: true },
      guards: true,
      promptGuard: true,
      capabilities: [capability],
    },
  }
}
