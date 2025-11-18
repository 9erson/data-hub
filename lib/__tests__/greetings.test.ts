import { buildGreeting, DEFAULT_GREETING } from '../greetings'

describe('buildGreeting', () => {
  it('returns default greeting when no name is provided', () => {
    expect(buildGreeting()).toBe(`${DEFAULT_GREETING} Hono!`)
  })

  it('trims whitespace from provided name and greeting', () => {
    expect(buildGreeting('  Agent  ', '  Welcome  ')).toBe('Welcome Agent!')
  })

  it('falls back to defaults when inputs are empty strings', () => {
    expect(buildGreeting('  ', '')).toBe(`${DEFAULT_GREETING} Hono!`)
  })
})
