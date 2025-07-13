import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DeliverTxResponse, StdFee } from '@cosmjs/stargate'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { wrapInMsgExec, createFeeWithGranter, send, custom, createExecuteHelpers } from './execute'
import { SessionSigner } from './types'
import { ErrorCodes } from './errors'
import { Logger } from './logger'

// Mock logger for testing
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Mock session signer
const mockSessionSigner: SessionSigner = {
  primarySigner: {} as any,
  sessionSigner: {} as any,
  client: {
    signAndBroadcast: vi.fn(),
  } as any,
  primaryAddress: () => 'atone1primaryaddr123',
  sessionAddress: () => 'atone1sessionaddr456',
  hasAuthzGrant: vi.fn(),
  hasFeegrant: vi.fn(),
  generateDelegationMessages: vi.fn(),
  generateConditionalDelegationMessages: vi.fn(),
  revokeDelegationMessages: vi.fn(),
  execute: {} as any,
}

describe('execute helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('wrapInMsgExec', () => {
    it('should wrap messages in MsgExec with correct grantee', () => {
      const granteeAddress = 'atone1grantee123'
      const mockMessage = Any.fromPartial({
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: new Uint8Array([1, 2, 3]),
      })

      const result = wrapInMsgExec(granteeAddress, [mockMessage])

      expect(result.typeUrl).toBe('/cosmos.authz.v1beta1.MsgExec')
      expect(result.value.grantee).toBe(granteeAddress)
      expect(result.value.msgs).toEqual([mockMessage])
    })

    it('should handle multiple messages', () => {
      const granteeAddress = 'atone1grantee123'
      const message1 = Any.fromPartial({
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: new Uint8Array([1]),
      })
      const message2 = Any.fromPartial({
        typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
        value: new Uint8Array([2]),
      })

      const result = wrapInMsgExec(granteeAddress, [message1, message2])

      expect(result.value.msgs).toHaveLength(2)
      expect(result.value.msgs).toEqual([message1, message2])
    })

    it('should handle empty message array', () => {
      const granteeAddress = 'atone1grantee123'

      const result = wrapInMsgExec(granteeAddress, [])

      expect(result.value.msgs).toEqual([])
    })
  })

  describe('createFeeWithGranter', () => {
    const granterAddress = 'atone1granter123'

    it('should return "auto" when fee is "auto"', () => {
      const result = createFeeWithGranter(granterAddress, 'auto')
      expect(result).toBe('auto')
    })

    it('should use default fee when no fee provided', () => {
      const result = createFeeWithGranter(granterAddress)

      expect(result).toEqual({
        amount: [{ denom: 'uphoton', amount: '5000' }],
        gas: '200000',
        granter: granterAddress,
      })
    })

    it('should merge custom fee with granter', () => {
      const customFee: StdFee = {
        amount: [{ denom: 'uatom', amount: '10000' }],
        gas: '300000',
      }

      const result = createFeeWithGranter(granterAddress, customFee)

      expect(result).toEqual({
        amount: [{ denom: 'uatom', amount: '10000' }],
        gas: '300000',
        granter: granterAddress,
      })
    })

    it('should override granter even if provided in custom fee', () => {
      const customFee: StdFee = {
        amount: [{ denom: 'uphoton', amount: '8000' }],
        gas: '250000',
        granter: 'atone1wronggranter', // This should be overridden
      }

      const result = createFeeWithGranter(granterAddress, customFee)

      expect(result).toEqual({
        amount: [{ denom: 'uphoton', amount: '8000' }],
        gas: '250000',
        granter: granterAddress, // Should use provided granter
      })
    })

    it('should merge partial fee with defaults', () => {
      const partialFee: Partial<StdFee> = {
        gas: '400000',
      }

      const result = createFeeWithGranter(granterAddress, partialFee as StdFee)

      expect(result).toEqual({
        amount: [{ denom: 'uphoton', amount: '5000' }], // Default
        gas: '400000', // Custom
        granter: granterAddress,
      })
    })
  })

  describe('send', () => {
    const mockTxResponse: DeliverTxResponse = {
      code: 0,
      height: 12345,
      txIndex: 0,
      transactionHash: 'ABCD1234',
      gasUsed: 180000n,
      gasWanted: 200000n,
      events: [],
      msgResponses: [],
    }

    beforeEach(() => {
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockResolvedValue(mockTxResponse)
    })

    it('should send tokens successfully', async () => {
      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
        memo: 'Test transfer',
      }

      const result = await send(mockSessionSigner, params, mockLogger)

      expect(result).toEqual(mockTxResponse)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing send with session signer',
        expect.objectContaining({
          toAddress: params.toAddress,
          amount: params.amount,
          memo: params.memo,
        })
      )
      expect(mockSessionSigner.client.signAndBroadcast).toHaveBeenCalledTimes(1)
    })

    it('should create MsgSend with primary address as sender', async () => {
      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
      }

      await send(mockSessionSigner, params, mockLogger)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Created MsgSend',
        expect.objectContaining({
          fromAddress: 'atone1primaryaddr123',
          toAddress: params.toAddress,
          amount: params.amount,
        })
      )
    })

    it('should use custom fee when provided', async () => {
      const customFee: StdFee = {
        amount: [{ denom: 'uphoton', amount: '8000' }],
        gas: '300000',
      }
      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
        fee: customFee,
      }

      await send(mockSessionSigner, params, mockLogger)

      expect(mockSessionSigner.client.signAndBroadcast).toHaveBeenCalledWith(
        'atone1sessionaddr456',
        expect.any(Array),
        expect.objectContaining({
          amount: [{ denom: 'uphoton', amount: '8000' }],
          gas: '300000',
          granter: 'atone1primaryaddr123',
        }),
        ''
      )
    })

    it('should handle auto fee', async () => {
      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
        fee: 'auto' as const,
      }

      await send(mockSessionSigner, params, mockLogger)

      expect(mockSessionSigner.client.signAndBroadcast).toHaveBeenCalledWith(
        'atone1sessionaddr456',
        expect.any(Array),
        'auto',
        ''
      )
    })

    it('should throw error for invalid recipient address', async () => {
      const params = {
        toAddress: '',
        amount: [{ denom: 'uphoton', amount: '1000' }],
      }

      await expect(send(mockSessionSigner, params, mockLogger)).rejects.toThrow(
        expect.objectContaining({
          message: 'Invalid recipient address',
          code: ErrorCodes.INVALID_ADDRESS,
        })
      )
    })

    it('should throw error for invalid amount', async () => {
      const params = {
        toAddress: 'atone1recipient123',
        amount: [],
      }

      await expect(send(mockSessionSigner, params, mockLogger)).rejects.toThrow(
        expect.objectContaining({
          message: 'Invalid amount',
          code: ErrorCodes.INVALID_AMOUNT,
        })
      )
    })

    it('should handle transaction failure', async () => {
      const failedTxResponse = {
        ...mockTxResponse,
        code: 5,
        rawLog: 'insufficient funds',
      }
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockResolvedValue(failedTxResponse)

      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
      }

      await expect(send(mockSessionSigner, params, mockLogger)).rejects.toThrow(
        expect.objectContaining({
          message: 'Transaction failed: insufficient funds',
          code: ErrorCodes.INVALID_RESPONSE,
        })
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Transaction failed on chain',
        undefined,
        expect.objectContaining({
          code: 5,
          rawLog: 'insufficient funds',
        })
      )
    })

    it('should handle signAndBroadcast throwing error', async () => {
      const error = new Error('Network error')
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockRejectedValue(error)

      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
      }

      await expect(send(mockSessionSigner, params, mockLogger)).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to execute send transaction',
          code: ErrorCodes.CLIENT_INITIALIZATION_FAILED,
        })
      )

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute send', error)
    })

    it('should truncate long memos in logging', async () => {
      const longMemo = 'x'.repeat(100)
      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
        memo: longMemo,
      }

      await send(mockSessionSigner, params, mockLogger)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing send with session signer',
        expect.objectContaining({
          memo: 'x'.repeat(50) + '...',
        })
      )
    })
  })

  describe('custom', () => {
    const mockTxResponse: DeliverTxResponse = {
      code: 0,
      height: 12345,
      txIndex: 0,
      transactionHash: 'ABCD1234',
      gasUsed: 180000n,
      gasWanted: 200000n,
      events: [],
      msgResponses: [],
    }

    beforeEach(() => {
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockResolvedValue(mockTxResponse)
    })

    it('should execute custom messages successfully', async () => {
      const customMessages = [
        Any.fromPartial({
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: new Uint8Array([1, 2, 3]),
        }),
      ]
      const params = {
        messages: customMessages,
        memo: 'Custom transaction',
      }

      const result = await custom(mockSessionSigner, params, mockLogger)

      expect(result).toEqual(mockTxResponse)
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Executing custom messages with session signer',
        expect.objectContaining({
          messageCount: 1,
          memo: 'Custom transaction',
        })
      )
    })

    it('should handle multiple custom messages', async () => {
      const customMessages = [
        Any.fromPartial({
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: new Uint8Array([1]),
        }),
        Any.fromPartial({
          typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
          value: new Uint8Array([2]),
        }),
      ]
      const params = {
        messages: customMessages,
      }

      await custom(mockSessionSigner, params, mockLogger)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Broadcasting custom transaction...',
        expect.objectContaining({
          messageCount: 2,
        })
      )
    })

    it('should handle transaction failure', async () => {
      const failedTxResponse = {
        ...mockTxResponse,
        code: 3,
        rawLog: 'invalid message',
      }
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockResolvedValue(failedTxResponse)

      const params = {
        messages: [
          Any.fromPartial({
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: new Uint8Array([1]),
          }),
        ],
      }

      await expect(custom(mockSessionSigner, params, mockLogger)).rejects.toThrow(
        expect.objectContaining({
          message: 'Transaction failed: invalid message',
          code: ErrorCodes.INVALID_RESPONSE,
        })
      )
    })

    it('should use default empty memo when not provided', async () => {
      const params = {
        messages: [
          Any.fromPartial({
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: new Uint8Array([1]),
          }),
        ],
      }

      await custom(mockSessionSigner, params, mockLogger)

      expect(mockSessionSigner.client.signAndBroadcast).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.any(Object),
        '' // Empty memo
      )
    })

    it('should handle generic error during signAndBroadcast', async () => {
      const error = new Error('Network connection failed')
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockRejectedValue(error)

      const params = {
        messages: [
          Any.fromPartial({
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: new Uint8Array([1]),
          }),
        ],
      }

      await expect(custom(mockSessionSigner, params, mockLogger)).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to execute custom transaction',
          code: ErrorCodes.CLIENT_INITIALIZATION_FAILED,
        })
      )

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to execute custom messages', error)
    })

    it('should handle non-Error thrown during execution', async () => {
      const errorString = 'String error message'
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockRejectedValue(errorString)

      const params = {
        messages: [
          Any.fromPartial({
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: new Uint8Array([1]),
          }),
        ],
      }

      await expect(custom(mockSessionSigner, params, mockLogger)).rejects.toThrow(
        expect.objectContaining({
          message: 'Failed to execute custom transaction',
          code: ErrorCodes.CLIENT_INITIALIZATION_FAILED,
          details: expect.objectContaining({
            error: 'String error message',
          }),
        })
      )

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to execute custom messages',
        errorString
      )
    })
  })

  describe('createExecuteHelpers', () => {
    it('should create execute helpers that bind sessionSigner and logger', async () => {
      const helpers = createExecuteHelpers(mockSessionSigner, mockLogger)

      expect(helpers).toHaveProperty('send')
      expect(helpers).toHaveProperty('custom')
      expect(typeof helpers.send).toBe('function')
      expect(typeof helpers.custom).toBe('function')
    })

    it('should bind send function correctly', async () => {
      const helpers = createExecuteHelpers(mockSessionSigner, mockLogger)
      const mockTxResponse: DeliverTxResponse = {
        code: 0,
        height: 12345,
        txIndex: 0,
        transactionHash: 'ABCD1234',
        gasUsed: 180000n,
        gasWanted: 200000n,
        events: [],
        msgResponses: [],
      }
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockResolvedValue(mockTxResponse)

      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
      }

      const result = await helpers.send(params)

      expect(result).toEqual(mockTxResponse)
      expect(mockSessionSigner.client.signAndBroadcast).toHaveBeenCalled()
    })

    it('should bind custom function correctly', async () => {
      const helpers = createExecuteHelpers(mockSessionSigner, mockLogger)
      const mockTxResponse: DeliverTxResponse = {
        code: 0,
        height: 12345,
        txIndex: 0,
        transactionHash: 'ABCD1234',
        gasUsed: 180000n,
        gasWanted: 200000n,
        events: [],
        msgResponses: [],
      }
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockResolvedValue(mockTxResponse)

      const params = {
        messages: [
          Any.fromPartial({
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: new Uint8Array([1]),
          }),
        ],
      }

      const result = await helpers.custom(params)

      expect(result).toEqual(mockTxResponse)
      expect(mockSessionSigner.client.signAndBroadcast).toHaveBeenCalled()
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle MsgSend encoding correctly', async () => {
      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
      }

      // Mock the protobuf encoding
      const mockMsgSend = {
        fromAddress: 'atone1primaryaddr123',
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
      }

      // Verify that MsgSend.fromPartial would be called with correct parameters
      const spy = vi.spyOn(MsgSend, 'fromPartial')
      spy.mockReturnValue(mockMsgSend as any)

      await send(mockSessionSigner, params, mockLogger)

      expect(spy).toHaveBeenCalledWith({
        fromAddress: 'atone1primaryaddr123',
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
      })

      spy.mockRestore()
    })

    it('should handle undefined amount gracefully', async () => {
      const params = {
        toAddress: 'atone1recipient123',
        amount: undefined as any,
      }

      await expect(send(mockSessionSigner, params, mockLogger)).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCodes.INVALID_AMOUNT,
        })
      )
    })

    it('should handle rawLog fallback when undefined', async () => {
      const failedTxResponse: DeliverTxResponse = {
        code: 5,
        height: 12345,
        txIndex: 0,
        transactionHash: 'ABCD1234',
        gasUsed: 180000n,
        gasWanted: 200000n,
        events: [],
        msgResponses: [],
        // rawLog is undefined
      }
      vi.mocked(mockSessionSigner.client.signAndBroadcast).mockResolvedValue(failedTxResponse)

      const params = {
        toAddress: 'atone1recipient123',
        amount: [{ denom: 'uphoton', amount: '1000' }],
      }

      await expect(send(mockSessionSigner, params, mockLogger)).rejects.toThrow(
        'Transaction failed: Transaction failed'
      )
    })
  })
})
