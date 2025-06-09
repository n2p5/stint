import { StargateClient, SigningStargateClient } from '@cosmjs/stargate'
import { MsgGrant, MsgRevoke } from 'cosmjs-types/cosmos/authz/v1beta1/tx'
import { GenericAuthorization } from 'cosmjs-types/cosmos/authz/v1beta1/authz'
import { SendAuthorization } from 'cosmjs-types/cosmos/bank/v1beta1/authz'
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { Timestamp } from 'cosmjs-types/google/protobuf/timestamp'
import { SessionWallet } from './wallet'
import { AuthzConfig } from './types'

// Create a send authorization
export function createSendAuthorization(spendLimit?: Coin[]): Any {
  const authorizationData: any = {}
  
  // Only set spendLimit if it's provided and not empty
  if (spendLimit && spendLimit.length > 0) {
    authorizationData.spendLimit = spendLimit
  }
  
  const authorization = SendAuthorization.fromPartial(authorizationData)

  return Any.fromPartial({
    typeUrl: '/cosmos.bank.v1beta1.SendAuthorization',
    value: SendAuthorization.encode(authorization).finish(),
  })
}

// Create a generic authorization for any message type
export function createGenericAuthorization(msgTypeUrl: string): Any {
  const authorization = GenericAuthorization.fromPartial({
    msg: msgTypeUrl,
  })

  return Any.fromPartial({
    typeUrl: '/cosmos.authz.v1beta1.GenericAuthorization',
    value: GenericAuthorization.encode(authorization).finish(),
  })
}

// Convert Date to protobuf Timestamp
function dateToTimestamp(date: Date): Timestamp {
  const seconds = Math.floor(date.getTime() / 1000)
  const nanos = (date.getTime() % 1000) * 1000000
  return Timestamp.fromPartial({ seconds: BigInt(seconds), nanos })
}

// Create an authz grant message
export function createAuthzGrantMsg(
  granter: string,
  grantee: string,
  authorization: Any,
  expiration?: Date
): MsgGrant {
  const expirationDate = expiration || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24 hours
  
  return {
    granter,
    grantee,
    grant: {
      authorization,
      expiration: dateToTimestamp(expirationDate),
    },
  }
}

// Create bidirectional authz setup
export async function createBidirectionalAuthz(
  wallet: SessionWallet,
  config: {
    sessionExpiration?: Date
    spendLimit?: { denom: string; amount: string }
  }
): Promise<{
  sessionToMainGrant: MsgGrant
  mainToSessionGrant: MsgGrant
  gasAmount: Coin
}> {
  const mainAddress = await wallet.mainWallet.getAccounts().then(accounts => accounts[0].address)
  const sessionAddress = await wallet.sessionWallet.getAccounts().then(accounts => accounts[0].address)

  // Session wallet grants main wallet unlimited send authorization (for recovery)
  // Use GenericAuthorization for unlimited access
  const sessionToMainAuth = createGenericAuthorization('/cosmos.bank.v1beta1.MsgSend')
  const sessionToMainGrant = createAuthzGrantMsg(
    sessionAddress,
    mainAddress,
    sessionToMainAuth
  )

  // Main wallet grants session wallet limited send authorization
  const spendLimitCoins: Coin[] = config.spendLimit
    ? [Coin.fromPartial({ denom: config.spendLimit.denom, amount: config.spendLimit.amount })]
    : [Coin.fromPartial({ denom: 'uatone', amount: '1000000' })] // Default 1 ATONE limit
  const mainToSessionAuth = createSendAuthorization(spendLimitCoins)
  const mainToSessionGrant = createAuthzGrantMsg(
    mainAddress,
    sessionAddress,
    mainToSessionAuth,
    config.sessionExpiration
  )

  // Calculate gas amount to send to session wallet
  const gasAmount: Coin = Coin.fromPartial({
    denom: 'uatone',
    amount: '1000000', // Default 1 ATONE for gas
  })

  return {
    sessionToMainGrant,
    mainToSessionGrant,
    gasAmount,
  }
}

// Revoke an authz grant
export function createRevokeMsg(
  granter: string,
  grantee: string,
  msgTypeUrl: string
): MsgRevoke {
  return {
    granter,
    grantee,
    msgTypeUrl,
  }
}

// Helper to revoke all stint session authorizations
export async function revokeAuthz(
  wallet: SessionWallet,
  msgTypeUrl: string = '/cosmos.bank.v1beta1.MsgSend'
): Promise<{
  revokeSessionToMain: MsgRevoke
  revokeMainToSession: MsgRevoke
}> {
  const mainAddress = await wallet.mainWallet.getAccounts().then(accounts => accounts[0].address)
  const sessionAddress = await wallet.sessionWallet.getAccounts().then(accounts => accounts[0].address)

  return {
    revokeSessionToMain: createRevokeMsg(sessionAddress, mainAddress, msgTypeUrl),
    revokeMainToSession: createRevokeMsg(mainAddress, sessionAddress, msgTypeUrl),
  }
}