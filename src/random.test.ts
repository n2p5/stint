import { describe, it, expect } from 'vitest'
import { getOrCreateRandomKey, clearRandomKey } from './random'

describe('Random Key Generation', () => {
  it('should generate a valid random key', () => {
    const config = {}
    const key = getOrCreateRandomKey({ configObject: config })

    expect(key).toBeDefined()
    expect(key).toHaveLength(64) // 32 bytes = 64 hex chars
    expect(/^[0-9a-f]{64}$/i.test(key)).toBe(true)
  })

  it('should return the same key for the same config object', () => {
    const config = {}
    const key1 = getOrCreateRandomKey({ configObject: config })
    const key2 = getOrCreateRandomKey({ configObject: config })

    expect(key1).toBe(key2)
  })

  it('should generate different keys for different config objects', () => {
    const config1 = {}
    const config2 = {}

    const key1 = getOrCreateRandomKey({ configObject: config1 })
    const key2 = getOrCreateRandomKey({ configObject: config2 })

    expect(key1).not.toBe(key2)
  })

  it('should generate unique keys across multiple calls', () => {
    const keys = new Set<string>()

    // Generate 100 keys with different configs
    for (let i = 0; i < 100; i++) {
      const config = { id: i }
      const key = getOrCreateRandomKey({ configObject: config })
      keys.add(key)
    }

    // All keys should be unique
    expect(keys.size).toBe(100)
  })

  it('should clear key when requested', () => {
    const config = {}
    const key1 = getOrCreateRandomKey({ configObject: config })

    clearRandomKey(config)

    const key2 = getOrCreateRandomKey({ configObject: config })
    expect(key1).not.toBe(key2) // Should be a new key after clearing
  })

  it('should handle clearing non-existent keys gracefully', () => {
    const config = {}
    // Should not throw
    expect(() => clearRandomKey(config)).not.toThrow()
  })

  it('should work with complex config objects', () => {
    const config = {
      primaryClient: { mock: true },
      saltName: 'test-salt',
      stintWindowHours: 48,
      keyMode: 'random' as const,
    }

    const key = getOrCreateRandomKey({ configObject: config })
    expect(key).toBeDefined()
    expect(key).toHaveLength(64)
  })
})
