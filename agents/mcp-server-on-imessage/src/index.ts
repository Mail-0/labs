import { create } from '@onkeiki/agents'
import { agentConfig } from './config.js'

const apiKey = Bun.env.KEIKI_API_KEY

if (!apiKey) {
  throw new Error('Missing KEIKI_API_KEY. Set it in agents/mcp-server-on-imessage/.env before syncing.')
}

const kit = create({ apiKey, ...agentConfig(Bun.env) })

await kit.sync()
