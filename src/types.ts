import { OfflineSigner, DirectSecp256k1Wallet, EncodeObject } from '@cosmjs/proto-signing'
import { SigningStargateClient, GasPrice } from '@cosmjs/stargate'
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
  first: ArrayBuffer | Uint8Array
  second?: ArrayBuffer | Uint8Array
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
  logger?: Logger
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
}
