import { describe, it, expect } from 'vitest'
import { pickRandomUA } from './userAgents'

describe('pickRandomUA', () => {
  it('returns a non-empty string', () => {
    expect(typeof pickRandomUA()).toBe('string')
    expect(pickRandomUA().length).toBeGreaterThan(0)
  })

  it('returns a valid Chrome user agent', () => {
    const ua = pickRandomUA()
    expect(ua).toMatch(/Chrome\//)
    expect(ua).toMatch(/Mozilla\/5\.0/)
  })

  it('rotates across multiple calls', () => {
    const results = new Set(Array.from({ length: 50 }, () => pickRandomUA()))
    expect(results.size).toBeGreaterThan(1)
  })
})
