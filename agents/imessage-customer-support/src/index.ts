import { create } from '@onkeiki/agents'
import { supportPrompt } from './prompt.js'
import { createTicket, getOrderStatus, getTicket } from './tools.js'

const apiKey = Bun.env.KEIKI_API_KEY

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/imessage-customer-support/.env before syncing.')
}

const kit = create({
  apiKey,
  name: Bun.env.AGENT_NAME ?? 'iMessage Customer Support',
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 10,
    historyLimit: 30,
    systemPrompt: () => supportPrompt,
    tools: [getOrderStatus, createTicket, getTicket],
    escalation: { enabled: true, routes: {} },
  },
})

await kit.sync()
