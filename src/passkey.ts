import { sha256 } from '@cosmjs/crypto'
import { toHex, fromBase64 } from '@cosmjs/encoding'

// Public interfaces
export interface DerivedKey {
  credentialId: string
  privateKey: string // hex encoded
}

export interface PasskeyConfig {
  address: string // Cosmos address as userID
  displayName?: string // Optional display name
  saltName?: string // Salt for key derivation (default: 'stint-session')
}

/**
 * Get or create a derived key from passkey for the current domain
 * - Checks for existing passkey with PRF support
 * - Creates new one if none exists or PRF not supported
 * - Returns derived private key
 */
export async function getOrCreateDerivedKey(options: PasskeyConfig): Promise<DerivedKey> {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn not supported')
  }

  // First, try to get existing credential
  let existingCredential: ExistingCredential | null = null

  try {
    existingCredential = await getExistingPasskey(
      options.address,
      options.saltName || 'stint-session'
    )
  } catch (error) {
    // If user cancelled during existing passkey check, don't proceed to create
    if (
      error instanceof Error &&
      (error.name === 'NotAllowedError' || error.name === 'AbortError')
    ) {
      throw new Error('Passkey operation cancelled. Please try again.')
    }
    // Otherwise, no existing credential found, continue to create
  }

  const saltName = options.saltName || 'stint-session'

  // If we found an existing credential, try to use it
  if (existingCredential) {
    if (existingCredential.prfSupported && existingCredential.prfOutput) {
      // Use the PRF output we already got to derive the private key
      const privateKey = sha256(existingCredential.prfOutput)
      return {
        credentialId: existingCredential.credentialId,
        privateKey: toHex(privateKey),
      }
    } else if (existingCredential.prfSupported) {
      try {
        const privateKey = await derivePrivateKey(existingCredential.credentialId, saltName)
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
          throw new Error('Authentication with existing passkey was cancelled. Please try again.')
        }
        // For other errors, we'll fall through to create a new passkey
      }
    } else {
      throw new Error(
        'Existing passkey does not support PRF extension. Please delete the existing passkey for this site and create a new one.'
      )
    }
  }

  // Create new passkey
  const credential = await createPasskey({
    userName: options.address,
    userDisplayName: options.displayName || `Stint: ${options.address.slice(0, 10)}...`,
  })

  const privateKey = await derivePrivateKey(credential.id, saltName)

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
  saltName: string = 'stint-session'
): Promise<ExistingCredential | null> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const saltBytes = new TextEncoder().encode(saltName)

  try {
    const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
      challenge,
      rpId: window.location.hostname,
      userVerification: 'preferred',
      allowCredentials: [], // Let user select any credential for this domain
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
    })) as PublicKeyCredential

    if (!assertion) {
      return null
    }

    // Check if PRF extension is supported and extract output
    const clientExtensionResults = assertion.getClientExtensionResults() as any
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
  } catch {
    // User cancelled or no credentials
    return null
  }
}

// Create a new passkey credential with PRF extension
async function createPasskey(options: InternalPasskeyConfig): Promise<PublicKeyCredential> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      id: window.location.hostname,
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
      userVerification: 'preferred',
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
  })) as PublicKeyCredential

  if (!credential) {
    throw new Error('Failed to create passkey - credential is null')
  }

  // Add a small delay to handle potential race conditions
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Verify PRF extension is supported
  const clientExtensionResults = credential.getClientExtensionResults() as any

  // More lenient PRF check - sometimes the 'enabled' flag isn't set but PRF still works
  const prfExtension = clientExtensionResults.prf
  if (!prfExtension) {
    throw new Error('Passkey created but PRF extension not enabled')
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
async function getPasskeyPRF(credentialId: string, salt: Uint8Array): Promise<Uint8Array> {
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const credentialIdBytes = base64urlToBytes(credentialId)

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname,
    userVerification: 'preferred', // More lenient than 'required'
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
  }

  const assertion = (await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  })) as PublicKeyCredential

  if (!assertion) {
    throw new Error('Failed to get passkey assertion')
  }

  const clientExtensionResults = assertion.getClientExtensionResults() as any
  if (!clientExtensionResults.prf?.results?.first) {
    throw new Error('PRF extension not supported or no output')
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
  salt: string = 'stint-session'
): Promise<string> {
  const saltBytes = new TextEncoder().encode(salt)

  const prfOutput = await getPasskeyPRF(credentialId, saltBytes)

  // Use the PRF output as entropy for the private key
  const privateKey = sha256(prfOutput)

  return toHex(privateKey)
}
