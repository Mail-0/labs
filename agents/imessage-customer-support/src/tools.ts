import { defineTool } from '@onkeiki/agents'
import { Effect, Schema } from 'effect'

const orders = new Map([
  ['ORD-1001', { status: 'shipped', detail: 'The package is on its way.' }],
  ['ORD-1002', { status: 'processing', detail: 'The order is being packed.' }],
  ['ORD-1003', { status: 'delivered', detail: 'The package was delivered.' }],
])

const Ticket = Schema.Struct({
  id: Schema.String,
  summary: Schema.String,
  status: Schema.Literal('open'),
})

const isTicket = Schema.is(Ticket)
const ticketKey = (id: string) => `customer-support:ticket:${id}`
const normalizeId = (id: string) => id.trim().toUpperCase()

export const getOrderStatus = defineTool({
  name: 'get_order_status',
  description: 'Look up the current status of a fictional order by order ID.',
  input: Schema.Struct({ orderId: Schema.String }),
  execute: ({ orderId }) => {
    const id = normalizeId(orderId)
    const order = orders.get(id)
    return Effect.succeed(order ? { found: true, orderId: id, ...order } : { found: false })
  },
})

export const createTicket = defineTool({
  name: 'create_ticket',
  description: 'Open a support ticket for this contact after they confirm the issue summary.',
  input: Schema.Struct({ summary: Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(500)) }),
  execute: ({ summary }, { userState }) => Effect.gen(function* () {
    const ticket: typeof Ticket.Type = {
      id: `TKT-${crypto.randomUUID().toUpperCase()}`,
      summary,
      status: 'open',
    }
    yield* userState.set(ticketKey(ticket.id), ticket)
    return ticket
  }),
})

export const getTicket = defineTool({
  name: 'get_ticket',
  description: 'Look up a ticket belonging to this contact by ticket ID.',
  input: Schema.Struct({ ticketId: Schema.String }),
  execute: ({ ticketId }, { userState }) => Effect.gen(function* () {
    const ticket = yield* userState.get(ticketKey(normalizeId(ticketId)))
    return isTicket(ticket) ? { found: true, ticket } : { found: false }
  }),
})
