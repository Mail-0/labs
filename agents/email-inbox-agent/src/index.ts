import { create } from '@onkeiki/agents'
import { inboxPrompt } from './prompt.js'

const env = (name: string): string | undefined => Bun.env[name]
const apiKey = env('KEIKI_API_KEY')

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/email-inbox-agent/.env before syncing.')
}

const kit = create({
  apiKey,
  name: env('AGENT_NAME') ?? 'Inbox',
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 40,
    historyLimit: 60,
    reasoningEffort: 'low',
    systemPrompt: () => inboxPrompt(env('BUSINESS_CONTEXT')),
    tools: [],
    memory: { enabled: true, provider: 'supermemory' },
    steering: { debounceWindow: '2 seconds', midTurnStrategy: 'interrupt', maxBatch: 5 },
    media: {
      audio: { action: 'transcribe' },
      image: { action: 'describe' },
      video: { action: 'describe' },
      document: { action: 'extract' },
      fallback: '[Unreadable attachment]',
    },
    loops: { enabled: true },
    guards: true,
    promptGuard: true,
  },
})

await kit.sync()
