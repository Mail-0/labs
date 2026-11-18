import { create } from '@onkeiki/agents'
import { siteUrl, websitePrompt } from './prompt.js'

const env = (name: string): string | undefined => Bun.env[name]
const apiKey = env('KEIKI_API_KEY')

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/website-to-text-agent/.env before syncing.')
}

const url = siteUrl(env('SITE_URL'))
const kit = create({
  apiKey,
  name: env('AGENT_NAME') ?? 'Website to Text',
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 20,
    historyLimit: 60,
    reasoningEffort: 'low',
    systemPrompt: () => websitePrompt(url),
    tools: [],
    scrape: true,
    guards: true,
    promptGuard: true,
  },
})

await kit.sync()
