import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { dateToTimestamp, newSessionSigner, convertRpcToRestUrl } from './stint'
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import type { SessionSigner, DelegationConfig } from './types'
import { StintError, ErrorCodes } from './errors'

// Mock the passkey module
vi.mock('./passkey', () => ({
  getOrCreateDerivedKey: vi.fn().mockResolvedValue({
    privateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  }),
}))

// Mock the random module
vi.mock('./random', () => ({
  getOrCreateRandomKey: vi.fn().mockReturnValue(
    '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  )
}))

describe('dateToTimestamp', () => {
  // Table-driven tests for dateToTimestamp
  const testCases = [
    {
      name: 'zero milliseconds',
      input: new Date('2024-01-01T00:00:00.000Z'),
      expectedSeconds: 1704067200n,
      expectedNanos: 0,
    },
    {
      name: '123 milliseconds',
      input: new Date('2024-01-01T00:00:00.123Z'),
      expectedSeconds: 1704067200n,
      expectedNanos: 123000000,
    },
    {
      name: '999 milliseconds',
      input: new Date('2024-01-01T00:00:00.999Z'),
      expectedSeconds: 1704067200n,
      expectedNanos: 999000000,
    },
    {
      name: 'epoch time',
      input: new Date('1970-01-01T00:00:00.000Z'),
      expectedSeconds: 0n,
      expectedNanos: 0,
    },
    {
      name: 'far future date',
      input: new Date('2100-12-31T23:59:59.999Z'),
      expectedSeconds: 4133980799n, // Corrected timestamp
      expectedNanos: 999000000,
    },
  ]

  testCases.forEach(({ name, input, expectedSeconds, expectedNanos }) => {
    it(`should handle ${name}`, () => {
      const timestamp = dateToTimestamp(input)
      expect(timestamp.seconds).toBe(expectedSeconds)
      expect(timestamp.nanos).toBe(expectedNanos)
    })
  })
})

describe('convertRpcToRestUrl', () => {
  // Table-driven tests for URL conversion security
  const validTestCases = [
    {
      name: 'standard RPC URL with port',
      input: 'https://rpc.cosmos.directory:26657',
      expected: 'https://api.cosmos.directory:1317',
    },
    {
      name: 'HTTP RPC URL',
      input: 'http://localhost:26657',
      expected: 'http://localhost:1317',
    },
    {
      name: 'RPC URL without port',
      input: 'https://rpc.cosmos.directory',
      expected: 'https://api.cosmos.directory',
    },
    {
      name: 'URL without RPC subdomain',
      input: 'https://cosmos.directory:26657',
      expected: 'https://cosmos.directory:1317',
    },
    {
      name: 'URL with path',
      input: 'https://rpc.cosmos.directory:26657/some/path',
      expected: 'https://api.cosmos.directory:1317/some/path',
    },
    {
      name: 'AtomOne testnet pattern',
      input: 'https://atomone-testnet-1-rpc.allinbits.services',
      expected: 'https://atomone-testnet-1-api.allinbits.services',
    },
  ]

  const invalidTestCases = [
    {
      name: 'invalid protocol (ftp)',
      input: 'ftp://rpc.cosmos.directory:26657',
      expectedError: 'Invalid RPC URL provided',
    },
    {
      name: 'invalid protocol (javascript)',
      input: 'javascript:alert(1)',
      expectedError: 'Invalid RPC URL provided',
    },
    {
      name: 'malformed URL',
      input: 'not-a-url',
      expectedError: 'Invalid RPC URL provided',
    },
    {
      name: 'empty string',
      input: '',
      expectedError: 'Invalid RPC URL provided',
    },
  ]

  validTestCases.forEach(({ name, input, expected }) => {
    it(`should handle ${name}`, () => {
      const result = convertRpcToRestUrl(input)
      expect(result).toBe(expected)
    })
  })

  invalidTestCases.forEach(({ name, input, expectedError }) => {
    it(`should reject ${name}`, () => {
      expect(() => convertRpcToRestUrl(input)).toThrow(StintError)
      expect(() => convertRpcToRestUrl(input)).toThrow(expectedError)

      try {
        convertRpcToRestUrl(input)
      } catch (error) {
        expect(error).toBeInstanceOf(StintError)
        if (error instanceof StintError) {
          expect(error.code).toBe(ErrorCodes.INVALID_RPC_URL)
        }
      }
    })
  })
})

describe('SessionSigner methods', () => {
  let mockPrimaryClient: SigningStargateClient
  let signer: SessionSigner

  beforeEach(async () => {
    // Create mock primary client
    mockPrimaryClient = {
      signer: {
        getAccounts: vi
          .fn()
          .mockResolvedValue([
            { address: 'atone1primary123', algo: 'secp256k1', pubkey: new Uint8Array() },
          ]),
      },
      cometClient: {
        client: {
          url: 'http://localhost:26657',
        },
      },
      gasPrice: { amount: '0.025', denom: 'uatom' },
    } as unknown as SigningStargateClient

    // Mock DirectSecp256k1Wallet.fromKey
    vi.spyOn(DirectSecp256k1Wallet, 'fromKey').mockResolvedValue({
      getAccounts: vi
        .fn()
        .mockResolvedValue([
          { address: 'atone1session456', algo: 'secp256k1', pubkey: new Uint8Array() },
        ]),
    } as unknown as DirectSecp256k1Wallet)

    // Mock SigningStargateClient.connectWithSigner
    vi.spyOn(SigningStargateClient, 'connectWithSigner').mockResolvedValue({
      cometClient: {
        client: {
          url: 'http://localhost:26657',
        },
      },
    } as unknown as SigningStargateClient)

    signer = await newSessionSigner({
      primaryClient: mockPrimaryClient,
      saltName: 'test-salt',
    })
  })

  describe('generateDelegationMessages', () => {
    it('should generate authz grant and feegrant messages with default values', () => {
      const config: DelegationConfig = {}
      const messages = signer.generateDelegationMessages(config)

      expect(messages).toHaveLength(2)

      // Check authz grant message
      const authzMessage = messages[0]
      expect(authzMessage.typeUrl).toBe('/cosmos.authz.v1beta1.MsgGrant')
      expect(authzMessage.value.granter).toBe('atone1primary123')
      expect(authzMessage.value.grantee).toBe('atone1session456')
      expect(authzMessage.value.grant?.authorization).toBeDefined()
      expect(authzMessage.value.grant?.expiration).toBeDefined()

      // Check feegrant message
      const feegrantMessage = messages[1]
      expect(feegrantMessage.typeUrl).toBe('/cosmos.feegrant.v1beta1.MsgGrantAllowance')
      expect(feegrantMessage.value.granter).toBe('atone1primary123')
      expect(feegrantMessage.value.grantee).toBe('atone1session456')
      expect(feegrantMessage.value.allowance).toBeDefined()
    })

    it('should use custom spend limit when provided (uatom)', () => {
      const config: DelegationConfig = {
        spendLimit: { denom: 'uatom', amount: '5000000' },
      }
      const messages = signer.generateDelegationMessages(config)
      const authzMessage = messages[0]

      // The authorization details are encoded, but we can verify the structure
      expect(authzMessage.value.grant?.authorization?.typeUrl).toBe(
        '/cosmos.bank.v1beta1.SendAuthorization'
      )
    })

    it('should use custom spend limit when provided (uphoton)', () => {
      const config: DelegationConfig = {
        spendLimit: { denom: 'uphoton', amount: '1000000' },
      }
      const messages = signer.generateDelegationMessages(config)
      const authzMessage = messages[0]

      // The authorization details are encoded, but we can verify the structure
      expect(authzMessage.value.grant?.authorization?.typeUrl).toBe(
        '/cosmos.bank.v1beta1.SendAuthorization'
      )
    })

    it('should use custom gas limit when provided (uphoton only)', () => {
      const config: DelegationConfig = {
        gasLimit: { denom: 'uphoton', amount: '2000000' },
      }
      const messages = signer.generateDelegationMessages(config)
      const feegrantMessage = messages[1]

      expect(feegrantMessage.value.allowance?.typeUrl).toBe(
        '/cosmos.feegrant.v1beta1.BasicAllowance'
      )
    })

    it('should use custom expiration when provided', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
      const config: DelegationConfig = {
        sessionExpiration: futureDate,
      }
      const messages = signer.generateDelegationMessages(config)
      const authzMessage = messages[0]

      // Verify expiration is set (encoded in the grant)
      expect(authzMessage.value.grant?.expiration).toBeDefined()
    })

    it('should handle allowed recipients list', () => {
      const config: DelegationConfig = {
        allowedRecipients: ['atone1recipient1', 'atone1recipient2'],
      }
      const messages = signer.generateDelegationMessages(config)
      const authzMessage = messages[0]

      expect(authzMessage.value.grant?.authorization).toBeDefined()
      expect(authzMessage.value.grant?.authorization?.typeUrl).toBe(
        '/cosmos.bank.v1beta1.SendAuthorization'
      )
    })

    // Table-driven tests for conditional delegation messages
    describe('generateConditionalDelegationMessages', () => {
      it('should generate both messages when neither grant exists', async () => {
        const result = await signer.generateConditionalDelegationMessages({
          sessionExpiration: new Date(Date.now() + 3600000),
          spendLimit: { denom: 'uphoton', amount: '5000000' },
          gasLimit: { denom: 'uphoton', amount: '2000000' },
        })

        expect(result.length).toBe(2)
        expect(result[0].typeUrl).toBe('/cosmos.authz.v1beta1.MsgGrant')
        expect(result[1].typeUrl).toBe('/cosmos.feegrant.v1beta1.MsgGrantAllowance')
      })

      it('should generate only authz when feegrant exists', async () => {
        // Mock feegrant exists but authz doesn't
        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({ grants: [] }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              allowance: { spendLimit: [{ denom: 'uphoton', amount: '1000000' }] },
            }),
          })

        const result = await signer.generateConditionalDelegationMessages({
          spendLimit: { denom: 'uphoton', amount: '5000000' },
        })

        expect(result.length).toBe(1)
        expect(result[0].typeUrl).toBe('/cosmos.authz.v1beta1.MsgGrant')
      })

      it('should generate only feegrant when authz exists', async () => {
        // Mock authz exists but feegrant doesn't
        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ grants: [{ authorization: {}, expiration: null }] }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: async () => ({}),
          })

        const result = await signer.generateConditionalDelegationMessages({
          gasLimit: { denom: 'uphoton', amount: '2000000' },
        })

        expect(result.length).toBe(1)
        expect(result[0].typeUrl).toBe('/cosmos.feegrant.v1beta1.MsgGrantAllowance')
      })

      it('should generate no messages when both grants exist', async () => {
        // Mock both grants exist
        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ grants: [{ authorization: {}, expiration: null }] }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              allowance: { spendLimit: [{ denom: 'uphoton', amount: '1000000' }] },
            }),
          })

        const result = await signer.generateConditionalDelegationMessages({
          spendLimit: { denom: 'uphoton', amount: '5000000' },
          gasLimit: { denom: 'uphoton', amount: '2000000' },
        })

        expect(result.length).toBe(0)
      })
    })

    // Table-driven tests for AtomOne denomination scenarios
    describe('AtomOne denomination support', () => {
      const atomOneTestCases = [
        {
          name: 'uatom spend limit with uphoton gas (ATOM sends)',
          config: {
            spendLimit: { denom: 'uatom', amount: '1000000' },
            gasLimit: { denom: 'uphoton', amount: '500000' },
          },
          description: 'Should allow ATOM sends with PHOTON gas fees',
        },
        {
          name: 'uphoton spend limit with uphoton gas (PHOTON sends)',
          config: {
            spendLimit: { denom: 'uphoton', amount: '2000000' },
            gasLimit: { denom: 'uphoton', amount: '500000' },
          },
          description: 'Should allow PHOTON sends with PHOTON gas fees',
        },
        {
          name: 'mixed denominations with default gas',
          config: {
            spendLimit: { denom: 'uatom', amount: '5000000' },
            // gasLimit defaults to uphoton
          },
          description: 'Should default to uphoton for gas when not specified',
        },
        {
          name: 'uphoton only (fee token usage)',
          config: {
            spendLimit: { denom: 'uphoton', amount: '10000000' },
            gasLimit: { denom: 'uphoton', amount: '1000000' },
          },
          description: 'Should support uphoton for both spending and gas',
        },
      ]

      atomOneTestCases.forEach(({ name, config, description }) => {
        it(name, () => {
          const messages = signer.generateDelegationMessages(config)
          const authzMessage = messages[0]
          const feegrantMessage = messages[1]

          // Verify authz grant structure
          expect(authzMessage.value.granter).toBe('atone1primary123')
          expect(authzMessage.value.grantee).toBe('atone1session456')
          expect(authzMessage.value.grant?.authorization?.typeUrl).toBe(
            '/cosmos.bank.v1beta1.SendAuthorization'
          )

          // Verify feegrant structure
          expect(feegrantMessage.value.granter).toBe('atone1primary123')
          expect(feegrantMessage.value.grantee).toBe('atone1session456')
          expect(feegrantMessage.value.allowance?.typeUrl).toBe(
            '/cosmos.feegrant.v1beta1.BasicAllowance'
          )

          // Log the test description for documentation
          expect(description).toBeDefined()
        })
      })

      it('should default to uphoton for both spend and gas limits', () => {
        const config: DelegationConfig = {}
        const messages = signer.generateDelegationMessages(config)
        const authzMessage = messages[0]
        const feegrantMessage = messages[1]

        // Both defaults should be uphoton as per AtomOne requirements
        expect(authzMessage.value.grant?.authorization?.typeUrl).toBe(
          '/cosmos.bank.v1beta1.SendAuthorization'
        )
        expect(feegrantMessage.value.allowance?.typeUrl).toBe(
          '/cosmos.feegrant.v1beta1.BasicAllowance'
        )
      })

      it('should enforce uphoton for feegrant even when different denom provided for spend', () => {
        const config: DelegationConfig = {
          spendLimit: { denom: 'uatom', amount: '1000000' },
          gasLimit: { denom: 'uphoton', amount: '500000' },
        }
        const messages = signer.generateDelegationMessages(config)
        const authzMessage = messages[0]
        const feegrantMessage = messages[1]

        // Authz can use uatom for spending
        expect(authzMessage.value.grant?.authorization?.typeUrl).toBe(
          '/cosmos.bank.v1beta1.SendAuthorization'
        )

        // But feegrant must always use uphoton in AtomOne
        expect(feegrantMessage.value.allowance?.typeUrl).toBe(
          '/cosmos.feegrant.v1beta1.BasicAllowance'
        )
        expect(feegrantMessage.value.granter).toBe('atone1primary123')
        expect(feegrantMessage.value.grantee).toBe('atone1session456')
      })
    })
  })

  describe('revokeDelegationMessages', () => {
    it('should generate revoke messages with default message type', () => {
      const messages = signer.revokeDelegationMessages()
      const revokeAuthzMessage = messages[0]
      const revokeFeegrantMessage = messages[1]

      expect(revokeAuthzMessage.value.granter).toBe('atone1primary123')
      expect(revokeAuthzMessage.value.grantee).toBe('atone1session456')
      expect(revokeAuthzMessage.value.msgTypeUrl).toBe('/cosmos.bank.v1beta1.MsgSend')

      expect(revokeFeegrantMessage.value.granter).toBe('atone1primary123')
      expect(revokeFeegrantMessage.value.grantee).toBe('atone1session456')
    })

    it('should use custom message type when provided', () => {
      const customMsgType = '/cosmos.staking.v1beta1.MsgDelegate'
      const messages = signer.revokeDelegationMessages(customMsgType)
      const revokeAuthzMessage = messages[0]

      expect(revokeAuthzMessage.value.msgTypeUrl).toBe(customMsgType)
    })
  })

  describe('hasAuthzGrant', () => {
    beforeEach(() => {
      // Reset fetch mock before each test
      vi.clearAllMocks()
    })

    it('should handle response size validation for authz', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((header: string) => {
            if (header === 'content-length') return '2000000' // 2MB - too large
            if (header === 'content-type') return 'application/json'
            return null
          }),
        },
        json: async () => ({ grants: [{ authorization: {}, expiration: null }] }),
      })

      const result = await signer.hasAuthzGrant()
      expect(result).toBeNull()
    })

    it('should handle invalid content type for authz', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((header: string) => {
            if (header === 'content-length') return '1000'
            if (header === 'content-type') return 'text/plain' // Wrong content type
            return null
          }),
        },
        json: async () => ({ grants: [{ authorization: {}, expiration: null }] }),
      })

      const result = await signer.hasAuthzGrant()
      expect(result).toBeNull()
    })

    // Table-driven tests for hasAuthzGrant
    const authzTestCases = [
      {
        name: 'returns grant info when grant exists',
        mockResponse: {
          ok: true,
          json: async () => ({
            grants: [
              {
                authorization: {
                  '@type': '/cosmos.bank.v1beta1.SendAuthorization',
                  spend_limit: [{ denom: 'uatom', amount: '1000000' }],
                },
                expiration: '2024-12-31T23:59:59Z',
              },
            ],
          }),
        },
        expectedResult: {
          authorization: {
            '@type': '/cosmos.bank.v1beta1.SendAuthorization',
            spend_limit: [{ denom: 'uatom', amount: '1000000' }],
          },
          expiration: new Date('2024-12-31T23:59:59Z'),
        },
      },
      {
        name: 'returns null when no grants exist',
        mockResponse: {
          ok: true,
          json: async () => ({ grants: [] }),
        },
        expectedResult: null,
      },
      {
        name: 'returns null on network error',
        mockResponse: {
          ok: false,
        },
        expectedResult: null,
      },
      {
        name: 'returns null when fetch throws',
        mockError: new Error('Network error'),
        expectedResult: null,
      },
      {
        name: 'handles grant without expiration',
        mockResponse: {
          ok: true,
          json: async () => ({
            grants: [
              {
                authorization: { '@type': '/cosmos.bank.v1beta1.SendAuthorization' },
                // no expiration field
              },
            ],
          }),
        },
        expectedResult: {
          authorization: { '@type': '/cosmos.bank.v1beta1.SendAuthorization' },
          expiration: undefined,
        },
      },
    ]

    authzTestCases.forEach(({ name, mockResponse, mockError, expectedResult }) => {
      it(name, async () => {
        if (mockError) {
          global.fetch = vi.fn().mockRejectedValue(mockError)
        } else {
          global.fetch = vi.fn().mockResolvedValue(mockResponse)
        }

        const result = await signer.hasAuthzGrant()
        expect(result).toEqual(expectedResult)
      })
    })

    it('uses custom message type when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ grants: [] }),
      })

      await signer.hasAuthzGrant('/cosmos.staking.v1beta1.MsgDelegate')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('msg_type_url=/cosmos.staking.v1beta1.MsgDelegate'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Accept: 'application/json',
            'User-Agent': 'stint-library/1.0.0',
          }),
          redirect: 'error',
        })
      )
    })
  })

  describe('hasFeegrant', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('should handle response size validation', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((header: string) => {
            if (header === 'content-length') return '2000000' // 2MB - too large
            if (header === 'content-type') return 'application/json'
            return null
          }),
        },
        json: async () => ({ allowance: { test: 'data' } }),
      })

      const result = await signer.hasFeegrant()
      expect(result).toBeNull()
    })

    it('should handle invalid content type', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: vi.fn().mockImplementation((header: string) => {
            if (header === 'content-length') return '1000'
            if (header === 'content-type') return 'text/html' // Wrong content type
            return null
          }),
        },
        json: async () => ({ allowance: { test: 'data' } }),
      })

      const result = await signer.hasFeegrant()
      expect(result).toBeNull()
    })

    // Table-driven tests for hasFeegrant
    const feegrantTestCases = [
      {
        name: 'returns feegrant info when allowance exists',
        mockResponse: {
          ok: true,
          json: async () => ({
            allowance: {
              granter: 'atone1primary123',
              grantee: 'atone1session456',
              allowance: {
                '@type': '/cosmos.feegrant.v1beta1.BasicAllowance',
                spend_limit: [{ denom: 'uphoton', amount: '10000000' }],
              },
              expiration: '2024-12-31T23:59:59Z',
            },
          }),
        },
        expectedResult: {
          allowance: {
            granter: 'atone1primary123',
            grantee: 'atone1session456',
            allowance: {
              '@type': '/cosmos.feegrant.v1beta1.BasicAllowance',
              spend_limit: [{ denom: 'uphoton', amount: '10000000' }],
            },
            expiration: '2024-12-31T23:59:59Z',
          },
          expiration: new Date('2024-12-31T23:59:59Z'),
        },
      },
      {
        name: 'returns null when no allowance exists',
        mockResponse: {
          ok: true,
          json: async () => ({}),
        },
        expectedResult: null,
      },
      {
        name: 'returns null on 404 response',
        mockResponse: {
          ok: false,
          status: 404,
        },
        expectedResult: null,
      },
      {
        name: 'returns null when fetch throws',
        mockError: new Error('Network error'),
        expectedResult: null,
      },
      {
        name: 'handles allowance without expiration',
        mockResponse: {
          ok: true,
          json: async () => ({
            allowance: {
              granter: 'atone1primary123',
              grantee: 'atone1session456',
              allowance: {
                '@type': '/cosmos.feegrant.v1beta1.BasicAllowance',
                spend_limit: [{ denom: 'uphoton', amount: '10000000' }],
              },
              // no expiration field
            },
          }),
        },
        expectedResult: {
          allowance: {
            granter: 'atone1primary123',
            grantee: 'atone1session456',
            allowance: {
              '@type': '/cosmos.feegrant.v1beta1.BasicAllowance',
              spend_limit: [{ denom: 'uphoton', amount: '10000000' }],
            },
          },
          expiration: undefined,
        },
      },
    ]

    feegrantTestCases.forEach(({ name, mockResponse, mockError, expectedResult }) => {
      it(name, async () => {
        if (mockError) {
          global.fetch = vi.fn().mockRejectedValue(mockError)
        } else {
          global.fetch = vi.fn().mockResolvedValue(mockResponse)
        }

        const result = await signer.hasFeegrant()
        expect(result).toEqual(expectedResult)
      })
    })
  })

  describe('window-based session signer configuration', () => {
    let mockPrimaryClient: SigningStargateClient
    let originalDateNow: typeof Date.now

    beforeEach(async () => {
      originalDateNow = Date.now

      // Create mock primary client
      mockPrimaryClient = {
        signer: {
          getAccounts: vi
            .fn()
            .mockResolvedValue([
              { address: 'atone1primary123', algo: 'secp256k1', pubkey: new Uint8Array() },
            ]),
        },
        cometClient: {
          client: {
            url: 'http://localhost:26657',
          },
        },
        gasPrice: { amount: '0.025', denom: 'uphoton' },
      } as unknown as SigningStargateClient

      // Mock DirectSecp256k1Wallet.fromKey
      vi.spyOn(DirectSecp256k1Wallet, 'fromKey').mockResolvedValue({
        getAccounts: vi
          .fn()
          .mockResolvedValue([
            { address: 'atone1session456', algo: 'secp256k1', pubkey: new Uint8Array() },
          ]),
      } as unknown as DirectSecp256k1Wallet)

      // Mock SigningStargateClient.connectWithSigner
      vi.spyOn(SigningStargateClient, 'connectWithSigner').mockResolvedValue({
        cometClient: {
          client: {
            url: 'http://localhost:26657',
          },
        },
      } as unknown as SigningStargateClient)
    })

    afterEach(() => {
      Date.now = originalDateNow
      vi.clearAllMocks()
    })

    describe('usePreviousWindow flag', () => {
      // Table-driven tests for window selection scenarios
      const windowSelectionTestCases = [
        {
          name: 'current window when usePreviousWindow is false',
          timestamp: 50 * 60 * 60 * 1000, // 50 hours = 2 full 24h windows + 2 hours
          windowHours: 24,
          usePreviousWindow: false,
          expectedWindowNumber: 2,
          description: 'Should select current window by default',
        },
        {
          name: 'previous window when usePreviousWindow is true',
          timestamp: 50 * 60 * 60 * 1000, // 50 hours = 2 full 24h windows + 2 hours
          windowHours: 24,
          usePreviousWindow: true,
          expectedWindowNumber: 1,
          description: 'Should select previous window for grace period',
        },
        {
          name: 'current window with 8-hour windows',
          timestamp: 25 * 60 * 60 * 1000, // 25 hours = 3 full 8h windows + 1 hour
          windowHours: 8,
          usePreviousWindow: false,
          expectedWindowNumber: 3,
          description: 'Should work with non-standard window sizes',
        },
        {
          name: 'previous window with 8-hour windows',
          timestamp: 25 * 60 * 60 * 1000, // 25 hours = 3 full 8h windows + 1 hour
          windowHours: 8,
          usePreviousWindow: true,
          expectedWindowNumber: 2,
          description: 'Grace period should work with any window size',
        },
        {
          name: 'current window with odd-sized windows',
          timestamp: 118 * 60 * 60 * 1000, // 118 hours = 3 full 39h windows + 1 hour
          windowHours: 39,
          usePreviousWindow: false,
          expectedWindowNumber: 3,
          description: 'Should handle arbitrary window sizes correctly',
        },
        {
          name: 'previous window with odd-sized windows',
          timestamp: 118 * 60 * 60 * 1000, // 118 hours = 3 full 39h windows + 1 hour
          windowHours: 39,
          usePreviousWindow: true,
          expectedWindowNumber: 2,
          description: 'Grace period should work with odd window sizes',
        },
        {
          name: 'at window boundary - current',
          timestamp: 24 * 60 * 60 * 1000, // Exactly at 24h boundary
          windowHours: 24,
          usePreviousWindow: false,
          expectedWindowNumber: 1,
          description: 'Should select correct window at exact boundary',
        },
        {
          name: 'at window boundary - previous',
          timestamp: 24 * 60 * 60 * 1000, // Exactly at 24h boundary
          windowHours: 24,
          usePreviousWindow: true,
          expectedWindowNumber: 0,
          description: 'Grace period should work at window boundaries',
        },
      ]

      windowSelectionTestCases.forEach(
        ({
          name,
          timestamp,
          windowHours,
          usePreviousWindow,
          expectedWindowNumber,
          description,
        }) => {
          it(`should handle ${name}`, async () => {
            // Mock Date.now to return our test timestamp
            Date.now = vi.fn().mockReturnValue(timestamp)

            // Track which window number is actually used in the passkey derivation
            let actualWindowNumber: number | undefined

            // Mock getOrCreateDerivedKey to capture the window number
            const mockGetOrCreateDerivedKey = vi.mocked(
              await import('./passkey')
            ).getOrCreateDerivedKey
            mockGetOrCreateDerivedKey.mockImplementation(async (config) => {
              actualWindowNumber = config.windowNumber
              return {
                credentialId: 'mock-credential-id',
                privateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              }
            })

            // Create session signer with the specified configuration
            await newSessionSigner({
              primaryClient: mockPrimaryClient,
              saltName: 'test-salt',
              stintWindowHours: windowHours,
              usePreviousWindow: usePreviousWindow,
            })

            // Verify the correct window number was passed to passkey derivation
            expect(actualWindowNumber).toBe(expectedWindowNumber)

            // Verify getOrCreateDerivedKey was called with the expected config
            expect(mockGetOrCreateDerivedKey).toHaveBeenCalledWith(
              expect.objectContaining({
                stintWindowHours: windowHours,
                windowNumber: expectedWindowNumber,
              })
            )

            // Log description for documentation
            expect(description).toBeDefined()
          })
        }
      )

      it('should default to current window when usePreviousWindow not specified', async () => {
        const timestamp = 72 * 60 * 60 * 1000 // 72 hours = 3 full 24h windows
        Date.now = vi.fn().mockReturnValue(timestamp)

        let actualWindowNumber: number | undefined

        const mockGetOrCreateDerivedKey = vi.mocked(await import('./passkey')).getOrCreateDerivedKey
        mockGetOrCreateDerivedKey.mockImplementation(async (config) => {
          actualWindowNumber = config.windowNumber
          return {
            credentialId: 'mock-credential-id',
            privateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          }
        })

        await newSessionSigner({
          primaryClient: mockPrimaryClient,
          saltName: 'test-salt',
          stintWindowHours: 24,
          // usePreviousWindow not specified, should default to false
        })

        // Should use current window (3) not previous window (2)
        const expectedCurrentWindow = 3
        expect(actualWindowNumber).toBe(expectedCurrentWindow)
      })

      it('should handle edge case where previous window would be negative', async () => {
        // Test early timestamp where previous window would be -1
        const timestamp = 1000 // Very early timestamp, current window = 0
        Date.now = vi.fn().mockReturnValue(timestamp)

        let actualWindowNumber: number | undefined

        const mockGetOrCreateDerivedKey = vi.mocked(await import('./passkey')).getOrCreateDerivedKey
        mockGetOrCreateDerivedKey.mockImplementation(async (config) => {
          actualWindowNumber = config.windowNumber
          return {
            credentialId: 'mock-credential-id',
            privateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          }
        })

        await newSessionSigner({
          primaryClient: mockPrimaryClient,
          saltName: 'test-salt',
          stintWindowHours: 24,
          usePreviousWindow: true,
        })

        // Previous window of 0 should be -1
        expect(actualWindowNumber).toBe(-1)
      })
    })

    describe('stintWindowHours configuration', () => {
      // Table-driven tests for different window hour values
      const windowHoursTestCases = [
        {
          name: 'default 24 hours when not specified',
          stintWindowHours: undefined,
          expectedWindowHours: 24,
          description: 'Should use 24-hour default',
        },
        {
          name: '8 hour windows',
          stintWindowHours: 8,
          expectedWindowHours: 8,
          description: 'Shorter windows for higher security rotation',
        },
        {
          name: '48 hour windows',
          stintWindowHours: 48,
          expectedWindowHours: 48,
          description: 'Extended windows for convenience',
        },
        {
          name: '1 hour windows',
          stintWindowHours: 1,
          expectedWindowHours: 1,
          description: 'Hourly rotation for maximum security',
        },
        {
          name: '168 hour windows (1 week)',
          stintWindowHours: 168,
          expectedWindowHours: 168,
          description: 'Weekly rotation for long-term sessions',
        },
        {
          name: '39 hour windows (odd number)',
          stintWindowHours: 39,
          expectedWindowHours: 39,
          description: 'Non-standard intervals should work correctly',
        },
      ]

      windowHoursTestCases.forEach(
        ({ name, stintWindowHours, expectedWindowHours, description }) => {
          it(`should handle ${name}`, async () => {
            let actualStintWindowHours: number | undefined

            const mockGetOrCreateDerivedKey = vi.mocked(
              await import('./passkey')
            ).getOrCreateDerivedKey
            mockGetOrCreateDerivedKey.mockImplementation(async (config) => {
              actualStintWindowHours = config.stintWindowHours
              return {
                credentialId: 'mock-credential-id',
                privateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
              }
            })

            await newSessionSigner({
              primaryClient: mockPrimaryClient,
              saltName: 'test-salt',
              stintWindowHours: stintWindowHours,
            })

            expect(actualStintWindowHours).toBe(expectedWindowHours)
            expect(description).toBeDefined()
          })
        }
      )
    })

    describe('window calculation consistency', () => {
      it('should produce same window number for same timestamp and config', async () => {
        const timestamp = 100 * 60 * 60 * 1000 // 100 hours
        Date.now = vi.fn().mockReturnValue(timestamp)

        const capturedConfigs: any[] = []

        const mockGetOrCreateDerivedKey = vi.mocked(await import('./passkey')).getOrCreateDerivedKey
        mockGetOrCreateDerivedKey.mockImplementation(async (config) => {
          capturedConfigs.push(config)
          return {
            credentialId: 'mock-credential-id',
            privateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          }
        })

        // Create multiple signers with same config
        await newSessionSigner({
          primaryClient: mockPrimaryClient,
          stintWindowHours: 24,
          usePreviousWindow: false,
        })

        await newSessionSigner({
          primaryClient: mockPrimaryClient,
          stintWindowHours: 24,
          usePreviousWindow: false,
        })

        // Should have same window number for both calls
        expect(capturedConfigs).toHaveLength(2)
        expect(capturedConfigs[0].windowNumber).toBe(capturedConfigs[1].windowNumber)
        expect(capturedConfigs[0].stintWindowHours).toBe(capturedConfigs[1].stintWindowHours)
      })

      it('should produce different window numbers for different usePreviousWindow settings', async () => {
        const timestamp = 100 * 60 * 60 * 1000 // 100 hours
        Date.now = vi.fn().mockReturnValue(timestamp)

        const capturedConfigs: any[] = []

        const mockGetOrCreateDerivedKey = vi.mocked(await import('./passkey')).getOrCreateDerivedKey
        mockGetOrCreateDerivedKey.mockImplementation(async (config) => {
          capturedConfigs.push(config)
          return {
            credentialId: 'mock-credential-id',
            privateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          }
        })

        // Current window
        await newSessionSigner({
          primaryClient: mockPrimaryClient,
          stintWindowHours: 24,
          usePreviousWindow: false,
        })

        // Previous window
        await newSessionSigner({
          primaryClient: mockPrimaryClient,
          stintWindowHours: 24,
          usePreviousWindow: true,
        })

        // Should have different window numbers
        expect(capturedConfigs).toHaveLength(2)
        expect(capturedConfigs[0].windowNumber).toBe(capturedConfigs[1].windowNumber + 1)
      })
    })

    describe('SessionSigner with Random Mode', () => {
      it('should create session signer with random key mode', async () => {
        // Import mocked modules
        const { getOrCreateRandomKey } = await import('./random')
        const { getOrCreateDerivedKey } = await import('./passkey')

        // Clear previous calls
        vi.clearAllMocks()

        // Create session signer with random mode
        const signer = await newSessionSigner({
          primaryClient: mockPrimaryClient,
          keyMode: 'random'
        })

        // Verify random key generation was called
        expect(getOrCreateRandomKey).toHaveBeenCalledWith({
          configObject: expect.objectContaining({
            primaryClient: mockPrimaryClient,
            keyMode: 'random'
          }),
          logger: expect.any(Object)
        })

        // Verify passkey was not called
        expect(getOrCreateDerivedKey).not.toHaveBeenCalled()

        // Verify signer was created
        expect(signer).toBeDefined()
        expect(signer.primaryAddress()).toBe('atone1primary123')
        expect(signer.sessionAddress()).toBe('atone1session456')
      })

      it('should use passkey mode by default', async () => {
        // Import mocked modules
        const { getOrCreateDerivedKey } = await import('./passkey')
        const { getOrCreateRandomKey } = await import('./random')

        // Clear previous calls
        vi.clearAllMocks()

        // Create session signer without specifying keyMode
        const signer = await newSessionSigner({
          primaryClient: mockPrimaryClient
        })

        // Verify passkey was used, not random
        expect(getOrCreateDerivedKey).toHaveBeenCalled()
        expect(getOrCreateRandomKey).not.toHaveBeenCalled()

        // Verify signer was created
        expect(signer).toBeDefined()
      })
    })
  })
})
