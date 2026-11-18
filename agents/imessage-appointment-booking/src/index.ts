import { create, type CapabilityManifest } from '@onkeiki/agents'
import { appointmentPrompt, calComPrompt } from './prompt.js'

const env = (name: string): string | undefined => Bun.env[name]
const apiKey = env('KEIKI_API_KEY')
const calApiKey = env('CAL_API_KEY')

if (!apiKey || !calApiKey) {
  throw new Error('Set KEIKI_API_KEY and CAL_API_KEY in agents/imessage-appointment-booking/.env before syncing.')
}

const timezone = env('TIMEZONE') ?? 'America/New_York'
new Intl.DateTimeFormat('en', { timeZone: timezone })

const calendar = {
  slug: 'cal-com-booking',
  version: '1.0.0',
  title: 'Cal.com Booking',
  description: 'Book, reschedule and cancel appointments on the business owner’s Cal.com account.',
  runtime: 'codemode',
  uses: ['http'],
  secrets: [{ name: 'CAL_API_KEY', required: true }],
  http: { allow: ['api.cal.com'] },
  prompt: calComPrompt,
} satisfies CapabilityManifest

const kit = create({
  apiKey,
  name: env('AGENT_NAME') ?? 'Appointment Booking',
  secrets: { CAL_API_KEY: calApiKey },
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 20,
    historyLimit: 60,
    reasoningEffort: 'low',
    systemPrompt: () => appointmentPrompt({
      businessName: env('BUSINESS_NAME') ?? 'Your Business',
      timezone,
      businessHours: env('BUSINESS_HOURS') ?? 'Monday-Friday, 9am-5pm',
    }),
    tools: [],
    capabilities: [calendar],
    steering: { debounceWindow: '2 seconds', midTurnStrategy: 'interrupt', maxBatch: 5 },
    guards: true,
    promptGuard: true,
  },
})

await kit.sync()
