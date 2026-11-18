import { create } from '@onkeiki/agents'
import { systemPrompt } from './prompt.js'

const apiKey = Bun.env.KEIKI_API_KEY
const dispatchUrl = Bun.env.HARNESS_URL
if (!apiKey || !dispatchUrl) {
  throw new Error('Set KEIKI_API_KEY and HARNESS_URL in .env before syncing.')
}

const kit = create({
  apiKey,
  name: Bun.env.AGENT_NAME ?? 'AI SDK on iMessage',
  harness: {
    type: 'external',
    connectivity: 'push',
    dispatchUrl,
    timeoutMs: '5 minutes',
  },
  agent: {
    model: Bun.env.OPENROUTER_MODEL ?? 'openai/gpt-4.1-mini',
    maxSteps: 10,
    historyLimit: 40,
    systemPrompt: () => systemPrompt,
    tools: [],
    mcp: { enabled: true },
  },
})

await kit.sync()
