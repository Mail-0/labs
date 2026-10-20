import { create } from '@onkeiki/agents'
import { linearPrompt } from './prompt.js'

const env = (name: string): string | undefined => Bun.env[name]
const apiKey = env('KEIKI_API_KEY')

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/linear/.env before syncing.')
}

const contactCardPhone = env('CONTACT_CARD_PHONE')
const contactCardLogoUrl = env('CONTACT_CARD_LOGO_URL')
const contactCard =
  contactCardPhone && contactCardLogoUrl
    ? { phone: contactCardPhone, logoUrl: contactCardLogoUrl }
    : undefined

const kit = create({
  apiKey,
  name: env('AGENT_NAME') ?? 'Linear',
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 40,
    historyLimit: 60,
    reasoningEffort: 'low',
    systemPrompt: () => linearPrompt(contactCard ? { contactCard } : {}),
    tools: [],
    memory: { enabled: true, provider: 'supermemory' },
    browser: { enabled: true },
    sandbox: { enabled: true, persistent: true },
    mcp: {
      enabled: true,
      userConnections: [{
        kind: 'mcp',
        name: 'linear',
        vendor: 'linear',
        description:
          "Use each person's own Linear account to find, create and update issues, organize projects and summarize work. Each user authorizes their own account; no shared creator credentials.",
        aliases: ['linear.app'],
        capabilities: ['issues.read', 'issues.write', 'projects.read', 'projects.write', 'comments.write', 'cycles.read'],
        endpoint: 'https://mcp.linear.app/mcp',
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
    scrape: true,
    guards: true,
    promptGuard: true,
  },
})

await kit.sync()
