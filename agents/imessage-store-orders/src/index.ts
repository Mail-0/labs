import { createHash } from 'node:crypto'
import { create, type CapabilityManifest } from '@onkeiki/agents'
import { storeOrdersPrompt } from './prompt.js'

const env = (name: string): string | undefined => Bun.env[name]?.trim() || undefined
const apiKey = env('KEIKI_API_KEY')

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/imessage-store-orders/.env before syncing.')
}

const domain = env('SHOPIFY_STORE_DOMAIN')?.toLowerCase()
if (!domain) {
  throw new Error('Missing SHOPIFY_STORE_DOMAIN. Set it in agents/imessage-store-orders/.env before syncing.')
}
if (
  domain.length > 253 ||
  !domain.includes('.') ||
  !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) ||
  !/[a-z]/.test(domain.split('.').at(-1)!)
) {
  throw new Error('Invalid SHOPIFY_STORE_DOMAIN. Use a hostname such as allbirds.com, without a protocol, port or path.')
}

const storeName = env('STORE_NAME') ?? domain
const domainHash = createHash('sha256').update(domain).digest('hex').slice(0, 16)
const shopify = {
  slug: `shopify-${domain.replaceAll('.', '-').slice(0, 30)}-${domainHash}`,
  version: '1.0.0',
  title: `${storeName} Storefront`,
  description: `Search ${storeName}'s catalog and policies and manage checkout carts.`,
  runtime: 'mcp',
  mcp: { url: `https://${domain}/api/mcp`, auth: 'none' },
} satisfies CapabilityManifest

const kit = create({
  apiKey,
  name: env('AGENT_NAME') ?? 'Store Orders',
  agent: {
    model: 'openai/gpt-6.1-sol',
    maxSteps: 40,
    historyLimit: 60,
    reasoningEffort: 'low',
    systemPrompt: () => storeOrdersPrompt(storeName),
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
    guards: true,
    promptGuard: true,
    capabilities: [shopify],
  },
})

await kit.sync()
