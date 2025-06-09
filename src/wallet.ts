import { SigningStargateClient, StargateClient, GasPrice } from '@cosmjs/stargate'
import { DirectSecp256k1Wallet, OfflineSigner } from '@cosmjs/proto-signing'
import { Secp256k1, sha256 } from '@cosmjs/crypto'
import { fromHex } from '@cosmjs/encoding'
import { StintWalletOptions } from './types'

export interface SessionWallet {
  mainWallet: OfflineSigner
  sessionWallet: DirectSecp256k1Wallet
  client: SigningStargateClient
  options: StintWalletOptions
}

export async function createSessionWallet(
  privateKeyHex: string,
  prefix: string = 'cosmos'
): Promise<DirectSecp256k1Wallet> {
  const privateKey = fromHex(privateKeyHex)
  return await DirectSecp256k1Wallet.fromKey(privateKey, prefix)
}

export async function initStintWallet(
  options: StintWalletOptions,
  sessionWallet: DirectSecp256k1Wallet
): Promise<SessionWallet> {
  const client = await SigningStargateClient.connectWithSigner(
    options.sessionConfig.rpcEndpoint,
    sessionWallet,
    {
      gasPrice: GasPrice.fromString(options.sessionConfig.gasPrice)
    }
  )

  return {
    mainWallet: options.mainWallet,
    sessionWallet,
    client,
    options
  }
}

export async function getSessionAddress(wallet: SessionWallet): Promise<string> {
  const accounts = await wallet.sessionWallet.getAccounts()
  return accounts[0].address
}

export async function getMainAddress(wallet: SessionWallet): Promise<string> {
  const accounts = await wallet.mainWallet.getAccounts()
  return accounts[0].address
}