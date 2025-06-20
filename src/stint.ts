import { StargateClient, SigningStargateClient } from '@cosmjs/stargate'
import { MsgGrant, MsgRevoke } from 'cosmjs-types/cosmos/authz/v1beta1/tx'
import { GenericAuthorization } from 'cosmjs-types/cosmos/authz/v1beta1/authz'
import { SendAuthorization } from 'cosmjs-types/cosmos/bank/v1beta1/authz'
import { MsgGrantAllowance, MsgRevokeAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/tx'
import { BasicAllowance, PeriodicAllowance, AllowedMsgAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant'
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { Timestamp } from 'cosmjs-types/google/protobuf/timestamp'
import { SessionWallet } from './wallet'
import { StintConfig } from './types'

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

// Create a basic fee allowance
export function createBasicAllowance(spendLimit?: Coin[], expiration?: Date): Any {
  const allowance = BasicAllowance.fromPartial({
    spendLimit,
    expiration: expiration ? dateToTimestamp(expiration) : undefined,
  })

  return Any.fromPartial({
    typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
    value: BasicAllowance.encode(allowance).finish(),
  })
}

// Create a feegrant message
export function createFeegrantMsg(
  granter: string,
  grantee: string,
  allowance: Any
): MsgGrantAllowance {
  return {
    granter,
    grantee,
    allowance,
  }
}

// Create combined stint setup (authz + feegrant)
export async function createStintSetup(
  wallet: SessionWallet,
  config: {
    sessionExpiration?: Date
    spendLimit?: { denom: string; amount: string }
    gasLimit?: { denom: string; amount: string }
  }
): Promise<{
  authzGrant: MsgGrant
  feegrant: MsgGrantAllowance
}> {
  const mainAddress = await wallet.mainWallet.getAccounts().then(accounts => accounts[0].address)
  const sessionAddress = await wallet.sessionWallet.getAccounts().then(accounts => accounts[0].address)

  // Main wallet grants session wallet limited send authorization
  const spendLimitCoins: Coin[] = config.spendLimit
    ? [Coin.fromPartial({ denom: config.spendLimit.denom, amount: config.spendLimit.amount })]
    : [Coin.fromPartial({ denom: 'uphoton', amount: '1000000' })] // Default 1 PHOTON limit
  
  const sendAuth = createSendAuthorization(spendLimitCoins)
  const authzGrant = createAuthzGrantMsg(
    mainAddress,
    sessionAddress,
    sendAuth,
    config.sessionExpiration
  )

  // Main wallet grants session wallet fee allowance
  const gasLimitCoins: Coin[] = config.gasLimit
    ? [Coin.fromPartial({ denom: config.gasLimit.denom, amount: config.gasLimit.amount })]
    : [Coin.fromPartial({ denom: 'uphoton', amount: '1000000' })] // Default 1 UPHOTON for gas
  
  const feeAllowance = createBasicAllowance(gasLimitCoins, config.sessionExpiration)
  const feegrant = createFeegrantMsg(
    mainAddress,
    sessionAddress,
    feeAllowance
  )

  return {
    authzGrant,
    feegrant,
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

// Create a feegrant revoke message
export function createFeegrantRevokeMsg(
  granter: string,
  grantee: string
): MsgRevokeAllowance {
  return {
    granter,
    grantee,
  }
}

// Helper to revoke all stint grants (authz + feegrant)
export async function revokeStint(
  wallet: SessionWallet,
  msgTypeUrl: string = '/cosmos.bank.v1beta1.MsgSend'
): Promise<{
  revokeAuthz: MsgRevoke
  revokeFeegrant: MsgRevokeAllowance
}> {
  const mainAddress = await wallet.mainWallet.getAccounts().then(accounts => accounts[0].address)
  const sessionAddress = await wallet.sessionWallet.getAccounts().then(accounts => accounts[0].address)

  return {
    revokeAuthz: createRevokeMsg(mainAddress, sessionAddress, msgTypeUrl),
    revokeFeegrant: createFeegrantRevokeMsg(mainAddress, sessionAddress),
  }
}