import { SigningStargateClient } from '@cosmjs/stargate'
import { DirectSecp256k1Wallet, OfflineSigner, EncodeObject } from '@cosmjs/proto-signing'
import { fromHex } from '@cosmjs/encoding'
import { SendAuthorization } from 'cosmjs-types/cosmos/bank/v1beta1/authz'
import { BasicAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant'
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import { Any } from 'cosmjs-types/google/protobuf/any'
import { Timestamp } from 'cosmjs-types/google/protobuf/timestamp'
import { SessionWallet, SessionWalletConfig, AuthzGrantInfo, FeegrantInfo, DelegationConfig } from './types'
import { getOrCreatePasskeyWallet } from './passkey'

// ============================================================================
// SESSION WALLET CREATION
// ============================================================================

/**
 * Create a complete session wallet in one step
 * Combines passkey creation, wallet derivation, and chain connection
 * @param config - Configuration with primary client and optional salt name
 * @returns Initialized SessionWallet ready for use
 */
export async function newSessionWallet(config: SessionWalletConfig): Promise<SessionWallet> {
  // Extract the signer from the client and get accounts
  const primaryWallet = (config.primaryClient as any).signer as OfflineSigner
  if (!primaryWallet) {
    throw new Error('Could not extract signer from primary client')
  }

  const primaryAccounts = await primaryWallet.getAccounts()
  const primaryAddress = primaryAccounts[0].address

  // Extract prefix from primary address (e.g., 'atone' from 'atone1...')
  const prefix = primaryAddress.match(/^([a-z]+)1/)?.[1] || 'atom'

  // Get or create passkey wallet for this primary address
  const passkeyWallet = await getOrCreatePasskeyWallet({
    walletAddress: primaryAddress,
    displayName: `Stint: ${primaryAddress.slice(0, 10)}...`,
    saltName: config.saltName || 'stint-wallet',
  })

  // Create the session wallet from the derived private key with same prefix as primary
  const privateKey = fromHex(passkeyWallet.privateKey)
  const sessionWallet = await DirectSecp256k1Wallet.fromKey(privateKey, prefix)

  // Get the session wallet address
  const sessionAccounts = await sessionWallet.getAccounts()
  const sessionAddress = sessionAccounts[0].address

  // Extract RPC URL from the primary client's cometClient
  const rpcUrl = (config.primaryClient as any).cometClient.client.url
  if (!rpcUrl) {
    throw new Error('Could not extract RPC URL from primary client')
  }

  // Create a new client for the session wallet using the same RPC endpoint as primary
  const client = await SigningStargateClient.connectWithSigner(rpcUrl, sessionWallet, {
    gasPrice: (config.primaryClient as any).gasPrice,
  })

  const wallet: SessionWallet = {
    primaryWallet,
    sessionWallet,
    client,

    // Methods - now synchronous with cached addresses
    primaryAddress: (): string => {
      return primaryAddress
    },

    sessionAddress: (): string => {
      return sessionAddress
    },

    // Methods - created by factory functions
    hasAuthzGrant: createHasAuthzGrant(config.primaryClient, primaryAddress, sessionAddress),
    hasFeegrant: createHasFeegrant(config.primaryClient, primaryAddress, sessionAddress),
    
    // Methods - message generation (implemented inline)
    generateDelegationMessages: (config: DelegationConfig) => generateDelegationMessagesFn(primaryAddress, sessionAddress, config),
    revokeDelegationMessages: (msgTypeUrl?: string) => revokeDelegationMessagesFn(primaryAddress, sessionAddress, msgTypeUrl),
  }

  return wallet
}

// ============================================================================
// GRANT CHECKING FACTORY FUNCTIONS
// ============================================================================

// Type aliases for clarity
type HasAuthzGrantFn = (messageType?: string) => Promise<AuthzGrantInfo | null>
type HasFeegrantFn = () => Promise<FeegrantInfo | null>

// Factory function for hasAuthzGrant method
function createHasAuthzGrant(
  primaryClient: SigningStargateClient,
  primaryAddress: string,
  sessionAddress: string
): HasAuthzGrantFn {
  return async (
    messageType: string = '/cosmos.bank.v1beta1.MsgSend'
  ): Promise<AuthzGrantInfo | null> => {
    try {
      const rpcUrl = (primaryClient as any).cometClient?.client?.url
      if (!rpcUrl) {
        console.warn('Could not extract RPC URL for authz grant check')
        return null
      }

      const restUrl = rpcUrl.replace(':26657', ':1317').replace('rpc', 'api')

      const response = await fetch(
        `${restUrl}/cosmos/authz/v1beta1/grants?granter=${primaryAddress}&grantee=${sessionAddress}&msg_type_url=${messageType}`
      )

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      if (!data.grants || data.grants.length === 0) {
        return null
      }

      const grant = data.grants[0]
      return {
        authorization: grant.authorization,
        expiration: grant.expiration ? new Date(grant.expiration) : undefined,
      }
    } catch {
      return null
    }
  }
}

// Factory function for hasFeegrant method
function createHasFeegrant(
  primaryClient: SigningStargateClient,
  primaryAddress: string,
  sessionAddress: string
): HasFeegrantFn {
  return async (): Promise<FeegrantInfo | null> => {
    try {
      const rpcUrl = (primaryClient as any).cometClient?.client?.url
      if (!rpcUrl) {
        console.warn('Could not extract RPC URL for feegrant check')
        return null
      }

      const restUrl = rpcUrl.replace(':26657', ':1317').replace('rpc', 'api')

      const response = await fetch(
        `${restUrl}/cosmos/feegrant/v1beta1/allowance/${primaryAddress}/${sessionAddress}`
      )

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      if (!data.allowance) {
        return null
      }

      return {
        allowance: data.allowance,
        expiration: data.allowance.expiration ? new Date(data.allowance.expiration) : undefined,
      }
    } catch {
      return null
    }
  }
}

// ============================================================================
// AUTHZ AND FEEGRANT UTILITIES
// ============================================================================

// Convert Date to protobuf Timestamp
export function dateToTimestamp(date: Date): Timestamp {
  const seconds = Math.floor(date.getTime() / 1000)
  const nanos = (date.getTime() % 1000) * 1000000
  return Timestamp.fromPartial({ seconds: BigInt(seconds), nanos })
}

// Generate authz grant and feegrant messages for session wallet delegation
function generateDelegationMessagesFn(
  primaryAddress: string,
  sessionAddress: string,
  config: DelegationConfig
): EncodeObject[] {

  // Primary wallet grants session wallet limited send authorization
  const spendLimitCoins: Coin[] = config.spendLimit
    ? [Coin.fromPartial({ denom: config.spendLimit.denom, amount: config.spendLimit.amount })]
    : [Coin.fromPartial({ denom: 'uphoton', amount: '10000000' })] // Default 10 PHOTON limit

  // Create send authorization inline
  const authorizationData: any = {}
  if (spendLimitCoins && spendLimitCoins.length > 0) {
    authorizationData.spendLimit = spendLimitCoins
  }
  if (config.allowedRecipients && config.allowedRecipients.length > 0) {
    authorizationData.allowList = config.allowedRecipients
  }
  const authorization = SendAuthorization.fromPartial(authorizationData)
  const sendAuth = Any.fromPartial({
    typeUrl: '/cosmos.bank.v1beta1.SendAuthorization',
    value: SendAuthorization.encode(authorization).finish(),
  })
  // Create authz grant message inline
  const expirationDate = config.sessionExpiration || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24 hours
  const authzGrant = {
    granter: primaryAddress,
    grantee: sessionAddress,
    grant: {
      authorization: sendAuth,
      expiration: dateToTimestamp(expirationDate),
    },
  }

  // Primary wallet grants session wallet fee allowance
  const gasLimitCoins: Coin[] = config.gasLimit
    ? [Coin.fromPartial({ denom: config.gasLimit.denom, amount: config.gasLimit.amount })]
    : [Coin.fromPartial({ denom: 'uphoton', amount: '10000000' })] // Default 10 PHOTON for gas

  // Create basic fee allowance inline
  const allowance = BasicAllowance.fromPartial({
    spendLimit: gasLimitCoins,
    expiration: config.sessionExpiration ? dateToTimestamp(config.sessionExpiration) : undefined,
  })
  const feeAllowance = Any.fromPartial({
    typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
    value: BasicAllowance.encode(allowance).finish(),
  })
  // Create feegrant message inline
  const feegrant = {
    granter: primaryAddress,
    grantee: sessionAddress,
    allowance: feeAllowance,
  }

  return [
    {
      typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
      value: authzGrant,
    },
    {
      typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
      value: feegrant,
    },
  ]
}

// Generate revocation messages for authz and feegrant
function revokeDelegationMessagesFn(
  primaryAddress: string,
  sessionAddress: string,
  msgTypeUrl: string = '/cosmos.bank.v1beta1.MsgSend'
): EncodeObject[] {

  return [
    {
      typeUrl: '/cosmos.authz.v1beta1.MsgRevoke',
      value: {
        granter: primaryAddress,
        grantee: sessionAddress,
        msgTypeUrl,
      },
    },
    {
      typeUrl: '/cosmos.feegrant.v1beta1.MsgRevokeAllowance',
      value: {
        granter: primaryAddress,
        grantee: sessionAddress,
      },
    },
  ]
}
