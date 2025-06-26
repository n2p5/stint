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
}

export interface SessionWalletConfig {
  chainId: string
  rpcEndpoint: string
  gasPrice: string
  gasLimit?: string
  prefix?: string
}

export interface StintWalletOptions {
  primaryWallet: OfflineSigner
  sessionConfig: SessionWalletConfig
  authzExpiration?: Date
  gasBuffer?: number
}

export interface SessionWallet {
  primaryWallet: OfflineSigner
  sessionWallet: DirectSecp256k1Wallet
  client: SigningStargateClient
  
  // Methods - synchronous with cached addresses
  primaryAddress(): string
  sessionAddress(): string
}
