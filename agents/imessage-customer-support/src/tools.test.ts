import { describe, expect, test } from 'bun:test'
import type { ToolContext } from '@onkeiki/agents'
import { Effect, Schema } from 'effect'
import { createTicket, getOrderStatus, getTicket } from './tools.js'

function contactContext(): ToolContext {
  const store = new Map<string, unknown>()
  return {
    userState: {
      get: (key: string) => Effect.sync(() => store.get(key) ?? null),
      set: (key: string, value: unknown) => Effect.sync(() => { store.set(key, value) }),
    },
  } as ToolContext
}

describe('customer support tools', () => {
  test('looks up fictional orders and reports unknown IDs', async () => {
    const contact = contactContext()
    expect(await Effect.runPromise(getOrderStatus.execute({ orderId: ' ord-1001 ' }, contact)))
      .toMatchObject({ found: true, orderId: 'ORD-1001', status: 'shipped' })
    expect(await Effect.runPromise(getOrderStatus.execute({ orderId: 'ORD-9999' }, contact)))
      .toEqual({ found: false })
  })

  test('creates a ticket and looks it up only for the same contact', async () => {
    const contact = contactContext()
    const ticket = await Effect.runPromise(createTicket.execute({ summary: 'Missing item' }, contact))
    expect(ticket).toMatchObject({ summary: 'Missing item', status: 'open' })
    const input = { ticketId: ticket.id.toLowerCase() }
    expect(await Effect.runPromise(getTicket.execute(input, contact))).toEqual({ found: true, ticket })
    expect(await Effect.runPromise(getTicket.execute(input, contactContext()))).toEqual({ found: false })
  })

  test('rejects blank ticket summaries', () => {
    expect(() => Schema.decodeUnknownSync(createTicket.input)({ summary: '   ' })).toThrow()
  })
})
