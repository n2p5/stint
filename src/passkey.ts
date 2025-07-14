import { toHex, fromBase64 } from '@cosmjs/encoding'
import { PublicKeyCredentialWithPRF } from './types'
import { StintError, ErrorCodes } from './errors'
import { Logger, noopLogger } from './logger'

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

/**
 * Generate time-windowed stint salt for PRF and HKDF
 * Creates unique salt based on domain, user, purpose, and UTC time window
 * Uses Unix epoch-based calculation to handle arbitrary window sizes
 */
function generateStintSalt(
  userAddress: string,
  purpose: string,
  windowHours: number = 24,
  windowNumber?: number
): string {
  // Use UTC milliseconds since Unix epoch for global synchronization
  const now = Date.now()
  const windowMs = windowHours * 60 * 60 * 1000
  const calculatedWindowNumber = windowNumber ?? Math.floor(now / windowMs)

  const domain = window.location.hostname
  return `${domain}:${userAddress}:${purpose}:${calculatedWindowNumber}`
}

/**
 * Get the current window boundaries for debugging and validation
 * @param windowHours The window size in hours
 * @returns Object with start and end timestamps of current window
 */
export function getWindowBoundaries(windowHours: number = 24): {
  start: Date
  end: Date
  windowNumber: number
} {
  const now = Date.now()
  const windowMs = windowHours * 60 * 60 * 1000
  const windowNumber = Math.floor(now / windowMs)

  return {
    start: new Date(windowNumber * windowMs),
    end: new Date((windowNumber + 1) * windowMs),
    windowNumber,
  }
}

/**
 * Validate and get secure RP ID
 * Prevents subdomain attacks and validates origin
 */
function getSecureRpId(): string {
  const hostname = window.location.hostname

  // Validate hostname format
  if (!hostname || hostname === 'localhost' || /^[\d.]+$/.test(hostname)) {
    // Allow localhost and IP addresses for development
    return hostname
  }

  // For production domains, validate format
  if (!/^[a-zA-Z0-9.-]+$/.test(hostname)) {
    throw new StintError('Invalid hostname for WebAuthn', ErrorCodes.WEBAUTHN_NOT_SUPPORTED, {
      hostname,
    })
  }

  return hostname
}

/**
 * Generate cryptographically secure challenge
 */
function generateSecureChallenge(): Uint8Array {
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  // Validate we got proper random bytes (not all zeros)
  const sum = challenge.reduce((acc, byte) => acc + byte, 0)
  if (sum === 0) {
    throw new StintError('Failed to generate secure challenge', ErrorCodes.WEBAUTHN_NOT_SUPPORTED, {
      reason: 'Insufficient entropy',
    })
  }

  return challenge
}

/**
 * HKDF-SHA256 key derivation function using WebCrypto API
 * @param ikm Input Key Material (PRF output)
 * @param salt Salt for extraction phase
 * @param info Context information for expansion
 * @param length Output length in bytes
 */
async function hkdf(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  // Import the input key material
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])

  // Derive bits using HKDF-SHA256
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: info,
    },
    key,
    length * 8 // Convert bytes to bits
  )

  return new Uint8Array(derivedBits)
}

// Public interfaces
export interface DerivedKey {
  credentialId: string
  privateKey: string // hex encoded
}

export interface PasskeyConfig {
  address: string // Cosmos address as userID
  displayName?: string // Optional display name
  saltName?: string // Salt for key derivation (default: 'stint-session')
  stintWindowHours?: number // Time window in hours for key validity (default: 24, supports any duration)
  windowNumber?: number // Specific window number to use (optional, for grace period logic)
  logger?: Logger // Optional logger
}

/**
 * Get or create a derived key from passkey for the current domain
 * - Checks for existing passkey with PRF support
 * - Creates new one if none exists or PRF not supported
 * - Returns derived private key
 */
export async function getOrCreateDerivedKey(options: PasskeyConfig): Promise<DerivedKey> {
  const logger = options.logger || noopLogger
  const purpose = options.saltName || 'stint-session'
  const windowHours = options.stintWindowHours || 24

  // Generate time-windowed stint salt
  const stintSalt = generateStintSalt(options.address, purpose, windowHours, options.windowNumber)

  logger.debug('Starting passkey derivation', {
    address: options.address.slice(0, 10) + '...',
    purpose,
    windowHours,
    stintSalt,
  })

  if (!window.PublicKeyCredential) {
    logger.error('WebAuthn not supported in this browser')
    throw new StintError('WebAuthn not supported', ErrorCodes.WEBAUTHN_NOT_SUPPORTED, {
      userAgent: navigator.userAgent,
    })
  }

  // First, try to get existing credential
  let existingCredential: ExistingCredential | null = null

  try {
    existingCredential = await getExistingPasskey(options.address, stintSalt, logger)
  } catch (error) {
    // If user cancelled during existing passkey check, don't proceed to create
    if (
      error instanceof Error &&
      (error.name === 'NotAllowedError' || error.name === 'AbortError')
    ) {
      logger.warn('User cancelled passkey operation')
      throw new StintError('Passkey operation cancelled', ErrorCodes.USER_CANCELLED, {
        operation: 'getExisting',
        error: error.message,
      })
    }
    // Otherwise, no existing credential found, continue to create
    logger.debug('No existing passkey found, will create new one')
  }

  // If we found an existing credential, try to use it
  if (existingCredential) {
    logger.debug('Found existing passkey')

    if (existingCredential.prfSupported && existingCredential.prfOutput) {
      // Use the PRF output we already got to derive the private key with HKDF
      const privateKey = await derivePrivateKeyWithHKDF(
        existingCredential.prfOutput,
        stintSalt,
        logger
      )
      logger.debug('Session key ready')
      return {
        credentialId: existingCredential.credentialId,
        privateKey: toHex(privateKey),
      }
    } else if (existingCredential.prfSupported) {
      try {
        const privateKey = await derivePrivateKey(
          existingCredential.credentialId,
          stintSalt,
          logger
        )
        logger.debug('Session key ready')
        return {
          credentialId: existingCredential.credentialId,
          privateKey,
        }
      } catch (error) {
        // If deriving the private key fails, we need to create a new passkey
        // This could happen if the user cancels the authentication or there's a timeout
        if (
          error instanceof Error &&
          (error.name === 'NotAllowedError' || error.name === 'AbortError')
        ) {
          logger.warn('User cancelled existing passkey authentication')
          throw new StintError(
            'Authentication with existing passkey was cancelled',
            ErrorCodes.PASSKEY_AUTHENTICATION_FAILED,
            { operation: 'derivePrivateKey', error: error.message }
          )
        }
        // For other errors, we'll fall through to create a new passkey
        logger.warn('Failed to derive key from existing passkey, will create new one', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    } else {
      logger.error('Existing passkey does not support PRF extension')
      throw new StintError(
        'Existing passkey does not support PRF extension',
        ErrorCodes.PRF_NOT_SUPPORTED,
        { suggestion: 'Please delete the existing passkey for this site and create a new one' }
      )
    }
  }

  // Create new passkey
  logger.debug('Creating new passkey')
  const credential = await createPasskey(
    {
      userName: options.address,
      userDisplayName: options.displayName || `Stint: ${options.address.slice(0, 10)}...`,
    },
    logger
  )

  const privateKey = await derivePrivateKey(credential.id, stintSalt, logger)

  logger.debug('Session key ready')
  return {
    credentialId: credential.id,
    privateKey,
  }
}

// Internal interfaces
interface InternalPasskeyConfig {
  userName: string
  userDisplayName: string
}

interface ExistingCredential {
  credentialId: string
  prfSupported: boolean
  prfOutput?: Uint8Array // Include PRF output if available
}

// Check for existing passkey with PRF support
async function getExistingPasskey(
  address: string,
  stintSalt: string,
  logger: Logger = noopLogger
): Promise<ExistingCredential | null> {
  const challenge = generateSecureChallenge()

  try {
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: getSecureRpId(),
      userVerification: 'required',
      allowCredentials: [], // Let user select any credential for this domain
      timeout: 60000, // 60 seconds for authentication
      extensions: {
        prf: {
          eval: {
            first: new TextEncoder().encode(stintSalt + '\x00'),
            second: new TextEncoder().encode(stintSalt + '\x01'),
          },
        },
      },
    }

    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredentialWithPRF | null

    if (!assertion) {
      return null
    }

    // Validate that the passkey belongs to the expected address
    const userHandle = (assertion.response as any).userHandle as ArrayBuffer | null
    if (userHandle) {
      const userIdFromPasskey = new TextDecoder().decode(userHandle)
      if (userIdFromPasskey !== address) {
        logger.debug('Passkey user ID does not match current address', {
          expected: address,
          actual: userIdFromPasskey,
        })
        return null
      }
    } else {
      // If no userHandle is present, we can't validate the address
      logger.debug('Passkey has no userHandle, cannot validate address')
      return null
    }

    // Check if PRF extension is supported and extract output
    const clientExtensionResults = assertion.getClientExtensionResults()
    const prfResult1 = clientExtensionResults.prf?.results?.first
    const prfResult2 = clientExtensionResults.prf?.results?.second
    const prfSupported = !!prfResult1

    let prfOutput: Uint8Array | undefined
    if (prfResult1) {
      // Convert first result to Uint8Array
      let output1: Uint8Array
      if (prfResult1 instanceof ArrayBuffer) {
        output1 = new Uint8Array(prfResult1)
      } else if (prfResult1 instanceof Uint8Array) {
        output1 = prfResult1
      } else {
        output1 = new Uint8Array(prfResult1 as ArrayBuffer)
      }

      // Convert second result to Uint8Array (if available)
      let output2: Uint8Array
      if (prfResult2) {
        if (prfResult2 instanceof ArrayBuffer) {
          output2 = new Uint8Array(prfResult2)
        } else if (prfResult2 instanceof Uint8Array) {
          output2 = prfResult2
        } else {
          output2 = new Uint8Array(prfResult2 as ArrayBuffer)
        }
      } else {
        // If second output is not available, use first output again
        output2 = output1
      }

      // Combine both outputs for maximum entropy
      const combinedOutput = new Uint8Array(output1.length + output2.length)
      combinedOutput.set(output1)
      combinedOutput.set(output2, output1.length)
      prfOutput = combinedOutput
    }

    return {
      credentialId: assertion.id,
      prfSupported,
      prfOutput,
    }
  } catch (error) {
    if (error instanceof Error) {
      // Check for specific WebAuthn errors that might indicate domain/credential issues
      if (error.name === 'NotAllowedError') {
        logger.debug('User cancelled passkey authentication or invalid credential for domain', {
          error: error.message,
          suggestion: 'This might be due to selecting a passkey from a different domain',
        })
      } else if (error.name === 'SecurityError') {
        logger.debug('Security error during passkey authentication', {
          error: error.message,
          suggestion: 'This might be due to domain mismatch or invalid RP ID',
        })
      } else {
        logger.debug('Passkey authentication failed', {
          error: error.message,
          errorType: error.name,
        })
      }
    } else {
      logger.debug('Unknown error during passkey authentication', {
        error: 'Unknown error',
      })
    }
    return null
  }
}

// Create a new passkey credential with PRF extension
async function createPasskey(
  options: InternalPasskeyConfig,
  logger: Logger = noopLogger
): Promise<PublicKeyCredential> {
  const challenge = generateSecureChallenge()

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      id: getSecureRpId(),
      name: 'Stint Session Signer',
    },
    user: {
      id: new TextEncoder().encode(options.userName),
      name: options.userName,
      displayName: options.userDisplayName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      // Remove platform restriction to allow 1Password and other passkey managers
      userVerification: 'required',
      requireResidentKey: false,
      residentKey: 'preferred',
    },
    timeout: 120000,
    attestation: 'none',
    extensions: {
      prf: {},
    },
  }

  const credential = (await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  })) as PublicKeyCredentialWithPRF | null

  if (!credential) {
    logger.error('Failed to create passkey - credential is null')
    throw new StintError('Failed to create passkey', ErrorCodes.PASSKEY_CREATION_FAILED, {
      reason: 'Credential creation returned null',
    })
  }

  // Add a small delay to handle potential race conditions
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Verify PRF extension is supported
  const clientExtensionResults = credential.getClientExtensionResults()

  // More lenient PRF check - sometimes the 'enabled' flag isn't set but PRF still works
  const prfExtension = clientExtensionResults.prf
  if (!prfExtension) {
    logger.error('Passkey created but PRF extension not enabled')
    throw new StintError(
      'Passkey created but PRF extension not enabled',
      ErrorCodes.PRF_NOT_SUPPORTED,
      { suggestion: 'Your browser or authenticator may not support the PRF extension' }
    )
  }

  return credential
}

// Helper function to decode base64url
function base64urlToBytes(base64url: string): Uint8Array {
  // Convert base64url to base64
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  // Add padding if needed
  const padded = base64 + '==='.slice(0, (4 - (base64.length % 4)) % 4)
  return fromBase64(padded)
}

// Get PRF output from passkey
async function getPasskeyPRF(
  credentialId: string,
  stintSalt: string,
  logger: Logger = noopLogger
): Promise<Uint8Array> {
  const challenge = generateSecureChallenge()

  const credentialIdBytes = base64urlToBytes(credentialId)

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: getSecureRpId(),
    userVerification: 'required', // Require user verification for security
    allowCredentials: [
      {
        id: credentialIdBytes,
        type: 'public-key',
      },
    ],
    extensions: {
      prf: {
        eval: {
          first: new TextEncoder().encode(stintSalt + '\x00'),
          second: new TextEncoder().encode(stintSalt + '\x01'),
        },
      },
    },
    timeout: 60000, // 60 seconds for authentication
  }

  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredentialWithPRF | null

  if (!assertion) {
    logger.error('Failed to get passkey assertion')
    throw new StintError(
      'Failed to get passkey assertion',
      ErrorCodes.PASSKEY_AUTHENTICATION_FAILED,
      { operation: 'getPRF' }
    )
  }

  const clientExtensionResults = assertion.getClientExtensionResults()
  if (!clientExtensionResults.prf?.results?.first) {
    logger.error('PRF extension not supported or no output')
    throw new StintError('PRF extension not supported or no output', ErrorCodes.PRF_NOT_SUPPORTED, {
      suggestion: 'Your browser or authenticator may not support the PRF extension',
    })
  }

  // Handle different possible return types from PRF and combine both outputs
  const prfResult1 = clientExtensionResults.prf.results.first
  const prfResult2 = clientExtensionResults.prf.results.second

  // Convert first result to Uint8Array
  let output1: Uint8Array
  if (prfResult1 instanceof ArrayBuffer) {
    output1 = new Uint8Array(prfResult1)
  } else if (prfResult1 instanceof Uint8Array) {
    output1 = prfResult1
  } else {
    output1 = new Uint8Array(prfResult1 as ArrayBuffer)
  }

  // Convert second result to Uint8Array (if available)
  let output2: Uint8Array
  if (prfResult2) {
    if (prfResult2 instanceof ArrayBuffer) {
      output2 = new Uint8Array(prfResult2)
    } else if (prfResult2 instanceof Uint8Array) {
      output2 = prfResult2
    } else {
      output2 = new Uint8Array(prfResult2 as ArrayBuffer)
    }
  } else {
    // If second output is not available, use first output again
    output2 = output1
  }

  // Combine both outputs for maximum entropy
  const combinedOutput = new Uint8Array(output1.length + output2.length)
  combinedOutput.set(output1)
  combinedOutput.set(output2, output1.length)

  return combinedOutput
}

// Derive a private key using HKDF from PRF output
async function derivePrivateKeyWithHKDF(
  prfOutput: Uint8Array,
  stintSalt: string,
  _logger: Logger = noopLogger
): Promise<Uint8Array> {
  const saltBytes = new TextEncoder().encode(stintSalt)
  const infoBytes = new TextEncoder().encode('stint-key-derivation')

  // Use HKDF to derive the private key
  const privateKey = await hkdf(prfOutput, saltBytes, infoBytes, 32)

  return privateKey
}

// Derive a private key from passkey PRF output
async function derivePrivateKey(
  credentialId: string,
  stintSalt: string,
  logger: Logger = noopLogger
): Promise<string> {
  const prfOutput = await getPasskeyPRF(credentialId, stintSalt, logger)

  // Use HKDF to derive the private key
  const privateKey = await derivePrivateKeyWithHKDF(prfOutput, stintSalt, logger)

  return toHex(privateKey)
}
