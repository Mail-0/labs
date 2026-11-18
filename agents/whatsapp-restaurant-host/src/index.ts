import { create } from '@onkeiki/agents'
import { hostPrompt } from './prompt.js'
import { parseConfig } from './scheduling.js'
import { CONFIG_SECRET } from './storage.js'
import { tools } from './tools.js'

const apiKey = Bun.env.KEIKI_API_KEY
if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/whatsapp-restaurant-host/.env before syncing.')
}

const config = parseConfig(Bun.env)
const kit = create({
  apiKey,
  name: config.agentName,
  secrets: {
    KEIKI_STORAGE_API_KEY: apiKey,
    KEIKI_PLATFORM_URL: Bun.env.KEIKI_PLATFORM_URL ?? 'https://onkeiki.com',
    [CONFIG_SECRET]: JSON.stringify(config),
  },
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 40,
    historyLimit: 60,
    reasoningEffort: 'low',
    systemPrompt: () => hostPrompt(config),
    tools,
    memory: { enabled: true, provider: 'supermemory' },
    steering: { debounceWindow: '2 seconds', midTurnStrategy: 'interrupt', maxBatch: 5 },
    media: {
      audio: { action: 'transcribe' },
      image: { action: 'ignore' },
      video: { action: 'ignore' },
      document: { action: 'ignore' },
      fallback: '[Unreadable attachment]',
    },
    guards: true,
    promptGuard: true,
  },
})

await kit.sync()
