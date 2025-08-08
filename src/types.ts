import { OfflineSigner, DirectSecp256k1Wallet, EncodeObject } from '@cosmjs/proto-signing'
import { SigningStargateClient, GasPrice, DeliverTxResponse, StdFee } from '@cosmjs/stargate'
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { Logger } from './logger'

// Extended interface for SigningStargateClient with internal properties
// We use intersection type instead of extends to avoid private property conflicts
export interface SigningStargateClientWithSigner {
  readonly signer: OfflineSigner
  readonly gasPrice?: GasPrice | { denom: string; amount: string }
  readonly cometClient: {
    readonly client: {
      readonly url: string
    }
  }
}

// WebAuthn PRF Extension types
export interface PRFValues {
  first: ArrayBuffer
  second?: ArrayBuffer
}

export interface PRFExtensionResults {
  prf?: {
    results?: PRFValues
    enabled?: boolean
  }
}

export interface PublicKeyCredentialWithPRF extends PublicKeyCredential {
  getClientExtensionResults(): PRFExtensionResults
}

export interface PasskeyCredential {
  id: string
  publicKey: Uint8Array
  userId: string
}

export interface StintConfig {
  sessionExpiration?: Date
  spendLimit?: {
    denom: string
    amount: string
  }
  gasLimit?: {
    denom: string
    amount: string
  }
  allowedRecipients?: string[]
}

export interface SessionSignerConfig {
  primaryClient: SigningStargateClient
  saltName?: string
  stintWindowHours?: number // Time window in hours for key validity (default: 24, supports any duration)
  usePreviousWindow?: boolean // Use previous window instead of current (default: false)
  logger?: Logger
  keyMode?: 'passkey' | 'random' // Key generation mode (default: 'passkey')
}

export interface DelegationConfig {
  sessionExpiration?: Date
  spendLimit?: {
    denom: string
    amount: string
  }
  gasLimit?: {
    denom: string
    amount: string
  }
  allowedRecipients?: string[]
}

export interface AuthzGrantInfo {
  authorization: any
  expiration?: Date
}

export interface FeegrantInfo {
  allowance: any
  expiration?: Date
}

export interface ExecuteHelpers {
  /**
   * Send tokens using session signer with authz delegation
   * Automatically wraps in MsgExec and handles feegrant
   */
  send(params: {
    toAddress: string
    amount: Coin[]
    memo?: string
    fee?: StdFee | 'auto'
  }): Promise<DeliverTxResponse>

  /**
   * Execute custom messages with authz delegation
   * For advanced use cases with pre-encoded Any messages
   */
  custom(params: {
    messages: Any[]
    memo?: string
    fee?: StdFee | 'auto'
  }): Promise<DeliverTxResponse>
}

export interface SessionSigner {
  primarySigner: OfflineSigner
  sessionSigner: DirectSecp256k1Wallet
  client: SigningStargateClient

  // Methods - synchronous with cached addresses
  primaryAddress(): string
  sessionAddress(): string

  // Methods - asynchronous grant checking
  hasAuthzGrant(messageType?: string): Promise<AuthzGrantInfo | null>
  hasFeegrant(): Promise<FeegrantInfo | null>

  // Methods - message generation
  generateDelegationMessages(config: DelegationConfig): EncodeObject[]
  generateConditionalDelegationMessages(config: DelegationConfig): Promise<EncodeObject[]>
  revokeDelegationMessages(msgTypeUrl?: string): EncodeObject[]

  // Execute helpers for simplified authz transactions
  execute: ExecuteHelpers
}
