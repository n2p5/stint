import { DeliverTxResponse, StdFee, isDeliverTxSuccess } from '@cosmjs/stargate'
import { EncodeObject } from '@cosmjs/proto-signing'
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { SessionSigner, ExecuteHelpers } from './types'
import { StintError, ErrorCodes } from './errors'
import { Logger } from './logger'

/**
 * Helper to wrap any message in MsgExec for authz delegation
 */
export function wrapInMsgExec(granteeAddress: string, messages: Any[]): EncodeObject {
  const execMsg: EncodeObject = {
    typeUrl: '/cosmos.authz.v1beta1.MsgExec',
    value: {
      grantee: granteeAddress,
      msgs: messages,
    },
  }

  return execMsg
}

/**
 * Create fee object with granter for feegrant usage
 */
export function createFeeWithGranter(
  granterAddress: string,
  fee?: StdFee | 'auto'
): StdFee | 'auto' {
  if (fee === 'auto') {
    return 'auto'
  }

  const defaultFee: StdFee = {
    amount: [{ denom: 'uphoton', amount: '5000' }],
    gas: '200000',
  }

  const feeWithGranter: StdFee = {
    ...defaultFee,
    ...fee,
    granter: granterAddress,
  }

  return feeWithGranter
}

/**
 * Send tokens using session signer with authz delegation
 */
export async function send(
  sessionSigner: SessionSigner,
  params: {
    toAddress: string
    amount: Coin[]
    memo?: string
    fee?: StdFee | 'auto'
  },
  logger: Logger
): Promise<DeliverTxResponse> {
  const { toAddress, amount, memo = '', fee } = params

  logger.info('Executing send with session signer', {
    toAddress,
    amount,
    memo: memo.slice(0, 50) + (memo.length > 50 ? '...' : ''),
  })

  // Validate inputs
  if (!toAddress) {
    throw new StintError('Invalid recipient address', ErrorCodes.INVALID_ADDRESS, {
      toAddress,
    })
  }

  if (!amount || amount.length === 0) {
    throw new StintError('Invalid amount', ErrorCodes.INVALID_AMOUNT, { amount })
  }

  try {
    // Create MsgSend with primary address as sender
    const msgSend = MsgSend.fromPartial({
      fromAddress: sessionSigner.primaryAddress(),
      toAddress,
      amount,
    })

    logger.debug('Created MsgSend', {
      fromAddress: sessionSigner.primaryAddress(),
      toAddress,
      amount,
    })

    // Encode to bytes
    const msgSendBytes = MsgSend.encode(msgSend).finish()

    // Wrap in Any type
    const msgSendAny = Any.fromPartial({
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: msgSendBytes,
    })

    // Wrap in MsgExec
    const execMsg = wrapInMsgExec(sessionSigner.sessionAddress(), [msgSendAny])

    // Create fee with granter
    const feeWithGranter = createFeeWithGranter(sessionSigner.primaryAddress(), fee)

    logger.debug('Broadcasting transaction...', {
      signer: sessionSigner.sessionAddress(),
      feeGranter: sessionSigner.primaryAddress(),
      fee: feeWithGranter,
    })

    // Sign and broadcast
    const result = await sessionSigner.client.signAndBroadcast(
      sessionSigner.sessionAddress(),
      [execMsg],
      feeWithGranter,
      memo
    )

    if (!isDeliverTxSuccess(result)) {
      const errorLog = (result as any).rawLog || 'Transaction failed'
      logger.error('Transaction failed on chain', undefined, {
        code: result.code,
        rawLog: errorLog,
      })
      throw new StintError(`Transaction failed: ${errorLog}`, ErrorCodes.INVALID_RESPONSE, {
        code: result.code,
        rawLog: errorLog,
      })
    }

    logger.info('Transaction successful', {
      transactionHash: result.transactionHash,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
      height: result.height,
    })

    return result
  } catch (error) {
    if (error instanceof StintError) {
      throw error
    }

    logger.error('Failed to execute send', error as Error)
    throw new StintError(
      'Failed to execute send transaction',
      ErrorCodes.CLIENT_INITIALIZATION_FAILED,
      { error: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Execute custom messages with authz delegation
 */
export async function custom(
  sessionSigner: SessionSigner,
  params: {
    messages: Any[]
    memo?: string
    fee?: StdFee | 'auto'
  },
  logger: Logger
): Promise<DeliverTxResponse> {
  const { messages, memo = '', fee } = params

  logger.info('Executing custom messages with session signer', {
    messageCount: messages.length,
    memo: memo.slice(0, 50) + (memo.length > 50 ? '...' : ''),
  })

  try {
    // Wrap all messages in MsgExec
    const execMsg = wrapInMsgExec(sessionSigner.sessionAddress(), messages)

    // Create fee with granter
    const feeWithGranter = createFeeWithGranter(sessionSigner.primaryAddress(), fee)

    logger.debug('Broadcasting custom transaction...', {
      signer: sessionSigner.sessionAddress(),
      feeGranter: sessionSigner.primaryAddress(),
      messageCount: messages.length,
    })

    // Sign and broadcast
    const result = await sessionSigner.client.signAndBroadcast(
      sessionSigner.sessionAddress(),
      [execMsg],
      feeWithGranter,
      memo
    )

    if (!isDeliverTxSuccess(result)) {
      const errorLog = (result as any).rawLog || 'Transaction failed'
      logger.error('Transaction failed on chain', undefined, {
        code: result.code,
        rawLog: errorLog,
      })
      throw new StintError(`Transaction failed: ${errorLog}`, ErrorCodes.INVALID_RESPONSE, {
        code: result.code,
        rawLog: errorLog,
      })
    }

    logger.info('Custom transaction successful', {
      transactionHash: result.transactionHash,
      gasUsed: result.gasUsed,
      gasWanted: result.gasWanted,
      height: result.height,
    })

    return result
  } catch (error) {
    if (error instanceof StintError) {
      throw error
    }

    logger.error('Failed to execute custom messages', error as Error)
    throw new StintError(
      'Failed to execute custom transaction',
      ErrorCodes.CLIENT_INITIALIZATION_FAILED,
      { error: error instanceof Error ? error.message : String(error) }
    )
  }
}

/**
 * Create execute helper methods for a SessionSigner
 * This abstracts away the complexity of MsgExec wrapping for authz delegation
 */
export function createExecuteHelpers(sessionSigner: SessionSigner, logger: Logger): ExecuteHelpers {
  return {
    send: (params) => send(sessionSigner, params, logger),
    custom: (params) => custom(sessionSigner, params, logger),
  }
}
