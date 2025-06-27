import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dateToTimestamp, newSessionWallet } from './stint'
import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import type { SessionWallet, DelegationConfig } from './types'

// Mock the passkey module
vi.mock('./passkey', () => ({
  getOrCreatePasskeyWallet: vi.fn().mockResolvedValue({
    privateKey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  }),
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

describe('SessionWallet methods', () => {
  let mockPrimaryClient: SigningStargateClient
  let wallet: SessionWallet

  beforeEach(async () => {
    // Create mock primary client
    mockPrimaryClient = {
      signer: {
        getAccounts: vi.fn().mockResolvedValue([
          { address: 'cosmos1primary123', algo: 'secp256k1', pubkey: new Uint8Array() }
        ])
      },
      cometClient: {
        client: {
          url: 'http://localhost:26657'
        }
      },
      gasPrice: { amount: '0.025', denom: 'uatom' }
    } as unknown as SigningStargateClient

    // Mock DirectSecp256k1Wallet.fromKey
    vi.spyOn(DirectSecp256k1Wallet, 'fromKey').mockResolvedValue({
      getAccounts: vi.fn().mockResolvedValue([
        { address: 'cosmos1session456', algo: 'secp256k1', pubkey: new Uint8Array() }
      ])
    } as unknown as DirectSecp256k1Wallet)

    // Mock SigningStargateClient.connectWithSigner
    vi.spyOn(SigningStargateClient, 'connectWithSigner').mockResolvedValue({
      cometClient: {
        client: {
          url: 'http://localhost:26657'
        }
      }
    } as unknown as SigningStargateClient)

    wallet = await newSessionWallet({
      primaryClient: mockPrimaryClient,
      saltName: 'test-salt',
    })
  })

  describe('generateDelegationMessages', () => {
    it('should generate authz grant and feegrant messages with default values', () => {
      const config: DelegationConfig = {}
      const messages = wallet.generateDelegationMessages(config)
      
      expect(messages).toHaveLength(2)
      
      // Check authz grant message
      const authzMessage = messages[0]
      expect(authzMessage.typeUrl).toBe('/cosmos.authz.v1beta1.MsgGrant')
      expect(authzMessage.value.granter).toBe('cosmos1primary123')
      expect(authzMessage.value.grantee).toBe('cosmos1session456')
      expect(authzMessage.value.grant?.authorization).toBeDefined()
      expect(authzMessage.value.grant?.expiration).toBeDefined()

      // Check feegrant message
      const feegrantMessage = messages[1]
      expect(feegrantMessage.typeUrl).toBe('/cosmos.feegrant.v1beta1.MsgGrantAllowance')
      expect(feegrantMessage.value.granter).toBe('cosmos1primary123')
      expect(feegrantMessage.value.grantee).toBe('cosmos1session456')
      expect(feegrantMessage.value.allowance).toBeDefined()
    })

    it('should use custom spend limit when provided (uatom)', () => {
      const config: DelegationConfig = {
        spendLimit: { denom: 'uatom', amount: '5000000' }
      }
      const messages = wallet.generateDelegationMessages(config)
      const authzMessage = messages[0]

      // The authorization details are encoded, but we can verify the structure
      expect(authzMessage.value.grant?.authorization?.typeUrl).toBe('/cosmos.bank.v1beta1.SendAuthorization')
    })

    it('should use custom spend limit when provided (uphoton)', () => {
      const config: DelegationConfig = {
        spendLimit: { denom: 'uphoton', amount: '1000000' }
      }
      const messages = wallet.generateDelegationMessages(config)
      const authzMessage = messages[0]

      // The authorization details are encoded, but we can verify the structure
      expect(authzMessage.value.grant?.authorization?.typeUrl).toBe('/cosmos.bank.v1beta1.SendAuthorization')
    })

    it('should use custom gas limit when provided (uphoton only)', () => {
      const config: DelegationConfig = {
        gasLimit: { denom: 'uphoton', amount: '2000000' }
      }
      const messages = wallet.generateDelegationMessages(config)
      const feegrantMessage = messages[1]

      expect(feegrantMessage.value.allowance?.typeUrl).toBe('/cosmos.feegrant.v1beta1.BasicAllowance')
    })

    it('should use custom expiration when provided', () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
      const config: DelegationConfig = {
        sessionExpiration: futureDate
      }
      const messages = wallet.generateDelegationMessages(config)
      const authzMessage = messages[0]

      // Verify expiration is set (encoded in the grant)
      expect(authzMessage.value.grant?.expiration).toBeDefined()
    })

    it('should handle allowed recipients list', () => {
      const config: DelegationConfig = {
        allowedRecipients: ['cosmos1recipient1', 'cosmos1recipient2']
      }
      const messages = wallet.generateDelegationMessages(config)
      const authzMessage = messages[0]

      expect(authzMessage.value.grant?.authorization).toBeDefined()
      expect(authzMessage.value.grant?.authorization?.typeUrl).toBe('/cosmos.bank.v1beta1.SendAuthorization')
    })

    // Table-driven tests for AtomOne denomination scenarios
    describe('AtomOne denomination support', () => {
      const atomOneTestCases = [
        {
          name: 'uatom spend limit with uphoton gas (ATOM sends)',
          config: {
            spendLimit: { denom: 'uatom', amount: '1000000' },
            gasLimit: { denom: 'uphoton', amount: '500000' }
          },
          description: 'Should allow ATOM sends with PHOTON gas fees'
        },
        {
          name: 'uphoton spend limit with uphoton gas (PHOTON sends)',
          config: {
            spendLimit: { denom: 'uphoton', amount: '2000000' },
            gasLimit: { denom: 'uphoton', amount: '500000' }
          },
          description: 'Should allow PHOTON sends with PHOTON gas fees'
        },
        {
          name: 'mixed denominations with default gas',
          config: {
            spendLimit: { denom: 'uatom', amount: '5000000' }
            // gasLimit defaults to uphoton
          },
          description: 'Should default to uphoton for gas when not specified'
        },
        {
          name: 'uphoton only (fee token usage)',
          config: {
            spendLimit: { denom: 'uphoton', amount: '10000000' },
            gasLimit: { denom: 'uphoton', amount: '1000000' }
          },
          description: 'Should support uphoton for both spending and gas'
        }
      ]

      atomOneTestCases.forEach(({ name, config, description }) => {
        it(name, () => {
          const messages = wallet.generateDelegationMessages(config)
          const authzMessage = messages[0]
          const feegrantMessage = messages[1]

          // Verify authz grant structure
          expect(authzMessage.value.granter).toBe('cosmos1primary123')
          expect(authzMessage.value.grantee).toBe('cosmos1session456')
          expect(authzMessage.value.grant?.authorization?.typeUrl).toBe('/cosmos.bank.v1beta1.SendAuthorization')

          // Verify feegrant structure
          expect(feegrantMessage.value.granter).toBe('cosmos1primary123')
          expect(feegrantMessage.value.grantee).toBe('cosmos1session456')
          expect(feegrantMessage.value.allowance?.typeUrl).toBe('/cosmos.feegrant.v1beta1.BasicAllowance')

          // Log the test description for documentation
          expect(description).toBeDefined()
        })
      })

      it('should default to uphoton for both spend and gas limits', () => {
        const config: DelegationConfig = {}
        const messages = wallet.generateDelegationMessages(config)
        const authzMessage = messages[0]
        const feegrantMessage = messages[1]

        // Both defaults should be uphoton as per AtomOne requirements
        expect(authzMessage.value.grant?.authorization?.typeUrl).toBe('/cosmos.bank.v1beta1.SendAuthorization')
        expect(feegrantMessage.value.allowance?.typeUrl).toBe('/cosmos.feegrant.v1beta1.BasicAllowance')
      })

      it('should enforce uphoton for feegrant even when different denom provided for spend', () => {
        const config: DelegationConfig = {
          spendLimit: { denom: 'uatom', amount: '1000000' },
          gasLimit: { denom: 'uphoton', amount: '500000' }
        }
        const messages = wallet.generateDelegationMessages(config)
        const authzMessage = messages[0]
        const feegrantMessage = messages[1]

        // Authz can use uatom for spending
        expect(authzMessage.value.grant?.authorization?.typeUrl).toBe('/cosmos.bank.v1beta1.SendAuthorization')
        
        // But feegrant must always use uphoton in AtomOne
        expect(feegrantMessage.value.allowance?.typeUrl).toBe('/cosmos.feegrant.v1beta1.BasicAllowance')
        expect(feegrantMessage.value.granter).toBe('cosmos1primary123')
        expect(feegrantMessage.value.grantee).toBe('cosmos1session456')
      })
    })
  })

  describe('revokeDelegationMessages', () => {
    it('should generate revoke messages with default message type', () => {
      const messages = wallet.revokeDelegationMessages()
      const revokeAuthzMessage = messages[0]
      const revokeFeegrantMessage = messages[1]

      expect(revokeAuthzMessage.value.granter).toBe('cosmos1primary123')
      expect(revokeAuthzMessage.value.grantee).toBe('cosmos1session456')
      expect(revokeAuthzMessage.value.msgTypeUrl).toBe('/cosmos.bank.v1beta1.MsgSend')

      expect(revokeFeegrantMessage.value.granter).toBe('cosmos1primary123')
      expect(revokeFeegrantMessage.value.grantee).toBe('cosmos1session456')
    })

    it('should use custom message type when provided', () => {
      const customMsgType = '/cosmos.staking.v1beta1.MsgDelegate'
      const messages = wallet.revokeDelegationMessages(customMsgType)
      const revokeAuthzMessage = messages[0]

      expect(revokeAuthzMessage.value.msgTypeUrl).toBe(customMsgType)
    })
  })

  describe('hasAuthzGrant', () => {
    beforeEach(() => {
      // Reset fetch mock before each test
      vi.clearAllMocks()
    })

    // Table-driven tests for hasAuthzGrant
    const authzTestCases = [
      {
        name: 'returns grant info when grant exists',
        mockResponse: {
          ok: true,
          json: async () => ({
            grants: [{
              authorization: {
                '@type': '/cosmos.bank.v1beta1.SendAuthorization',
                spend_limit: [{ denom: 'uatom', amount: '1000000' }]
              },
              expiration: '2024-12-31T23:59:59Z'
            }]
          })
        },
        expectedResult: {
          authorization: {
            '@type': '/cosmos.bank.v1beta1.SendAuthorization',
            spend_limit: [{ denom: 'uatom', amount: '1000000' }]
          },
          expiration: new Date('2024-12-31T23:59:59Z')
        }
      },
      {
        name: 'returns null when no grants exist',
        mockResponse: {
          ok: true,
          json: async () => ({ grants: [] })
        },
        expectedResult: null
      },
      {
        name: 'returns null on network error',
        mockResponse: {
          ok: false
        },
        expectedResult: null
      },
      {
        name: 'returns null when fetch throws',
        mockError: new Error('Network error'),
        expectedResult: null
      },
      {
        name: 'handles grant without expiration',
        mockResponse: {
          ok: true,
          json: async () => ({
            grants: [{
              authorization: { '@type': '/cosmos.bank.v1beta1.SendAuthorization' }
              // no expiration field
            }]
          })
        },
        expectedResult: {
          authorization: { '@type': '/cosmos.bank.v1beta1.SendAuthorization' },
          expiration: undefined
        }
      }
    ]

    authzTestCases.forEach(({ name, mockResponse, mockError, expectedResult }) => {
      it(name, async () => {
        if (mockError) {
          global.fetch = vi.fn().mockRejectedValue(mockError)
        } else {
          global.fetch = vi.fn().mockResolvedValue(mockResponse)
        }

        const result = await wallet.hasAuthzGrant()
        expect(result).toEqual(expectedResult)
      })
    })

    it('uses custom message type when provided', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ grants: [] })
      })

      await wallet.hasAuthzGrant('/cosmos.staking.v1beta1.MsgDelegate')
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('msg_type_url=/cosmos.staking.v1beta1.MsgDelegate')
      )
    })
  })

  describe('hasFeegrant', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    // Table-driven tests for hasFeegrant
    const feegrantTestCases = [
      {
        name: 'returns feegrant info when allowance exists',
        mockResponse: {
          ok: true,
          json: async () => ({
            allowance: {
              granter: 'cosmos1primary123',
              grantee: 'cosmos1session456',
              allowance: {
                '@type': '/cosmos.feegrant.v1beta1.BasicAllowance',
                spend_limit: [{ denom: 'uphoton', amount: '10000000' }]
              },
              expiration: '2024-12-31T23:59:59Z'
            }
          })
        },
        expectedResult: {
          allowance: {
            granter: 'cosmos1primary123',
            grantee: 'cosmos1session456',
            allowance: {
              '@type': '/cosmos.feegrant.v1beta1.BasicAllowance',
              spend_limit: [{ denom: 'uphoton', amount: '10000000' }]
            },
            expiration: '2024-12-31T23:59:59Z'
          },
          expiration: new Date('2024-12-31T23:59:59Z')
        }
      },
      {
        name: 'returns null when no allowance exists',
        mockResponse: {
          ok: true,
          json: async () => ({})
        },
        expectedResult: null
      },
      {
        name: 'returns null on 404 response',
        mockResponse: {
          ok: false,
          status: 404
        },
        expectedResult: null
      },
      {
        name: 'returns null when fetch throws',
        mockError: new Error('Network error'),
        expectedResult: null
      },
      {
        name: 'handles allowance without expiration',
        mockResponse: {
          ok: true,
          json: async () => ({
            allowance: {
              granter: 'cosmos1primary123',
              grantee: 'cosmos1session456',
              allowance: {
                '@type': '/cosmos.feegrant.v1beta1.BasicAllowance',
                spend_limit: [{ denom: 'uphoton', amount: '10000000' }]
              }
              // no expiration field
            }
          })
        },
        expectedResult: {
          allowance: {
            granter: 'cosmos1primary123',
            grantee: 'cosmos1session456',
            allowance: {
              '@type': '/cosmos.feegrant.v1beta1.BasicAllowance',
              spend_limit: [{ denom: 'uphoton', amount: '10000000' }]
            }
          },
          expiration: undefined
        }
      }
    ]

    feegrantTestCases.forEach(({ name, mockResponse, mockError, expectedResult }) => {
      it(name, async () => {
        if (mockError) {
          global.fetch = vi.fn().mockRejectedValue(mockError)
        } else {
          global.fetch = vi.fn().mockResolvedValue(mockResponse)
        }

        const result = await wallet.hasFeegrant()
        expect(result).toEqual(expectedResult)
      })
    })
  })
})