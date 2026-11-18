import { Effect } from 'effect'
import { isDeepStrictEqual } from 'node:util'
import type { ToolContext } from '@onkeiki/agents'
import type { Config } from './scheduling.js'

export const CONFIG_SECRET = 'RESTAURANT_HOST_CONFIG'
export const MAX_ROWS = 2000
export type Stored = { id: string; phone: string }
type Page<T> = { rows: { data: T }[]; total: number }
const agentIds = new Map<string, string>()

export class RestaurantStore {
  constructor(private readonly baseUrl: string, private readonly apiKey: string, private readonly agentId: string) {}

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/api/v1/developer${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`Restaurant storage request failed (${response.status}). No success is confirmed; check the current record before retrying.`)
    return response
  }

  async read<T extends Stored>(entity: string, filter?: Record<string, unknown>): Promise<T[]> {
    const result: T[] = []
    for (let offset = 0; ; offset += 100) {
      const query = new URLSearchParams({ limit: '100', offset: String(offset) })
      if (filter) query.set('filter', JSON.stringify(filter))
      const response = await this.request(`/agents/${encodeURIComponent(this.agentId)}/storage/${entity}?${query}`)
      const page = await response.json() as Page<T>
      if (page.total > MAX_ROWS) throw new Error('Restaurant book is too large for this example. Please ask staff to maintain the book.')
      result.push(...page.rows.map((row) => row.data))
      if (result.length >= page.total) return result
      if (!page.rows.length || offset >= MAX_ROWS) throw new Error('Restaurant book changed while reading. Check status before retrying.')
    }
  }

  async replace<T extends Stored>(entity: string, rows: T[], changed: T): Promise<void> {
    if (rows.length > MAX_ROWS) throw new Error('Restaurant book is full. Please ask staff for help.')
    await this.request(`/agents/${encodeURIComponent(this.agentId)}/storage/${entity}`, {
      method: 'PUT', body: JSON.stringify({ rows }),
    })
    const saved = await this.read<T>(entity, { id: changed.id, phone: changed.phone })
    if (saved.length !== 1 || !isDeepStrictEqual(saved[0], changed)) {
      throw new Error('The write could not be verified, possibly due to another update. Check your current status before retrying.')
    }
  }
}

export async function restaurantRuntime(ctx: ToolContext): Promise<{ config: Config; store: RestaurantStore }> {
  const secret = (name: string) => Effect.runPromise(ctx.secrets.get(name))
  const [apiKey, platformUrl, rawConfig] = await Promise.all([
    secret('KEIKI_STORAGE_API_KEY'), secret('KEIKI_PLATFORM_URL'), secret(CONFIG_SECRET),
  ])
  if (!apiKey || !rawConfig) throw new Error('Restaurant storage is not configured. Please contact the operator.')
  const config = JSON.parse(rawConfig) as Config
  const baseUrl = (platformUrl || 'https://onkeiki.com').replace(/\/$/, '')
  const url = new URL(baseUrl)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('KEIKI_PLATFORM_URL must use HTTPS (or HTTP on localhost for development).')
  }
  const cacheKey = JSON.stringify([baseUrl, apiKey, config.agentName])
  let agentId = agentIds.get(cacheKey)
  if (!agentId) {
    const response = await fetch(`${baseUrl}/api/v1/developer/agents`, {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`Restaurant agent lookup failed (${response.status}). Please contact the operator.`)
    const { agents } = await response.json() as { agents: { agent_id: string; name: string }[] }
    const matches = agents.filter((agent) => agent.name === config.agentName)
    if (matches.length !== 1) throw new Error('Restaurant agent name must resolve to exactly one agent. Please contact the operator.')
    agentId = matches[0]!.agent_id
    agentIds.set(cacheKey, agentId)
  }
  return { config, store: new RestaurantStore(baseUrl, apiKey, agentId) }
}
