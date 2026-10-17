import { create } from '@onkeiki/agents'
import { lovablePrompt } from './prompt.js'

const env = (name: string): string | undefined => Bun.env[name]
const apiKey = env('KEIKI_API_KEY')

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/lovable/.env before syncing.')
}

const clientId = env('LOVABLE_OAUTH_CLIENT_ID')
const clientSecret = env('LOVABLE_OAUTH_CLIENT_SECRET')
const contactCardPhone = env('CONTACT_CARD_PHONE')
const contactCardLogoUrl = env('CONTACT_CARD_LOGO_URL')
const contactCard =
  contactCardPhone && contactCardLogoUrl
    ? { phone: contactCardPhone, logoUrl: contactCardLogoUrl }
    : undefined

const kit = create({
  apiKey,
  name: env('AGENT_NAME') ?? 'Lovable',
  secrets:
    clientId && clientSecret
      ? {
          LOVABLE_OAUTH_CLIENT_ID: clientId,
          LOVABLE_OAUTH_CLIENT_SECRET: clientSecret,
        }
      : undefined,
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 40,
    historyLimit: 60,
    reasoningEffort: 'low',
    systemPrompt: () => lovablePrompt(contactCard ? { contactCard } : {}),
    tools: [],
    memory: { enabled: true, provider: 'supermemory' },
    browser: { enabled: true },
    sandbox: { enabled: true, persistent: true },
    mcp: {
      enabled: true,
      userConnections: [{
        kind: 'mcp',
        name: 'lovable',
        vendor: 'lovable',
        description: "The user's own Lovable account: build, edit, inspect and publish their apps.",
        endpoint: 'https://mcp.lovable.dev',
        oauth: {
          clientIdSecret: 'LOVABLE_OAUTH_CLIENT_ID',
          clientSecretSecret: 'LOVABLE_OAUTH_CLIENT_SECRET',
        },
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
    capabilities: [{ slug: 'images', version: '1.1.0' }],
  },
})

await kit.sync()
