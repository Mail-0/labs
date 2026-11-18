import { defineTool, type ToolContext } from '@onkeiki/agents'
import { Effect, Schema } from 'effect'
import { availability, localNow, minutes, parseDate, slots, validateParty, waitlistQuote, type Config } from './scheduling.js'
import { restaurantRuntime, type RestaurantStore } from './storage.js'

const RESERVATIONS = 'host_reservations'
const WAITLIST = 'host_waitlist'
const Text = Schema.String.pipe(Schema.minLength(1), Schema.maxLength(200))
const Party = Schema.Number.pipe(Schema.int(), Schema.positive())
const DateInput = Schema.String.pipe(Schema.pattern(/^\d{4}-\d{2}-\d{2}$/))
const TimeInput = Schema.String.pipe(Schema.pattern(/^([01]\d|2[0-3]):[0-5]\d$/))
const Details = {
  name: Text, party_size: Party, date: DateInput, time: TimeInput,
  notes: Schema.optional(Schema.String.pipe(Schema.maxLength(1000))),
}
type Reservation = {
  id: string; phone: string; name: string; party_size: number; date: string; time: string
  notes: string; status: 'confirmed' | 'cancelled'
}
type WaitEntry = {
  id: string; phone: string; name: string; party_size: number; date: string
  joined_at: string; status: 'waiting' | 'left'
}
type Runtime = { config: Config; store: RestaurantStore }

function run<T>(ctx: ToolContext, action: (runtime: Runtime) => Promise<T>) {
  return Effect.promise(async () => {
    try {
      if (!ctx.phone) throw new Error('A guest identity is required.')
      return await action(await restaurantRuntime(ctx))
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'The request failed. Check your status before retrying.' }
    }
  })
}

function guestReservation(rows: Reservation[], id: string, phone: string): Reservation {
  const row = rows.find((item) => item.id === id && item.phone === phone)
  if (!row) throw new Error('Reservation not found for this guest. List your reservations to get its ID.')
  return row
}

function publicReservation({ phone: _phone, ...row }: Reservation) { return row }

async function ensureAvailable(store: RestaurantStore, config: Config, row: Reservation): Promise<void> {
  const bookings = await store.read<Reservation>(RESERVATIONS, { date: row.date, status: 'confirmed' })
  const open = availability(row.date, row.time, row.party_size, bookings.filter((b) => b.id !== row.id), config)
  if (!open.includes(row.time)) throw new Error('That slot is unavailable. Check availability for alternatives.')
}

function waitStatus(rows: WaitEntry[], entry: WaitEntry, config: Config) {
  const queue = rows.filter((row) => row.status === 'waiting' && row.date === entry.date)
    .sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id.localeCompare(b.id))
  const index = queue.findIndex((row) => row.id === entry.id)
  if (index < 0) return { status: entry.status, date: entry.date }
  return {
    id: entry.id, status: entry.status, date: entry.date,
    ...waitlistQuote(queue.slice(0, index).map((row) => row.party_size), entry.party_size, config.capacity, config.slotMinutes),
    quote_is_estimate: true,
  }
}

export const checkAvailability = defineTool({
  name: 'check_availability',
  description: 'Check real open reservation slots for a date and party size, nearest the optional requested time first. Times are local to the restaurant. No seat is held.',
  input: Schema.Struct({ date: DateInput, time: Schema.optional(TimeInput), party_size: Party }),
  execute: (input, ctx) => run(ctx, async ({ config, store }) => {
    parseDate(input.date)
    validateParty(input.party_size, config)
    const rows = await store.read<Reservation>(RESERVATIONS, { date: input.date, status: 'confirmed' })
    return { date: input.date, timezone: config.timezone, slots: availability(input.date, input.time, input.party_size, rows, config) }
  }),
})

export const bookTable = defineTool({
  name: 'book_table', description: 'Book only after the guest confirms name, date, time, party size and notes. Re-checks restaurant-wide capacity; returns the saved reservation ID.',
  input: Schema.Struct(Details),
  execute: (input, ctx) => run(ctx, async ({ config, store }) => {
    const row: Reservation = { ...input, name: input.name.trim(), notes: input.notes ?? '', id: crypto.randomUUID(), phone: ctx.phone, status: 'confirmed' }
    if (!row.name) throw new Error('Please provide a name for the reservation.')
    const rows = await store.read<Reservation>(RESERVATIONS)
    const duplicate = rows.find((b) => b.phone === ctx.phone && b.status === 'confirmed' && b.date === row.date && b.time === row.time && b.party_size === row.party_size)
    if (duplicate) return { already_booked: true, reservation: publicReservation(duplicate) }
    await ensureAvailable(store, config, row)
    await store.replace(RESERVATIONS, [...rows, row], row)
    return { reservation: publicReservation(row), timezone: config.timezone }
  }),
})

export const listMyReservations = defineTool({
  name: 'list_my_reservations', description: 'List only this guest’s reservations and their IDs, including cancellations.',
  input: Schema.Struct({}),
  execute: (_, ctx) => run(ctx, async ({ store }) => ({ reservations: (await store.read<Reservation>(RESERVATIONS, { phone: ctx.phone })).map(publicReservation) })),
})

export const changeReservation = defineTool({
  name: 'change_reservation', description: 'Replace details of this guest’s confirmed reservation after confirming all new details. Requires its reservation_id and all new booking details; re-checks capacity. Cannot revive cancellations.',
  input: Schema.Struct({ reservation_id: Text, ...Details }),
  execute: (input, ctx) => run(ctx, async ({ config, store }) => {
    const own = await store.read<Reservation>(RESERVATIONS, { id: input.reservation_id, phone: ctx.phone })
    const original = guestReservation(own, input.reservation_id, ctx.phone)
    if (original.status !== 'confirmed') throw new Error('That reservation is cancelled. Make a new booking instead.')
    const row: Reservation = { ...original, name: input.name.trim(), party_size: input.party_size, date: input.date, time: input.time, notes: input.notes ?? '' }
    if (!row.name) throw new Error('Please provide a name for the reservation.')
    await ensureAvailable(store, config, row)
    const rows = await store.read<Reservation>(RESERVATIONS)
    guestReservation(rows, row.id, ctx.phone)
    await store.replace(RESERVATIONS, rows.map((b) => b.id === row.id ? row : b), row)
    return { reservation: publicReservation(row), timezone: config.timezone }
  }),
})

export const cancelReservation = defineTool({
  name: 'cancel_reservation', description: 'Cancel this guest’s reservation by reservation_id. Safe to repeat; releases its seats.',
  input: Schema.Struct({ reservation_id: Text }),
  execute: (input, ctx) => run(ctx, async ({ store }) => {
    const own = await store.read<Reservation>(RESERVATIONS, { id: input.reservation_id, phone: ctx.phone })
    guestReservation(own, input.reservation_id, ctx.phone)
    const rows = await store.read<Reservation>(RESERVATIONS)
    const row = { ...guestReservation(rows, input.reservation_id, ctx.phone), status: 'cancelled' as const }
    await store.replace(RESERVATIONS, rows.map((b) => b.id === row.id ? row : b), row)
    return { reservation: publicReservation(row) }
  }),
})

export const joinWaitlist = defineTool({
  name: 'join_waitlist', description: 'Join today’s restaurant-wide walk-in waitlist. Returns position and a rough estimate, not a reservation or promise of automatic notification. One active entry per guest per day.',
  input: Schema.Struct({ name: Text, party_size: Party }),
  execute: (input, ctx) => run(ctx, async ({ config, store }) => {
    validateParty(input.party_size, config)
    const now = new Date()
    const today = localNow(config.timezone, now)
    const service = slots(today.date, config)
    if (!service.some((time) => minutes(time) + config.slotMinutes > minutes(today.time))) throw new Error('The walk-in waitlist is closed for today. Please ask staff about the next service.')
    const name = input.name.trim()
    if (!name) throw new Error('Please provide a name for the waitlist.')
    const rows = await store.read<WaitEntry>(WAITLIST)
    const existing = rows.find((row) => row.phone === ctx.phone && row.date === today.date && row.status === 'waiting')
    if (existing) return waitStatus(rows, existing, config)
    const row: WaitEntry = { id: crypto.randomUUID(), phone: ctx.phone, name, party_size: input.party_size, date: today.date, joined_at: now.toISOString(), status: 'waiting' }
    const updated = [...rows, row]
    await store.replace(WAITLIST, updated, row)
    return waitStatus(updated, row, config)
  }),
})

export const waitlistStatus = defineTool({
  name: 'waitlist_status', description: 'Get this guest’s position and a rough quote on today’s shared walk-in waitlist.',
  input: Schema.Struct({}),
  execute: (_, ctx) => run(ctx, async ({ config, store }) => {
    const date = localNow(config.timezone).date
    const own = await store.read<WaitEntry>(WAITLIST, { phone: ctx.phone, date, status: 'waiting' })
    if (!own.length) return { status: 'not_waiting', date }
    const queue = await store.read<WaitEntry>(WAITLIST, { date, status: 'waiting' })
    return waitStatus(queue, own[0]!, config)
  }),
})

export const leaveWaitlist = defineTool({
  name: 'leave_waitlist', description: 'Leave today’s walk-in waitlist for this guest only. Safe to repeat.',
  input: Schema.Struct({}),
  execute: (_, ctx) => run(ctx, async ({ config, store }) => {
    const date = localNow(config.timezone).date
    const own = await store.read<WaitEntry>(WAITLIST, { phone: ctx.phone, date, status: 'waiting' })
    if (!own.length) return { status: 'not_waiting', date }
    const rows = await store.read<WaitEntry>(WAITLIST)
    const row = { ...own[0]!, status: 'left' as const }
    await store.replace(WAITLIST, rows.map((entry) => entry.id === row.id ? row : entry), row)
    return { status: 'left', date }
  }),
})

export const tools = [checkAvailability, bookTable, listMyReservations, changeReservation, cancelReservation, joinWaitlist, waitlistStatus, leaveWaitlist]
