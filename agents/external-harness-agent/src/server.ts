import { createTurnClient, KeikiSignatureError, verifyKeikiRequest, type KeikiTurn } from '@onkeiki/channels'
import { runAgent } from './agent.js'

type Agent = (turn: KeikiTurn, signal: AbortSignal) => Promise<string | null>

export function createHandler(signingSecret: string, agent: Agent = runAgent) {
  if (!signingSecret) throw new Error('Set KEIKI_SIGNING_SECRET before starting the server.')
  const active = new Map<string, AbortController>()
  const jobs = new Set<Promise<void>>()

  async function execute(turn: KeikiTurn, turnToken: string, controller: AbortController) {
    const client = createTurnClient({ turnUrl: turn.keiki.turnUrl, turnToken })
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(Math.max(1, Date.parse(turn.deadline) - Date.now()))])
      const reply = await agent(turn, signal)
      signal.throwIfAborted()
      if (reply && !turn.silent && !turn.quietLoop) {
        const result = await client.message(reply, { idempotencyKey: `${turn.turnId}:reply` })
        if (!result.ok) throw new Error(`message_delivery_failed:${result.code}`)
      }
      const result = await client.complete({ status: 'completed' })
      if (!result.ok) throw new Error('completion_failed')
    } catch {
      const result = await client.complete({ status: 'failed', error: 'external_agent_failed' })
      if (!result.ok) console.error('Unable to report turn failure')
    } finally {
      active.delete(turn.turnId)
    }
  }

  return {
    async fetch(request: Request): Promise<Response> {
      const path = new URL(request.url).pathname
      if (path === '/health' && request.method === 'GET') return new Response('ok')
      if (path !== '/keiki/turn') return new Response('Not found', { status: 404 })
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
      try {
        const verified = verifyKeikiRequest({ rawBody: await request.text(), headers: request.headers }, { signingSecret })
        if (verified.kind === 'cancelled') {
          active.get(verified.cancelled.turnId)?.abort()
        } else if (verified.kind === 'turn') {
          if (!active.has(verified.turn.turnId)) {
            const controller = new AbortController()
            active.set(verified.turn.turnId, controller)
            const job = execute(verified.turn, verified.turnToken, controller)
            jobs.add(job)
            void job.finally(() => jobs.delete(job))
          }
        } else if (verified.kind === 'arrival') {
          return new Response('Use queue steering for this example', { status: 409 })
        }
        return new Response(null, { status: 202 })
      } catch (error) {
        if (error instanceof KeikiSignatureError) return Response.json({ error: error.code }, { status: 401 })
        return Response.json({ error: 'invalid_request' }, { status: 400 })
      }
    },
    async idle() { await Promise.all(jobs) },
  }
}

if (import.meta.main) {
  const handler = createHandler(Bun.env.KEIKI_SIGNING_SECRET ?? '')
  const server = Bun.serve({ port: Number(Bun.env.PORT ?? 8789), fetch: handler.fetch })
  console.log(`External harness listening on ${server.url}`)
}
