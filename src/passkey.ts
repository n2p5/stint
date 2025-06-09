import { sha256 } from '@cosmjs/crypto'
import { toHex } from '@cosmjs/encoding'
import { PasskeyCredential } from './types'

// Passkey creation options
export interface PasskeyOptions {
  rpId: string
  rpName: string
  userName: string
  userDisplayName: string
  challenge?: Uint8Array
}

// Create a new passkey credential with PRF extension
export async function createPasskeyCredential(
  options: PasskeyOptions
): Promise<PasskeyCredential> {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn not supported')
  }

  const challenge = options.challenge || crypto.getRandomValues(new Uint8Array(32))
  
  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      id: options.rpId,
      name: options.rpName,
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
      authenticatorAttachment: 'platform',
      userVerification: 'required',
    },
    timeout: 60000,
    attestation: 'none',
    extensions: {
      prf: {},
    },
  }

  const credential = await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions,
  }) as PublicKeyCredential

  if (!credential) {
    throw new Error('Failed to create passkey')
  }

  // The publicKey is available on AuthenticatorAttestationResponse
  const response = credential.response as AuthenticatorAttestationResponse
  const publicKey = response.getPublicKey()

  if (!publicKey) {
    throw new Error('No public key in credential response')
  }

  return {
    id: credential.id,
    publicKey: new Uint8Array(publicKey),
    userId: options.userName,
  }
}

// Get PRF output from passkey
export async function getPasskeyPRF(
  credentialId: string,
  salt: Uint8Array
): Promise<Uint8Array> {
  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn not supported')
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: window.location.hostname,
    userVerification: 'required',
    extensions: {
      prf: {
        eval: {
          first: salt,
        },
      },
    },
  }

  const assertion = await navigator.credentials.get({
    publicKey: publicKeyCredentialRequestOptions,
  }) as PublicKeyCredential

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
export async function derivePrivateKey(
  credentialId: string,
  salt: string = 'stint-wallet'
): Promise<string> {
  const saltBytes = new TextEncoder().encode(salt)
  const prfOutput = await getPasskeyPRF(credentialId, saltBytes)
  
  // Use the PRF output as entropy for the private key
  // In production, you might want additional key derivation
  const privateKey = await sha256(prfOutput)
  
  return toHex(privateKey)
}