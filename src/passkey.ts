import { sha256 } from '@cosmjs/crypto'
import { toHex, fromBase64 } from '@cosmjs/encoding'
import { PublicKeyCredentialWithPRF } from './types'
import { StintError, ErrorCodes } from './errors'
import { Logger, consoleLogger } from './logger'

// ============================================================================
// SECURITY UTILITIES
// ============================================================================

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
    throw new StintError(
      'Invalid hostname for WebAuthn',
      ErrorCodes.WEBAUTHN_NOT_SUPPORTED,
      { hostname }
    )
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
    throw new StintError(
      'Failed to generate secure challenge',
      ErrorCodes.WEBAUTHN_NOT_SUPPORTED,
      { reason: 'Insufficient entropy' }
    )
  }
  
  return challenge
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
  logger?: Logger // Optional logger
}

/**
 * Get or create a derived key from passkey for the current domain
 * - Checks for existing passkey with PRF support
 * - Creates new one if none exists or PRF not supported
 * - Returns derived private key
 */
export async function getOrCreateDerivedKey(options: PasskeyConfig): Promise<DerivedKey> {
  const logger = options.logger || consoleLogger
  
  logger.debug('Starting passkey derivation', { 
    address: options.address.slice(0, 10) + '...', 
    saltName: options.saltName 
  })

  if (!window.PublicKeyCredential) {
    logger.error('WebAuthn not supported in this browser')
    throw new StintError(
      'WebAuthn not supported',
      ErrorCodes.WEBAUTHN_NOT_SUPPORTED,
      { userAgent: navigator.userAgent }
    )
  }

  // First, try to get existing credential
  let existingCredential: ExistingCredential | null = null

  try {
    existingCredential = await getExistingPasskey(
      options.address,
      options.saltName || 'stint-session',
      logger
    )
  } catch (error) {
    // If user cancelled during existing passkey check, don't proceed to create
    if (
      error instanceof Error &&
      (error.name === 'NotAllowedError' || error.name === 'AbortError')
    ) {
      logger.warn('User cancelled passkey operation')
      throw new StintError(
        'Passkey operation cancelled',
        ErrorCodes.USER_CANCELLED,
        { operation: 'getExisting', error: error.message }
      )
    }
    // Otherwise, no existing credential found, continue to create
    logger.debug('No existing passkey found, will create new one')
  }

  const saltName = options.saltName || 'stint-session'

  // If we found an existing credential, try to use it
  if (existingCredential) {
    logger.debug('Found existing passkey')
    
    if (existingCredential.prfSupported && existingCredential.prfOutput) {
      // Use the PRF output we already got to derive the private key
      const privateKey = sha256(existingCredential.prfOutput)
      logger.debug('Session key ready')
      return {
        credentialId: existingCredential.credentialId,
        privateKey: toHex(privateKey),
      }
    } else if (existingCredential.prfSupported) {
      try {
        const privateKey = await derivePrivateKey(existingCredential.credentialId, saltName, logger)
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
          error: error instanceof Error ? error.message : 'Unknown error'
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
  const credential = await createPasskey({
    userName: options.address,
    userDisplayName: options.displayName || `Stint: ${options.address.slice(0, 10)}...`,
  }, logger)

  const privateKey = await derivePrivateKey(credential.id, saltName, logger)

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
  _address: string,
  saltName: string = 'stint-session',
  logger: Logger = consoleLogger
): Promise<ExistingCredential | null> {
  const challenge = generateSecureChallenge()
  const saltBytes = new TextEncoder().encode(saltName)

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
            first: saltBytes,
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

    // Check if PRF extension is supported and extract output
    const clientExtensionResults = assertion.getClientExtensionResults()
    const prfResult = clientExtensionResults.prf?.results?.first
    const prfSupported = !!prfResult

    let prfOutput: Uint8Array | undefined
    if (prfResult) {
      // Handle different possible return types from PRF
      if (prfResult instanceof ArrayBuffer) {
        prfOutput = new Uint8Array(prfResult)
      } else if (prfResult instanceof Uint8Array) {
        prfOutput = prfResult
      } else {
        // Handle BufferSource types
        prfOutput = new Uint8Array(prfResult as ArrayBuffer)
      }
    }

    return {
      credentialId: assertion.id,
      prfSupported,
      prfOutput,
    }
  } catch (error) {
    logger.debug('No existing passkey found or user cancelled', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

// Create a new passkey credential with PRF extension
async function createPasskey(
  options: InternalPasskeyConfig, 
  logger: Logger = consoleLogger
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
    throw new StintError(
      'Failed to create passkey',
      ErrorCodes.PASSKEY_CREATION_FAILED,
      { reason: 'Credential creation returned null' }
    )
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
  salt: Uint8Array,
  logger: Logger = consoleLogger
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
          first: salt,
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
    throw new StintError(
      'PRF extension not supported or no output',
      ErrorCodes.PRF_NOT_SUPPORTED,
      { suggestion: 'Your browser or authenticator may not support the PRF extension' }
    )
  }

  // Handle different possible return types from PRF
  const prfResult = clientExtensionResults.prf.results.first
  if (prfResult instanceof ArrayBuffer) {
    return new Uint8Array(prfResult)
  } else if (prfResult instanceof Uint8Array) {
    return prfResult
  } else {
    // Handle BufferSource types
    return new Uint8Array(prfResult as ArrayBuffer)
  }
}

// Derive a private key from passkey PRF output
async function derivePrivateKey(
  credentialId: string,
  salt: string = 'stint-session',
  logger: Logger = consoleLogger
): Promise<string> {
  const saltBytes = new TextEncoder().encode(salt)

  const prfOutput = await getPasskeyPRF(credentialId, saltBytes, logger)

  // Use the PRF output as entropy for the private key
  const privateKey = sha256(prfOutput)

  return toHex(privateKey)
}
