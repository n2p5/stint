import { OfflineSigner } from '@cosmjs/proto-signing'

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
  mainWallet: OfflineSigner
  sessionConfig: SessionWalletConfig
  authzExpiration?: Date
  gasBuffer?: number
}