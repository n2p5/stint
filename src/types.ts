import { OfflineSigner, DirectSecp256k1Wallet } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'

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

export interface SessionWalletConfig {
  primaryClient: SigningStargateClient
  saltName?: string
}

export interface AuthzGrantInfo {
  authorization: any
  expiration?: Date
}

export interface FeegrantInfo {
  allowance: any
  expiration?: Date
}

export interface SessionWallet {
  primaryWallet: OfflineSigner
  sessionWallet: DirectSecp256k1Wallet
  client: SigningStargateClient
  
  // Methods - synchronous with cached addresses
  primaryAddress(): string
  sessionAddress(): string
  
  // Methods - asynchronous grant checking
  hasAuthzGrant(messageType?: string): Promise<AuthzGrantInfo | null>
  hasFeegrant(): Promise<FeegrantInfo | null>
}
