import { describe, it, expect } from 'vitest'
import { StintError, ErrorCodes } from './errors'

describe('errors', () => {
  describe('StintError', () => {
    it('should create error with message and code', () => {
      const error = new StintError('Test error', ErrorCodes.WEBAUTHN_NOT_SUPPORTED)

      expect(error.name).toBe('StintError')
      expect(error.message).toBe('Test error')
      expect(error.code).toBe(ErrorCodes.WEBAUTHN_NOT_SUPPORTED)
      expect(error.details).toBeUndefined()
    })

    it('should create error with message, code, and details', () => {
      const details = { key: 'value', number: 42 }
      const error = new StintError('Test error with details', ErrorCodes.PRF_NOT_SUPPORTED, details)

      expect(error.name).toBe('StintError')
      expect(error.message).toBe('Test error with details')
      expect(error.code).toBe(ErrorCodes.PRF_NOT_SUPPORTED)
      expect(error.details).toEqual(details)
    })

    it('should be instance of Error', () => {
      const error = new StintError('Test error', ErrorCodes.USER_CANCELLED)

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(StintError)
    })

    it('should have stack trace', () => {
      const error = new StintError('Test error', ErrorCodes.PASSKEY_CREATION_FAILED)

      expect(error.stack).toBeDefined()
      expect(typeof error.stack).toBe('string')
    })
  })

  describe('ErrorCodes', () => {
    it('should contain all expected error codes', () => {
      expect(ErrorCodes.WEBAUTHN_NOT_SUPPORTED).toBe('WEBAUTHN_NOT_SUPPORTED')
      expect(ErrorCodes.PRF_NOT_SUPPORTED).toBe('PRF_NOT_SUPPORTED')
      expect(ErrorCodes.PASSKEY_CREATION_FAILED).toBe('PASSKEY_CREATION_FAILED')
      expect(ErrorCodes.PASSKEY_AUTHENTICATION_FAILED).toBe('PASSKEY_AUTHENTICATION_FAILED')
      expect(ErrorCodes.USER_CANCELLED).toBe('USER_CANCELLED')
      expect(ErrorCodes.SIGNER_EXTRACTION_FAILED).toBe('SIGNER_EXTRACTION_FAILED')
      expect(ErrorCodes.RPC_URL_EXTRACTION_FAILED).toBe('RPC_URL_EXTRACTION_FAILED')
      expect(ErrorCodes.INVALID_RPC_URL).toBe('INVALID_RPC_URL')
    })

    it('should have unique error codes', () => {
      const codeValues = Object.values(ErrorCodes)
      const uniqueValues = new Set(codeValues)

      expect(codeValues.length).toBe(uniqueValues.size)
    })
  })
})
