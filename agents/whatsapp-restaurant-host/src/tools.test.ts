import { afterEach, beforeEach, describe, expect, mock, setSystemTime, test } from 'bun:test'
import { Effect, Schema } from 'effect'
import type { ToolContext, ToolDefinition } from '@onkeiki/agents'
import { parseConfig } from './scheduling.js'
import { CONFIG_SECRET, MAX_ROWS, RestaurantStore } from './storage.js'
import { bookTable, cancelReservation, changeReservation, checkAvailability, joinWaitlist, leaveWaitlist, listMyReservations, waitlistStatus } from './tools.js'

type Row = Record<string, unknown> & { id: string; phone: string }
const originalFetch = globalThis.fetch
let database: Record<string, Row[]>
let requests: { path: string; method: string; filter: Record<string, unknown> | undefined }[]
let failedStatus: number | undefined
let dropWrites: boolean
let keyCounter = 0
let key: string
const config = parseConfig({})

function context(phone = 'guest-one'): ToolContext {
  const secrets: Record<string, string> = {
    KEIKI_STORAGE_API_KEY: key, KEIKI_PLATFORM_URL: 'https://example.test',
    [CONFIG_SECRET]: JSON.stringify(config),
  }
  return { phone, secrets: { get: (name: string) => Effect.succeed(secrets[name] ?? null) } } as ToolContext
}

async function execute<I, O>(tool: ToolDefinition<I, O>, input: I, phone?: string) {
  return Effect.runPromise(tool.execute(Schema.decodeUnknownSync(tool.input)(input), context(phone)))
}

beforeEach(() => {
  setSystemTime(new Date('2030-01-01T22:05:00Z'))
  database = { host_reservations: [], host_waitlist: [] }
  requests = []
  failedStatus = undefined
  dropWrites = false
  key = `fake-key-${++keyCounter}`
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const filter = url.searchParams.has('filter') ? JSON.parse(url.searchParams.get('filter')!) as Record<string, unknown> : undefined
    requests.push({ path: url.pathname, method, filter })
    if (failedStatus) return Response.json({ error: 'failure' }, { status: failedStatus })
    if (url.pathname.endsWith('/agents')) return Response.json({ agents: [{ agent_id: 'test-agent', name: config.agentName }] })
    const entity = url.pathname.split('/').at(-1)!
    if (method === 'PUT') {
      if (!dropWrites) database[entity] = (JSON.parse(String(init!.body)) as { rows: Row[] }).rows
      return Response.json({ rows: database[entity]!.length })
    }
    const rows = database[entity]!.filter((row) => !filter || Object.entries(filter).every(([field, value]) => row[field] === value))
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 100)
    return Response.json({ total: rows.length, rows: rows.slice(offset, offset + limit).map((data) => ({ data })) })
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  setSystemTime()
})

describe('shared reservation tools', () => {
  const booking = { name: 'Pat', party_size: 4, date: '2030-01-02', time: '18:30', notes: 'Peanut allergy; ask staff' }

  test('books, lists, changes and cancels with own guest identity', async () => {
    expect(await execute(listMyReservations, {})).toEqual({ reservations: [] })
    expect(await execute(bookTable, booking)).toEqual(expect.objectContaining({ reservation: expect.objectContaining({ name: 'Pat', notes: booking.notes, status: 'confirmed' }) }))
    const id = database.host_reservations![0]!.id
    expect(await execute(listMyReservations, {}, 'other-guest')).toEqual({ reservations: [] })
    expect(await execute(changeReservation, { ...booking, reservation_id: id, time: '20:00' })).toEqual(expect.objectContaining({ reservation: expect.objectContaining({ time: '20:00' }) }))
    expect(await execute(cancelReservation, { reservation_id: id })).toEqual(expect.objectContaining({ reservation: expect.objectContaining({ status: 'cancelled' }) }))
    expect(await execute(cancelReservation, { reservation_id: id })).toEqual(expect.objectContaining({ reservation: expect.objectContaining({ status: 'cancelled' }) }))
    expect(await execute(changeReservation, { ...booking, reservation_id: id })).toEqual({ error: 'That reservation is cancelled. Make a new booking instead.' })
    expect(requests.some((r) => r.filter?.phone === 'other-guest')).toBe(true)
  })

  test('counts other guests, re-checks capacity and frees cancelled seats', async () => {
    await execute(bookTable, { ...booking, party_size: 8 })
    await execute(bookTable, { ...booking, party_size: 8 }, 'guest-two')
    await execute(bookTable, { ...booking, party_size: 8 }, 'guest-three')
    expect(await execute(checkAvailability, { date: booking.date, time: booking.time, party_size: 7 })).toEqual(expect.objectContaining({ slots: ['17:00', '20:00'] }))
    expect(await execute(bookTable, { ...booking, party_size: 7 }, 'guest-four')).toEqual(expect.objectContaining({ error: expect.stringContaining('unavailable') }))
    await execute(cancelReservation, { reservation_id: database.host_reservations![0]!.id })
    expect(await execute(bookTable, { ...booking, party_size: 7 }, 'guest-four')).toEqual(expect.objectContaining({ reservation: expect.objectContaining({ party_size: 7 }) }))
  })

  test('changes exclude the original seats but cannot exceed another slot capacity', async () => {
    await execute(bookTable, { ...booking, party_size: 8 })
    const id = database.host_reservations![0]!.id
    expect(await execute(changeReservation, { ...booking, party_size: 8, reservation_id: id })).not.toHaveProperty('error')
    database.host_reservations!.push({ ...booking, id: 'full-slot', phone: 'other', time: '20:00', party_size: 30, status: 'confirmed' })
    expect(await execute(changeReservation, { ...booking, reservation_id: id, time: '20:00' })).toHaveProperty('error')
    expect(database.host_reservations![0]!.time).toBe('18:30')
  })

  test('refuses another guest’s IDs, missing IDs, invalid dates, large parties and blank names', async () => {
    await execute(bookTable, booking)
    const reservation_id = database.host_reservations![0]!.id
    expect(await execute(cancelReservation, { reservation_id }, 'intruder')).toHaveProperty('error')
    expect(await execute(changeReservation, { ...booking, reservation_id }, 'intruder')).toHaveProperty('error')
    expect(await execute(cancelReservation, { reservation_id: 'missing' })).toHaveProperty('error')
    expect(await execute(bookTable, { ...booking, date: '2030-02-30' })).toHaveProperty('error')
    expect(await execute(bookTable, { ...booking, party_size: 9 })).toEqual(expect.objectContaining({ error: expect.stringContaining('call the restaurant') }))
    expect(await execute(bookTable, { ...booking, name: ' ' })).toHaveProperty('error')
    expect(() => Schema.decodeUnknownSync(bookTable.input)({ ...booking, party_size: 0 })).toThrow()
    expect(database.host_reservations).toHaveLength(1)
  })
})

describe('shared walk-in tools', () => {
  test('empty, join, idempotent join, status, leave and next-day isolation', async () => {
    expect(await execute(waitlistStatus, {})).toHaveProperty('status', 'not_waiting')
    expect(await execute(leaveWaitlist, {})).toHaveProperty('status', 'not_waiting')
    expect(await execute(joinWaitlist, { name: 'Alex', party_size: 8 })).toEqual(expect.objectContaining({ position: 1, quote_minutes: 90 }))
    expect(await execute(joinWaitlist, { name: 'Alex', party_size: 8 })).toHaveProperty('position', 1)
    expect(database.host_waitlist).toHaveLength(1)
    setSystemTime(new Date('2030-01-01T22:06:00Z'))
    expect(await execute(joinWaitlist, { name: 'Sam', party_size: 4 }, 'guest-two')).toHaveProperty('position', 2)
    expect(await execute(waitlistStatus, {}, 'guest-two')).toHaveProperty('position', 2)
    expect(await execute(leaveWaitlist, {})).toHaveProperty('status', 'left')
    expect(await execute(waitlistStatus, {}, 'guest-two')).toHaveProperty('position', 1)
    setSystemTime(new Date('2030-01-02T22:05:00Z'))
    expect(await execute(waitlistStatus, {}, 'guest-two')).toHaveProperty('status', 'not_waiting')
    expect(await execute(joinWaitlist, { name: 'Sam', party_size: 4 }, 'guest-two')).toHaveProperty('position', 1)
  })

  test('rejects large parties, blank names and service after closing', async () => {
    expect(await execute(joinWaitlist, { name: 'Alex', party_size: 9 })).toHaveProperty('error')
    expect(await execute(joinWaitlist, { name: ' ', party_size: 2 })).toHaveProperty('error')
    setSystemTime(new Date('2030-01-02T03:00:00Z'))
    expect(await execute(joinWaitlist, { name: 'Alex', party_size: 2 })).toEqual(expect.objectContaining({ error: expect.stringContaining('closed for today') }))
    expect(database.host_waitlist).toHaveLength(0)
  })
})

describe('storage boundary', () => {
  test('paginates without losing rows during replacement and filters write verification', async () => {
    database.host_reservations = Array.from({ length: 101 }, (_, i) => ({ id: String(i), phone: 'guest' }))
    const store = new RestaurantStore('https://example.test', 'fake', 'test-agent')
    const rows = await store.read<Row>('host_reservations')
    expect(rows).toHaveLength(101)
    const changed = { id: 'new', phone: 'guest-one', name: 'Pat' }
    await store.replace('host_reservations', [...rows, changed], changed)
    expect(database.host_reservations).toHaveLength(102)
    expect(requests.at(-1)!.filter).toEqual({ id: 'new', phone: 'guest-one' })
  })

  test('handles provider errors, oversized books, failed verification and missing secrets', async () => {
    failedStatus = 503
    expect(await execute(listMyReservations, {})).toHaveProperty('error')
    const store = new RestaurantStore('https://example.test', 'fake', 'test-agent')
    await expect(store.read('host_reservations')).rejects.toThrow('503')
    failedStatus = undefined
    database.host_reservations = Array.from({ length: MAX_ROWS + 1 }, (_, i) => ({ id: String(i), phone: 'guest' }))
    await expect(store.read('host_reservations')).rejects.toThrow('too large')
    database.host_reservations = []
    dropWrites = true
    const changed = { id: 'new', phone: 'guest' }
    await expect(store.replace('host_reservations', [changed], changed)).rejects.toThrow('could not be verified')
    const ctx = { phone: 'guest', secrets: { get: () => Effect.succeed(null) } } as unknown as ToolContext
    expect(await Effect.runPromise(listMyReservations.execute({}, ctx))).toHaveProperty('error')
  })
})
