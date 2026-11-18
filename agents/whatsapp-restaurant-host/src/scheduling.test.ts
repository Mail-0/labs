import { describe, expect, test } from 'bun:test'
import { availability, hasCapacity, localNow, minutes, parseConfig, parseDate, parseHours, slots, validateParty, waitlistQuote } from './scheduling.js'

const config = parseConfig({})
const now = new Date('2030-01-01T22:05:00Z')

describe('configuration and hours', () => {
  test('defaults to dinner daily and validates settings', () => {
    expect(config.agentName).toBe('labs-whatsapp-restaurant-host')
    expect(parseHours(config.openingHours)).toEqual(Array(7).fill([1020, 1320]))
    expect(() => parseConfig({ SEAT_CAPACITY: '0' })).toThrow('positive integer')
    expect(() => parseConfig({ SLOT_MINUTES: '1.5' })).toThrow('positive integer')
    expect(() => parseConfig({ SLOT_MINUTES: '1441' })).toThrow('1440')
    expect(() => parseConfig({ MAX_PARTY_SIZE: '40' })).toThrow('SEAT_CAPACITY')
    expect(() => parseConfig({ RESTAURANT_TIMEZONE: 'Not/AZone' })).toThrow()
  })

  test('supports explicit closed days; unspecified days stay closed', () => {
    const hours = parseHours('mon closed;tue 17:00-22:00')
    expect(hours[1]).toBeNull()
    expect(hours[2]).toEqual([1020, 1320])
    expect(hours[0]).toBeNull()
  })

  test('rejects invalid, duplicate, empty and overnight hours', () => {
    for (const hours of ['', 'dinner', 'mon 25:00-26:00', 'mon 22:00-02:00', 'daily closed;mon closed', 'mon 17:00-17:00']) {
      expect(() => parseHours(hours)).toThrow()
    }
    expect(() => minutes('7:00')).toThrow('HH:MM')
  })
})

describe('calendar and slots', () => {
  test('validates real calendar dates including leap years', () => {
    expect(parseDate('2028-02-29').toISOString()).toStartWith('2028-02-29')
    for (const date of ['2029-02-29', '2030-02-30', '2030-13-01', 'tomorrow']) {
      expect(() => parseDate(date)).toThrow('real calendar date')
    }
  })

  test('generates only full sittings; closed and too-short services are empty', () => {
    expect(slots('2030-01-01', config)).toEqual(['17:00', '18:30', '20:00'])
    expect(slots('2030-01-01', { ...config, openingHours: 'daily closed' })).toEqual([])
    expect(slots('2030-01-01', { ...config, openingHours: 'daily 17:00-18:00' })).toEqual([])
  })

  test('uses restaurant local dates across midnight and DST', () => {
    expect(localNow('America/New_York', new Date('2030-01-02T02:00:00Z'))).toEqual({ date: '2030-01-01', time: '21:00' })
    expect(localNow('America/New_York', new Date('2030-07-02T02:00:00Z'))).toEqual({ date: '2030-07-01', time: '22:00' })
  })
})

describe('availability and quotes', () => {
  test('counts every guest and allows exactly the remaining capacity', () => {
    expect(hasCapacity([10, 12], 8, 30)).toBe(true)
    expect(hasCapacity([10, 13], 8, 30)).toBe(false)
    expect(hasCapacity([], 8, 30)).toBe(true)
    const bookings = [{ time: '18:30', party_size: 23 }, { time: '18:30', party_size: 7 }]
    expect(availability('2030-01-01', '18:15', 2, bookings, config, now)).toEqual(['20:00'])
  })

  test('sorts near requested time, rejects past slots and returns empty for full or past days', () => {
    expect(availability('2030-01-02', '19:50', 2, [], config, now)).toEqual(['20:00', '18:30', '17:00'])
    expect(availability('2030-01-01', undefined, 2, [], config, now)).toEqual(['18:30', '20:00'])
    expect(availability('2029-12-31', undefined, 2, [], config, now)).toEqual([])
    const full = slots('2030-01-02', config).map((time) => ({ time, party_size: 30 }))
    expect(availability('2030-01-02', undefined, 2, full, config, now)).toEqual([])
  })

  test('invalid party sizes and requested times fail, including large party handoff', () => {
    for (const party of [0, -1, 1.5, NaN]) expect(() => validateParty(party, config)).toThrow()
    expect(() => validateParty(9, config)).toThrow('call the restaurant')
    expect(() => availability('2030-01-01', '25:00', 2, [], config, now)).toThrow('HH:MM')
  })

  test('quotes an empty queue and additional capacity waves', () => {
    expect(waitlistQuote([], 2, 30, 90)).toEqual({ position: 1, quote_minutes: 90 })
    expect(waitlistQuote([20, 10], 2, 30, 90)).toEqual({ position: 3, quote_minutes: 180 })
  })
})
