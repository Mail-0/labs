import { afterEach, expect, test } from 'bun:test'
import { createHmac } from 'node:crypto'
import type { KeikiTurn } from '@onkeiki/channels'
import { createHandler } from './server.js'

const secret = 'whsec_local_smoke_test'
const servers: ReturnType<typeof Bun.serve>[] = []
afterEach(() => { for (const server of servers.splice(0)) server.stop(true) })

function fixture() {
  const calls: { path: string; body: unknown; authorization: string | null }[] = []
  const platform = Bun.serve({ port: 0, async fetch(request) {
    calls.push({ path: new URL(request.url).pathname, body: await request.json(), authorization: request.headers.get('authorization') })
    return Response.json({ ok: true })
  } })
  servers.push(platform)
  const turn: KeikiTurn = {
    type: 'keiki.turn', version: 1, turnId: 'turn-smoke', agentId: 'agent-smoke',
    conversationId: 'conversation-smoke', channel: { channel: 'sms' }, heldBack: true, silent: false, quietLoop: false,
    messages: [{ text: 'hello', content: 'hello' }], history: [], context: {}, instructions: 'Reply briefly.',
    deadline: new Date(Date.now() + 60_000).toISOString(),
    keiki: { apiBase: platform.url.href, turnUrl: `${platform.url}turns/turn-smoke`, mcpUrl: `${platform.url}mcp` },
  }
  return { calls, turn }
}

function start(agent?: Parameters<typeof createHandler>[1]) {
  const handler = createHandler(secret, agent)
  const server = Bun.serve({ port: 0, fetch: handler.fetch })
  servers.push(server)
  return { handler, server }
}

function post(server: ReturnType<typeof Bun.serve>, body: unknown, key = secret, timestamp = Math.floor(Date.now() / 1000)) {
  const rawBody = JSON.stringify(body)
  const signature = createHmac('sha256', key).update(`${timestamp}.${rawBody}`).digest('hex')
  return fetch(new URL('/keiki/turn', server.url), {
    method: 'POST', body: rawBody,
    headers: { 'Keiki-Signature': `t=${timestamp},v1=${signature}`, 'Keiki-Turn-Id': 'turn-smoke', 'Keiki-Turn-Token': 'ht_smoke' },
  })
}

test('smoke: signed HTTP turn replies through the turn API; invalid signature is rejected', async () => {
  const { calls, turn } = fixture()
  const { handler, server } = start()
  const valid = await post(server, turn)
  expect(valid.status).toBe(202)
  await handler.idle()
  expect(calls).toEqual([
    { path: '/turns/turn-smoke/messages', body: { text: 'Your harness received: hello', idempotencyKey: 'turn-smoke:reply' }, authorization: 'Bearer ht_smoke' },
    { path: '/turns/turn-smoke/complete', body: { status: 'completed' }, authorization: 'Bearer ht_smoke' },
  ])
  const invalid = await post(server, turn, 'wrong-secret')
  expect(invalid.status).toBe(401)
  expect(await invalid.json()).toEqual({ error: 'invalid_signature' })
  expect(calls).toHaveLength(2)
  console.log('Smoke: signed turn -> 202, reply "Your harness received: hello", completed; invalid signature -> 401, no extra calls')
})

test.each(['empty', 'silent', 'quietLoop'])('%s turn completes without replying', async mode => {
  const { calls, turn } = fixture()
  if (mode === 'empty') turn.messages = []
  else if (mode === 'silent') turn.silent = true
  else turn.quietLoop = true
  const { handler, server } = start()
  expect((await post(server, turn)).status).toBe(202)
  await handler.idle()
  expect(calls.map(call => call.body)).toEqual([{ status: 'completed' }])
})

test('agent error reports a failed turn without leaking error details', async () => {
  const { calls, turn } = fixture()
  const { handler, server } = start(async () => { throw new Error('private details') })
  expect((await post(server, turn)).status).toBe(202)
  await handler.idle()
  expect(calls.map(call => call.body)).toEqual([{ status: 'failed', error: 'external_agent_failed' }])
})

test('stale signatures and malformed signed payloads do not run the agent', async () => {
  const { calls, turn } = fixture()
  const { server } = start()
  expect((await post(server, turn, secret, 1)).status).toBe(401)
  expect((await post(server, {})).status).toBe(401)
  expect(calls).toHaveLength(0)
})
