import { create } from '@onkeiki/agents'
import { pocketPrompt } from './prompt.js'

const env = (name: string): string | undefined => Bun.env[name]
const apiKey = env('KEIKI_API_KEY')
const contactCardPhone = env('CONTACT_CARD_PHONE')
const contactCardLogoUrl = env('CONTACT_CARD_LOGO_URL')
const contactCard = contactCardPhone && contactCardLogoUrl
  ? { phone: contactCardPhone, logoUrl: contactCardLogoUrl }
  : undefined

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/text-first-consumer-app/.env before syncing.')
}

const kit = create({
  apiKey,
  name: env('AGENT_NAME') ?? 'Pocket',
  agent: {
    model: 'openai/gpt-6.1-sol',
    reasoningEffort: 'low',
    maxSteps: 20,
    historyLimit: 60,
    systemPrompt: () => pocketPrompt(contactCard ? { contactCard } : {}),
    tools: [],
    sandbox: { enabled: true, persistent: true },
    memory: { enabled: true, provider: 'supermemory' },
    steering: { debounceWindow: '2 seconds', midTurnStrategy: 'interrupt', maxBatch: 5 },
    media: {
      audio: { action: 'transcribe' },
      image: { action: 'describe' },
      video: { action: 'describe' },
      document: { action: 'extract' },
      fallback: '[Unreadable attachment]',
    },
    loops: {
      enabled: true,
      presets: [{
        name: 'morning-brief',
        description: 'A daily morning brief, only after the person opts in and confirms 8am UTC suits them. Otherwise create a custom loop at their chosen local time.',
        prompt: 'Send the opted-in morning brief: use only this person’s remembered priorities and available reminders. Offer one practical next step. Never invent calendar access, weather or news. Keep it to two short sentences and use reply to deliver it. If opted out, do not send anything.',
        scheduleType: 'cron',
        scheduleExpression: '0 8 * * *',
        timezone: 'UTC',
      }],
    },
    scrape: true,
    guards: true,
    promptGuard: true,
  },
})

await kit.sync()
