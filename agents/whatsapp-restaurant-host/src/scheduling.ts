export type Config = {
  agentName: string
  restaurantName: string
  timezone: string
  openingHours: string
  capacity: number
  slotMinutes: number
  maxPartySize: number
}

export type Hours = ReadonlyArray<readonly [number, number] | null>
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function minutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Use a time in HH:MM (24-hour) format.')
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

export function parseHours(value: string): Hours {
  const hours: Array<readonly [number, number] | null> = Array(7).fill(null)
  const seen = new Set<number>()
  for (const entry of value.split(';')) {
    const match = /^(daily|sun|mon|tue|wed|thu|fri|sat)\s+(closed|\d{2}:\d{2}-\d{2}:\d{2})$/.exec(entry.trim().toLowerCase())
    if (!match) throw new Error('OPENING_HOURS must use "daily 17:00-22:00" or semicolon-separated days, e.g. "mon closed;tue 17:00-22:00".')
    const days = match[1] === 'daily' ? DAYS.map((_, i) => i) : [DAYS.indexOf(match[1]!)]
    let range: readonly [number, number] | null = null
    if (match[2] !== 'closed') {
      const [start, end] = match[2]!.split('-').map(minutes)
      if (end! <= start!) throw new Error('Opening hours must close after opening on the same day; overnight service is not supported.')
      range = [start!, end!]
    }
    for (const day of days) {
      if (seen.has(day)) throw new Error('Opening hours contain a duplicate day.')
      seen.add(day)
      hours[day] = range
    }
  }
  return hours
}

export function parseDate(date: string): Date {
  const parsed = new Date(`${date}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('Use a real calendar date in YYYY-MM-DD format.')
  }
  return parsed
}

export function localNow(timezone: string, now = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)!.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

export function parseConfig(env: Record<string, string | undefined>): Config {
  const integer = (name: string, fallback: number) => {
    const value = env[name] === undefined ? fallback : Number(env[name])
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`)
    return value
  }
  const config = {
    agentName: env.AGENT_NAME?.trim() || 'labs-whatsapp-restaurant-host',
    restaurantName: env.RESTAURANT_NAME?.trim() || 'Example Restaurant',
    timezone: env.RESTAURANT_TIMEZONE ?? 'America/New_York',
    openingHours: env.OPENING_HOURS ?? 'daily 17:00-22:00',
    capacity: integer('SEAT_CAPACITY', 30),
    slotMinutes: integer('SLOT_MINUTES', 90),
    maxPartySize: integer('MAX_PARTY_SIZE', 8),
  }
  localNow(config.timezone)
  parseHours(config.openingHours)
  if (config.slotMinutes > 1440) throw new Error('SLOT_MINUTES must be at most 1440.')
  if (config.maxPartySize > config.capacity) throw new Error('MAX_PARTY_SIZE must not exceed SEAT_CAPACITY.')
  return config
}

export function validateParty(party: number, config: Config): void {
  if (!Number.isSafeInteger(party) || party < 1) throw new Error('Party size must be a positive integer.')
  if (party > config.maxPartySize) throw new Error(`For parties larger than ${config.maxPartySize}, please call the restaurant or ask staff for help.`)
}

export function slots(date: string, config: Config): string[] {
  const range = parseHours(config.openingHours)[parseDate(date).getUTCDay()]
  if (!range) return []
  const result: string[] = []
  for (let start = range[0]; start + config.slotMinutes <= range[1]; start += config.slotMinutes) {
    result.push(`${String(Math.floor(start / 60)).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`)
  }
  return result
}

export function hasCapacity(parties: readonly number[], party: number, capacity: number): boolean {
  return parties.reduce((sum, size) => sum + size, 0) + party <= capacity
}

export function availability(date: string, time: string | undefined, party: number, bookings: readonly { time: string; party_size: number }[], config: Config, now = new Date()): string[] {
  validateParty(party, config)
  const today = localNow(config.timezone, now)
  const target = time === undefined ? undefined : minutes(time)
  return slots(date, config)
    .filter((slot) => (date > today.date || (date === today.date && slot > today.time)) && hasCapacity(bookings.filter((b) => minutes(b.time) < minutes(slot) + config.slotMinutes && minutes(b.time) + config.slotMinutes > minutes(slot)).map((b) => b.party_size), party, config.capacity))
    .sort((a, b) => target === undefined ? a.localeCompare(b) : Math.abs(minutes(a) - target) - Math.abs(minutes(b) - target) || a.localeCompare(b))
}

export function waitlistQuote(partiesAhead: readonly number[], party: number, capacity: number, slotMinutes: number): { position: number; quote_minutes: number } {
  const seats = partiesAhead.reduce((sum, size) => sum + size, 0)
  return { position: partiesAhead.length + 1, quote_minutes: Math.max(1, Math.ceil((seats + party) / capacity)) * slotMinutes }
}
