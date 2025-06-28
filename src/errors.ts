/**
 * Custom error class for Stint-specific errors
 */
export class StintError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'StintError'
  }
}

/**
 * Standard error codes used throughout the library
 */
export const ErrorCodes = {
  // WebAuthn and Passkey errors
  WEBAUTHN_NOT_SUPPORTED: 'WEBAUTHN_NOT_SUPPORTED',
  PASSKEY_CREATION_FAILED: 'PASSKEY_CREATION_FAILED',
  PASSKEY_AUTHENTICATION_FAILED: 'PASSKEY_AUTHENTICATION_FAILED',
  PRF_NOT_SUPPORTED: 'PRF_NOT_SUPPORTED',
  USER_CANCELLED: 'USER_CANCELLED',
  
  // Client initialization errors
  CLIENT_INITIALIZATION_FAILED: 'CLIENT_INITIALIZATION_FAILED',
  SIGNER_EXTRACTION_FAILED: 'SIGNER_EXTRACTION_FAILED',
  RPC_URL_EXTRACTION_FAILED: 'RPC_URL_EXTRACTION_FAILED',
  
  // Grant checking errors
  GRANT_CHECK_FAILED: 'GRANT_CHECK_FAILED',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  
  // Validation errors
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  INVALID_DENOMINATION: 'INVALID_DENOMINATION',
  INVALID_RPC_URL: 'INVALID_RPC_URL',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]