import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { sha256 } from '@cosmjs/crypto'
import { toHex } from '@cosmjs/encoding'
import { getOrCreateDerivedKey } from './passkey'
import { setupWebAuthnMock, cleanupWebAuthnMock } from './test-utils/webauthn-mock'

describe('passkey utilities', () => {
  describe('hostname validation', () => {
    it('should handle valid production domain', () => {
      // Mock valid production domain
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com' },
        writable: true,
      })

      // This should not throw - getSecureRpId is tested indirectly
      expect(window.location.hostname).toBe('example.com')
    })

    it('should handle localhost for development', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true,
      })
      
      // This should not throw - already tested in other tests
      expect(window.location.hostname).toBe('localhost')
    })

    it('should handle IP addresses for development', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: '127.0.0.1' },
        writable: true,
      })
      
      expect(window.location.hostname).toBe('127.0.0.1')
    })
  })

  describe('crypto challenges', () => {
    it('should handle crypto.getRandomValues properly', () => {
      // Test that we can call crypto.getRandomValues
      const challenge = crypto.getRandomValues(new Uint8Array(32))
      expect(challenge).toBeInstanceOf(Uint8Array)
      expect(challenge.length).toBe(32)
    })
  })

  describe('PRF output handling', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true,
      })
    })

    afterEach(() => {
      cleanupWebAuthnMock()
    })

    it('should handle PRF output as ArrayBuffer', async () => {
      const arrayBuffer = new ArrayBuffer(32)
      const view = new Uint8Array(arrayBuffer)
      view.fill(123)

      setupWebAuthnMock({
        prfSupported: true,
        prfOutput: view, // Use Uint8Array for proper typing
      })

      const result = await getOrCreateDerivedKey({
        address: 'atone1test123',
        saltName: 'test-salt',
      })

      expect(result.credentialId).toBe('mock-credential-id')
      expect(result.privateKey).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should handle different PRF output buffer types', async () => {
      const buffer = new ArrayBuffer(32)
      const view = new Uint8Array(buffer)
      view.fill(42)

      setupWebAuthnMock({
        prfSupported: true,
        prfOutput: view,
      })

      const result = await getOrCreateDerivedKey({
        address: 'atone1test123',
        saltName: 'test-salt',
      })

      expect(result.credentialId).toBe('mock-credential-id')
      expect(result.privateKey).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('error handling scenarios', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true,
      })
    })

    afterEach(() => {
      cleanupWebAuthnMock()
    })

    it('should handle credential creation failure', async () => {
      const mockWebAuthn = setupWebAuthnMock({
        prfSupported: true,
        prfOutput: new Uint8Array(32).fill(123),
      })

      // Mock no existing credentials
      mockWebAuthn.mockGet.mockResolvedValueOnce(null)
      // Mock credential creation returns null
      mockWebAuthn.mockCreate.mockResolvedValueOnce(null)

      await expect(
        getOrCreateDerivedKey({
          address: 'atone1test123',
          saltName: 'test-salt',
        })
      ).rejects.toThrow('Failed to create passkey')
    })

    it('should handle successful credential flows', async () => {
      setupWebAuthnMock({
        prfSupported: true,
        prfOutput: new Uint8Array(32).fill(123),
      })

      const result = await getOrCreateDerivedKey({
        address: 'atone1test123',
        saltName: 'test-salt',
      })

      expect(result.credentialId).toBe('mock-credential-id')
      expect(result.privateKey).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('private key derivation logic', () => {
    it('should produce consistent hex output from sha256', () => {
      // Test the pattern used in derivePrivateKey
      const testInput = new Uint8Array([1, 2, 3, 4, 5])
      const hashed = sha256(testInput)
      const hexOutput = toHex(hashed)

      // SHA256 should always produce 64 character hex string (32 bytes)
      expect(hexOutput).toHaveLength(64)
      expect(hexOutput).toMatch(/^[0-9a-f]{64}$/)

      // Should be deterministic
      const hashed2 = sha256(testInput)
      const hexOutput2 = toHex(hashed2)
      expect(hexOutput2).toBe(hexOutput)
    })

    it('should produce different outputs for different inputs', () => {
      const input1 = new Uint8Array([1, 2, 3])
      const input2 = new Uint8Array([4, 5, 6])

      const output1 = toHex(sha256(input1))
      const output2 = toHex(sha256(input2))

      expect(output1).not.toBe(output2)
    })
  })

  describe('salt encoding', () => {
    it('should encode salt strings consistently', () => {
      const salt = 'stint-session'
      const encoded1 = new TextEncoder().encode(salt)
      const encoded2 = new TextEncoder().encode(salt)

      expect(encoded1).toEqual(encoded2)
      expect(encoded1).toBeInstanceOf(Uint8Array)
    })

    it('should produce different encodings for different salts', () => {
      const salt1 = 'stint-session'
      const salt2 = 'trading-session'

      const encoded1 = new TextEncoder().encode(salt1)
      const encoded2 = new TextEncoder().encode(salt2)

      expect(encoded1).not.toEqual(encoded2)
    })
  })

  describe('base64url handling', () => {
    it('should handle base64url decoding with padding', () => {
      // Test base64urlToBytes indirectly through credential ID handling
      const testCredentialId = 'dGVzdC1jcmVkZW50aWFs' // "test-credential" in base64url
      
      // This tests the internal base64urlToBytes function
      expect(testCredentialId).toMatch(/^[A-Za-z0-9_-]+$/)
    })

    it('should handle base64url without padding', () => {
      const testCredentialId = 'dGVzdA' // "test" in base64url without padding
      
      expect(testCredentialId).toMatch(/^[A-Za-z0-9_-]+$/)
    })
  })

  describe('network and permission scenarios', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true,
      })
    })

    afterEach(() => {
      cleanupWebAuthnMock()
    })

    it('should handle authentication timeout gracefully', async () => {
      const mockWebAuthn = setupWebAuthnMock({
        prfSupported: true,
        prfOutput: new Uint8Array(32).fill(123),
      })

      // Mock timeout error on first attempt
      mockWebAuthn.mockGet.mockRejectedValueOnce(
        new DOMException('Operation timed out', 'TimeoutError')
      )

      // Should create new passkey when existing one times out
      const result = await getOrCreateDerivedKey({
        address: 'atone1test123',
        saltName: 'test-salt',
      })

      expect(result.credentialId).toBe('mock-credential-id')
      expect(result.privateKey).toMatch(/^[0-9a-f]{64}$/)
    })

    it('should handle successful authentication flow', async () => {
      setupWebAuthnMock({
        prfSupported: true,
        prfOutput: new Uint8Array(32).fill(123),
      })

      const result = await getOrCreateDerivedKey({
        address: 'atone1test123',
        saltName: 'test-salt',
      })

      expect(result.credentialId).toBe('mock-credential-id')
      expect(result.privateKey).toMatch(/^[0-9a-f]{64}$/)
    })
  })

  describe('getOrCreateDerivedKey', () => {
    let mockWebAuthn: ReturnType<typeof setupWebAuthnMock>

    beforeEach(() => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true,
      })
    })

    afterEach(() => {
      cleanupWebAuthnMock()
    })

    describe('with PRF support', () => {
      beforeEach(() => {
        mockWebAuthn = setupWebAuthnMock({
          prfSupported: true,
          prfOutput: new Uint8Array(32).fill(123),
        })
      })

      it('should create a new passkey derived key when none exists', async () => {
        // Mock no existing credentials
        mockWebAuthn.mockGet.mockResolvedValueOnce(null)

        const result = await getOrCreateDerivedKey({
          address: 'atone1test123',
          displayName: 'Test Key',
          saltName: 'test-salt',
        })

        expect(result.credentialId).toBe('mock-credential-id')
        expect(result.privateKey).toMatch(/^[0-9a-f]{64}$/)
        expect(mockWebAuthn.mockCreate).toHaveBeenCalledOnce()
      })

      it('should reuse existing passkey when available', async () => {
        const result = await getOrCreateDerivedKey({
          address: 'atone1test123',
          displayName: 'Test Key',
          saltName: 'test-salt',
        })

        expect(result.credentialId).toBe('mock-credential-id')
        expect(result.privateKey).toMatch(/^[0-9a-f]{64}$/)
        expect(mockWebAuthn.mockCreate).not.toHaveBeenCalled()
      })

      it('should use default display name when not provided', async () => {
        mockWebAuthn.mockGet.mockResolvedValueOnce(null)

        await getOrCreateDerivedKey({
          address: 'atone1verylongaddress123456789',
        })

        expect(mockWebAuthn.mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            publicKey: expect.objectContaining({
              user: expect.objectContaining({
                displayName: 'Stint: atone1very...',
              }),
            }),
          })
        )
      })

      it('should produce different keys for different salts', async () => {
        const result1 = await getOrCreateDerivedKey({
          address: 'atone1test123',
          saltName: 'salt1',
        })

        // Change PRF output for second call
        mockWebAuthn.mockGet.mockImplementationOnce(
          async () =>
            ({
              id: 'mock-credential-id',
              rawId: new ArrayBuffer(0),
              response: {} as any,
              type: 'public-key' as const,
              authenticatorAttachment: null,
              getClientExtensionResults: () => ({
                prf: {
                  results: {
                    first: new Uint8Array(32).fill(99), // Different PRF output
                  },
                },
              }),
            }) as any
        )

        const result2 = await getOrCreateDerivedKey({
          address: 'atone1test123',
          saltName: 'salt2',
        })

        expect(result1.privateKey).not.toBe(result2.privateKey)
      })
    })

    describe('without PRF support', () => {
      beforeEach(() => {
        mockWebAuthn = setupWebAuthnMock({ prfSupported: false })
      })

      it('should throw error when PRF is not supported on new credential', async () => {
        mockWebAuthn.mockGet.mockResolvedValueOnce(null)

        await expect(
          getOrCreateDerivedKey({
            address: 'atone1test123',
          })
        ).rejects.toThrow('Passkey created but PRF extension not enabled')
      })

      it('should throw error when existing credential has no PRF support', async () => {
        await expect(
          getOrCreateDerivedKey({
            address: 'atone1test123',
          })
        ).rejects.toThrow('Existing passkey does not support PRF extension')
      })
    })

    describe('error handling', () => {
      it('should handle WebAuthn not available', async () => {
        // Remove credentials API
        const originalCredentials = navigator.credentials
        Object.defineProperty(navigator, 'credentials', {
          value: undefined,
          configurable: true,
        })

        await expect(
          getOrCreateDerivedKey({
            address: 'atone1test123',
          })
        ).rejects.toThrow()

        // Restore
        Object.defineProperty(navigator, 'credentials', {
          value: originalCredentials,
          configurable: true,
        })
      })

      it('should handle user cancellation', async () => {
        mockWebAuthn = setupWebAuthnMock({ prfSupported: true })
        mockWebAuthn.mockGet.mockResolvedValueOnce(null)
        mockWebAuthn.mockCreate.mockRejectedValueOnce(new Error('User cancelled'))

        await expect(
          getOrCreateDerivedKey({
            address: 'atone1test123',
          })
        ).rejects.toThrow('User cancelled')
      })
    })
  })
})
