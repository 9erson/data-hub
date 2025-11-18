export const DEFAULT_GREETING = 'Hello'
const DEFAULT_TARGET = 'Hono'

/**
 * Builds the greeting shown on the root endpoint. Trims whitespace and
 * falls back to the default target when no meaningful input is provided.
 */
export function buildGreeting(target?: string, greeting: string = DEFAULT_GREETING): string {
  const normalizedGreeting = greeting.trim() || DEFAULT_GREETING
  const normalizedTarget = target?.trim() || DEFAULT_TARGET
  return `${normalizedGreeting} ${normalizedTarget}!`
}
