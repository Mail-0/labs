import { create } from '@onkeiki/agents'
import { systemPrompt } from './prompt.js'

const apiKey = Bun.env.KEIKI_API_KEY
const dispatchUrl = Bun.env.DISPATCH_URL
if (!apiKey || !dispatchUrl) throw new Error('Set KEIKI_API_KEY and DISPATCH_URL in .env before syncing.')

const kit = create({
  apiKey,
  name: Bun.env.AGENT_NAME ?? 'External Harness Agent',
  harness: { type: 'external', connectivity: 'push', dispatchUrl, timeoutMs: '10 minutes' },
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 10,
    historyLimit: 40,
    systemPrompt: () => systemPrompt,
    tools: [],
    steering: { debounceWindow: '2 seconds', midTurnStrategy: 'queue', maxBatch: 5 },
  },
})

await kit.sync()
