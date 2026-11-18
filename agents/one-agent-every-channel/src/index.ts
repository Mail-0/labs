import { create } from '@onkeiki/agents'
import { assistantPrompt } from './prompt.js'

const apiKey = Bun.env.KEIKI_API_KEY

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/one-agent-every-channel/.env before syncing.')
}

const kit = create({
  apiKey,
  name: Bun.env.AGENT_NAME ?? 'One Agent Every Channel',
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 10,
    historyLimit: 60,
    reasoningEffort: 'low',
    systemPrompt: () => assistantPrompt,
    tools: [],
    memory: { enabled: true, provider: 'supermemory' },
  },
})

await kit.sync()
