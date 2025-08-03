import { toHex } from '@cosmjs/encoding'
import { StintError, ErrorCodes } from './errors'
import { Logger, noopLogger } from './logger'

// ============================================================================
// RANDOM KEY GENERATION
// ============================================================================

// WeakMap to store ephemeral keys in memory only
// Keys are garbage collected when config object is no longer referenced
const ephemeralKeys = new WeakMap<object, string>()

export interface RandomKeyConfig {
  configObject: object // The config object to key the WeakMap
  logger?: Logger
}

/**
 * Generate or retrieve a random private key for the session
 * Keys are stored in memory only and lost on page refresh
 * @param config - Configuration for random key generation
 * @returns Hex-encoded private key
 */
export function getOrCreateRandomKey(config: RandomKeyConfig): string {
  const logger = config.logger || noopLogger

  // Check if we already have a key for this config
  const existingKey = ephemeralKeys.get(config.configObject)
  if (existingKey) {
    logger.debug('Using existing random key from memory')
    return existingKey
  }

  // Generate new random key
  logger.debug('Generating new random session key')

  // Generate 32 bytes of cryptographically secure random data
  const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32))

  // Validate we got proper random bytes (not all zeros)
  const sum = privateKeyBytes.reduce((acc, byte) => acc + byte, 0)
  if (sum === 0) {
    throw new StintError('Failed to generate secure random key', ErrorCodes.KEY_GENERATION_FAILED, {
      reason: 'Insufficient entropy',
    })
  }

  // Convert to hex string
  const privateKey = toHex(privateKeyBytes)

  // Store in memory only (will be garbage collected with config object)
  ephemeralKeys.set(config.configObject, privateKey)

  // Clear the bytes from memory
  privateKeyBytes.fill(0)

  logger.warn('Random session key generated - will not persist across page refresh')

  return privateKey
}

/**
 * Clear a random key from memory
 * @param configObject - The config object used as key
 */
export function clearRandomKey(configObject: object): void {
  ephemeralKeys.delete(configObject)
}
