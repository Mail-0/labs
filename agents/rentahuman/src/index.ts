import { create } from '@onkeiki/agents'
import { rentahumanPrompt } from './prompt.js'

const env = (name: string): string | undefined => Bun.env[name]
const apiKey = env('KEIKI_API_KEY')

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/rentahuman/.env before syncing.')
}

const kit = create({
  apiKey,
  name: env('AGENT_NAME') ?? 'RentAHuman',
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 40,
    historyLimit: 60,
    reasoningEffort: 'low',
    systemPrompt: () => rentahumanPrompt(),
    tools: [],
    memory: { enabled: true, provider: 'supermemory' },
    sandbox: { enabled: true, persistent: true },
    mcp: {
      enabled: true,
      userConnections: [{
        kind: 'mcp',
        name: 'rentahuman',
        vendor: 'rentahuman',
        description:
          "Use each person's own RentAHuman account to search humans, preview and post bounties, follow applications, read and send bounty messages, and review submitted proof. Each user signs in to their own account; no shared creator credentials.",
        aliases: ['rent a human', 'rentahuman.ai', 'rent-a-human'],
        capabilities: ['humans.search', 'bounties.create', 'bounties.read', 'applications.read', 'conversations.read', 'conversations.write', 'submissions.read'],
        endpoint: 'https://rentahuman.ai/api/mcp',
      }],
    },
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
