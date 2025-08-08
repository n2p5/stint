import { SigningStargateClient, GasPrice } from '@cosmjs/stargate'
import { DirectSecp256k1Wallet, EncodeObject } from '@cosmjs/proto-signing'
import { Coin } from 'cosmjs-types/cosmos/base/v1beta1/coin'
import { Timestamp } from 'cosmjs-types/google/protobuf/timestamp'
import { SendAuthorization } from 'cosmjs-types/cosmos/bank/v1beta1/authz'
import { BasicAllowance } from 'cosmjs-types/cosmos/feegrant/v1beta1/feegrant'
import { Any } from 'cosmjs-types/google/protobuf/any'
import {
  SessionSigner,
  SessionSignerConfig,
  AuthzGrantInfo,
  FeegrantInfo,
  DelegationConfig,
  SigningStargateClientWithSigner,
} from './types'
import { getOrCreateDerivedKey } from './passkey'
import { StintError, ErrorCodes } from './errors'
import { Logger, noopLogger } from './logger'
import { createExecuteHelpers } from './execute'

// ============================================================================
// SESSION SIGNER CREATION
// ============================================================================

/**
 * Create a complete session signer in one step
 * Combines passkey creation, signer derivation, and chain connection
 * @param config - Configuration with primary client and optional salt name
 * @returns Initialized SessionSigner ready for use
 */
export async function newSessionSigner(config: SessionSignerConfig): Promise<SessionSigner> {
  const logger = config.logger || noopLogger

  logger.debug('Initializing session signer', { saltName: config.saltName })

  // Type assertion to our extended interface
  const extendedClient = config.primaryClient as unknown as SigningStargateClientWithSigner

  // Extract the signer from the client and get accounts
  const primarySigner = extendedClient.signer
  if (!primarySigner) {
    logger.error('Failed to extract signer from primary client')
    throw new StintError(
      'Failed to initialize session signer',
      ErrorCodes.SIGNER_EXTRACTION_FAILED,
      { reason: 'Signer not available in primary client' }
    )
  }

  const primaryAccounts = await primarySigner.getAccounts()
  const primaryAddress = primaryAccounts[0].address

  // Extract prefix from primary address (e.g., 'atone' from 'atone1...')
  const prefix = primaryAddress.match(/^([a-z]+)1/)?.[1] || 'atom'

  // Calculate window number based on simple selection
  const windowHours = config.stintWindowHours || 24
  const now = Date.now()
  const windowMs = windowHours * 60 * 60 * 1000
  const currentWindow = Math.floor(now / windowMs)
  const windowNumber = config.usePreviousWindow ? currentWindow - 1 : currentWindow

  logger.debug('Creating session signer', {
    windowNumber,
    windowHours,
    usePreviousWindow: config.usePreviousWindow || false,
    keyMode: config.keyMode || 'passkey',
  })

  // Get or create key based on mode
  let privateKey: Uint8Array

  if (config.keyMode === 'random') {
    // Random mode: generate ephemeral key
    logger.debug('Generating new random session key')
    logger.warn('Random session key generated - will not persist across page refresh')
    privateKey = crypto.getRandomValues(new Uint8Array(32))
  } else {
    // Passkey mode (default): derive from passkey
    const derivedKey = await getOrCreateDerivedKey({
      address: primaryAddress,
      displayName: `Stint: ${primaryAddress.slice(0, 10)}...`,
      saltName: config.saltName || 'stint-session',
      stintWindowHours: windowHours,
      windowNumber,
      logger,
    })
    privateKey = derivedKey.privateKey
  }

  // Create the session signer from the private key with same prefix as primary
  const sessionSigner = await DirectSecp256k1Wallet.fromKey(privateKey, prefix)

  // Get the session signer address
  const sessionAccounts = await sessionSigner.getAccounts()
  const sessionAddress = sessionAccounts[0].address

  // Extract RPC URL from the primary client's cometClient
  const rpcUrl = extendedClient.cometClient?.client?.url
  if (!rpcUrl) {
    logger.error('Failed to extract RPC URL from primary client')
    throw new StintError(
      'Failed to initialize session signer',
      ErrorCodes.RPC_URL_EXTRACTION_FAILED,
      { reason: 'RPC URL not available in primary client' }
    )
  }

  // Create a new client for the session signer using the same RPC endpoint as primary
  // Ensure we use a proper GasPrice object
  const originalGasPrice = extendedClient.gasPrice
  let gasPrice: GasPrice

  if (originalGasPrice instanceof GasPrice) {
    gasPrice = originalGasPrice
  } else if (
    originalGasPrice &&
    typeof originalGasPrice === 'object' &&
    'denom' in originalGasPrice &&
    'amount' in originalGasPrice
  ) {
    // Convert object format to proper GasPrice
    gasPrice = GasPrice.fromString(`${originalGasPrice.amount}${originalGasPrice.denom}`)
  } else {
    // Default fallback
    gasPrice = GasPrice.fromString('0.025uphoton')
  }

  const client = await SigningStargateClient.connectWithSigner(rpcUrl, sessionSigner, {
    gasPrice,
  })

  const signer: SessionSigner = {
    primarySigner,
    sessionSigner,
    client,

    // Methods - now synchronous with cached addresses
    primaryAddress: (): string => {
      return primaryAddress
    },

    sessionAddress: (): string => {
      return sessionAddress
    },

    // Methods - created by factory functions
    hasAuthzGrant: createHasAuthzGrant(
      config.primaryClient,
      primaryAddress,
      sessionAddress,
      logger
    ),
    hasFeegrant: createHasFeegrant(config.primaryClient, primaryAddress, sessionAddress, logger),

    // Methods - message generation (implemented inline)
    generateDelegationMessages: (config: DelegationConfig) =>
      generateDelegationMessagesFn(primaryAddress, sessionAddress, config),
    generateConditionalDelegationMessages: async (config: DelegationConfig) =>
      generateConditionalDelegationMessagesFn(signer, config),
    revokeDelegationMessages: (msgTypeUrl?: string) =>
      revokeDelegationMessagesFn(primaryAddress, sessionAddress, msgTypeUrl),

    // Execute helpers - will be added after signer creation
    execute: null as any,
  }

  // Add execute helpers after signer is created (needs reference to signer)
  signer.execute = createExecuteHelpers(signer, logger)

  return signer
}

// ============================================================================
// URL UTILITIES
// ============================================================================

/**
 * Securely convert RPC URL to REST API URL
 * @param rpcUrl The RPC URL to convert
 * @returns REST API URL
 * @throws StintError if URL is invalid or malformed
 */
export function convertRpcToRestUrl(rpcUrl: string): string {
  try {
    const url = new globalThis.URL(rpcUrl)

    // Validate protocol
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Invalid protocol: only http/https allowed')
    }

    // Convert RPC port to REST port
    if (url.port === '26657') {
      url.port = '1317'
    }

    // Convert RPC subdomain to API subdomain
    if (url.hostname.startsWith('rpc.')) {
      url.hostname = url.hostname.replace('rpc.', 'api.')
    }

    // Handle AtomOne testnet specific pattern: *-rpc.* -> *-api.*
    if (url.hostname.includes('-rpc.')) {
      url.hostname = url.hostname.replace('-rpc.', '-api.')
    }

    // Return URL without trailing slash to avoid double slashes
    const urlString = url.toString()
    return urlString.endsWith('/') ? urlString.slice(0, -1) : urlString
  } catch (error) {
    throw new StintError('Invalid RPC URL provided', ErrorCodes.INVALID_RPC_URL, {
      rpcUrl,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
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
  sessionAddress: string,
  logger: Logger = noopLogger
): HasAuthzGrantFn {
  return async (
    messageType: string = '/cosmos.bank.v1beta1.MsgSend'
  ): Promise<AuthzGrantInfo | null> => {
    try {
      const extendedClient = primaryClient as unknown as SigningStargateClientWithSigner
      const rpcUrl = extendedClient.cometClient?.client?.url
      if (!rpcUrl) {
        logger.warn('Could not extract RPC URL for authz grant check')
        return null
      }

      const restUrl = convertRpcToRestUrl(rpcUrl)
      const requestUrl = `${restUrl}/cosmos/authz/v1beta1/grants?granter=${primaryAddress}&grantee=${sessionAddress}&msg_type_url=${messageType}`

      logger.debug('Checking authz grant', {
        rpcUrl,
        restUrl,
        requestUrl,
        granter: primaryAddress,
        grantee: sessionAddress,
        messageType,
      })

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'stint-library/1.0.0',
        },
        signal: globalThis.AbortSignal.timeout(10000), // 10 second timeout
        // Security: Only allow specific response types
        redirect: 'error', // Don't follow redirects for security
      })

      if (!response.ok) {
        logger.debug('Authz grant check failed', {
          status: response.status,
          statusText: response.statusText,
          messageType,
        })
        return null
      }

      // Security: Validate response size and content type (only in real fetch environment)
      if (response.headers) {
        const contentLength = response.headers.get('content-length')
        if (contentLength && parseInt(contentLength) > 1024 * 1024) {
          // 1MB limit
          logger.warn('Authz grant response too large', {
            contentLength,
            messageType,
          })
          return null
        }

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          logger.warn('Invalid content type for authz grant response', {
            contentType,
            messageType,
          })
          return null
        }
      }

      const data = await response.json()
      logger.debug('Authz grant response', { data, messageType })

      if (!data.grants || data.grants.length === 0) {
        logger.debug('No authz grants found', { messageType })
        return null
      }

      const grant = data.grants[0]
      logger.debug('Found authz grant', { messageType, hasExpiration: !!grant.expiration })
      return {
        authorization: grant.authorization,
        expiration: grant.expiration ? new Date(grant.expiration) : undefined,
      }
    } catch (error) {
      // Handle specific error types for better debugging
      if (error instanceof globalThis.DOMException && error.name === 'TimeoutError') {
        logger.warn('Authz grant check timed out', {
          operation: 'hasAuthzGrant',
          messageType,
          timeout: '10000ms',
        })
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        logger.warn('Network error during authz grant check', {
          operation: 'hasAuthzGrant',
          messageType,
          error: error.message,
        })
      } else {
        logger.warn('Authz grant check failed', {
          operation: 'hasAuthzGrant',
          messageType,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
      return null
    }
  }
}

// Factory function for hasFeegrant method
function createHasFeegrant(
  primaryClient: SigningStargateClient,
  primaryAddress: string,
  sessionAddress: string,
  logger: Logger = noopLogger
): HasFeegrantFn {
  return async (): Promise<FeegrantInfo | null> => {
    try {
      const extendedClient = primaryClient as unknown as SigningStargateClientWithSigner
      const rpcUrl = extendedClient.cometClient?.client?.url
      if (!rpcUrl) {
        logger.warn('Could not extract RPC URL for feegrant check')
        return null
      }

      const restUrl = convertRpcToRestUrl(rpcUrl)
      const requestUrl = `${restUrl}/cosmos/feegrant/v1beta1/allowance/${primaryAddress}/${sessionAddress}`

      logger.debug('Checking feegrant', {
        rpcUrl,
        restUrl,
        requestUrl,
        granter: primaryAddress,
        grantee: sessionAddress,
      })

      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'stint-library/1.0.0',
        },
        signal: globalThis.AbortSignal.timeout(10000), // 10 second timeout
        // Security: Only allow specific response types
        redirect: 'error', // Don't follow redirects for security
      })

      if (!response.ok) {
        logger.debug('Feegrant check failed', {
          status: response.status,
          statusText: response.statusText,
        })
        return null
      }

      // Security: Validate response size and content type (only in real fetch environment)
      if (response.headers) {
        const contentLength = response.headers.get('content-length')
        if (contentLength && parseInt(contentLength) > 1024 * 1024) {
          // 1MB limit
          logger.warn('Feegrant response too large', {
            contentLength,
          })
          return null
        }

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          logger.warn('Invalid content type for feegrant response', {
            contentType,
          })
          return null
        }
      }

      const data = await response.json()
      if (!data.allowance) {
        logger.debug('No feegrant found')
        return null
      }

      logger.debug('Found feegrant', { hasExpiration: !!data.allowance.expiration })
      return {
        allowance: data.allowance,
        expiration: data.allowance.expiration ? new Date(data.allowance.expiration) : undefined,
      }
    } catch (error) {
      // Handle specific error types for better debugging
      if (error instanceof globalThis.DOMException && error.name === 'TimeoutError') {
        logger.warn('Feegrant check timed out', {
          operation: 'hasFeegrant',
          timeout: '10000ms',
        })
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        logger.warn('Network error during feegrant check', {
          operation: 'hasFeegrant',
          error: error.message,
        })
      } else {
        logger.warn('Feegrant check failed', {
          operation: 'hasFeegrant',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
      return null
    }
  }
}

// ============================================================================
// AUTHZ AND FEEGRANT UTILITIES
// ============================================================================

// Convert Date to protobuf Timestamp
export function dateToTimestamp(date: Date): Timestamp {
  return Timestamp.fromPartial({
    seconds: BigInt(Math.floor(date.getTime() / 1000)),
    nanos: (date.getTime() % 1000) * 1_000_000,
  })
}

// Generate authz grant and feegrant messages for session signer delegation
function generateDelegationMessagesFn(
  primaryAddress: string,
  sessionAddress: string,
  config: DelegationConfig
): EncodeObject[] {
  // Primary address grants session address limited send authorization
  const spendLimitCoins: Coin[] = config.spendLimit
    ? [Coin.fromPartial({ denom: config.spendLimit.denom, amount: config.spendLimit.amount })]
    : [Coin.fromPartial({ denom: 'uphoton', amount: '10000000' })] // Default 10 PHOTON limit

  // Create send authorization with proper protobuf encoding
  const sendAuth = SendAuthorization.fromPartial({
    spendLimit: spendLimitCoins,
    allowList: config.allowedRecipients || [],
  })

  const authorization = Any.fromPartial({
    typeUrl: '/cosmos.bank.v1beta1.SendAuthorization',
    value: SendAuthorization.encode(sendAuth).finish(),
  })

  // Create authz grant message with proper encoding
  const expirationDate = config.sessionExpiration || new Date(Date.now() + 24 * 60 * 60 * 1000) // Default 24 hours
  const authzGrant = {
    granter: primaryAddress,
    grantee: sessionAddress,
    grant: {
      authorization,
      expiration: dateToTimestamp(expirationDate),
    },
  }

  // Primary address grants session address fee allowance
  const gasLimitCoins: Coin[] = config.gasLimit
    ? [Coin.fromPartial({ denom: config.gasLimit.denom, amount: config.gasLimit.amount })]
    : [Coin.fromPartial({ denom: 'uphoton', amount: '10000000' })] // Default 10 PHOTON for gas

  // Create feegrant message with proper protobuf encoding
  const allowance = BasicAllowance.fromPartial({
    spendLimit: gasLimitCoins,
    expiration: config.sessionExpiration ? dateToTimestamp(config.sessionExpiration) : undefined,
  })

  const feeAllowance = Any.fromPartial({
    typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
    value: BasicAllowance.encode(allowance).finish(),
  })

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

// Generate delegation messages only for missing grants
async function generateConditionalDelegationMessagesFn(
  sessionSigner: SessionSigner,
  config: DelegationConfig
): Promise<EncodeObject[]> {
  const primaryAddress = sessionSigner.primaryAddress()
  const sessionAddress = sessionSigner.sessionAddress()

  // Check what grants already exist
  const [existingAuthz, existingFeegrant] = await Promise.all([
    sessionSigner.hasAuthzGrant(),
    sessionSigner.hasFeegrant(),
  ])

  const messages: EncodeObject[] = []

  // Only create authz grant if it doesn't exist
  if (!existingAuthz) {
    const spendLimitCoins: Coin[] = config.spendLimit
      ? [Coin.fromPartial({ denom: config.spendLimit.denom, amount: config.spendLimit.amount })]
      : [Coin.fromPartial({ denom: 'uphoton', amount: '10000000' })] // Default 10 PHOTON limit

    const sendAuth = SendAuthorization.fromPartial({
      spendLimit: spendLimitCoins,
      allowList: config.allowedRecipients || [],
    })

    const authorization = Any.fromPartial({
      typeUrl: '/cosmos.bank.v1beta1.SendAuthorization',
      value: SendAuthorization.encode(sendAuth).finish(),
    })

    const expirationDate = config.sessionExpiration || new Date(Date.now() + 24 * 60 * 60 * 1000)
    const authzGrant = {
      granter: primaryAddress,
      grantee: sessionAddress,
      grant: {
        authorization,
        expiration: dateToTimestamp(expirationDate),
      },
    }

    messages.push({
      typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
      value: authzGrant,
    })
  }

  // Only create feegrant if it doesn't exist
  if (!existingFeegrant) {
    const gasLimitCoins: Coin[] = config.gasLimit
      ? [Coin.fromPartial({ denom: config.gasLimit.denom, amount: config.gasLimit.amount })]
      : [Coin.fromPartial({ denom: 'uphoton', amount: '10000000' })] // Default 10 PHOTON for gas

    const allowance = BasicAllowance.fromPartial({
      spendLimit: gasLimitCoins,
      expiration: config.sessionExpiration ? dateToTimestamp(config.sessionExpiration) : undefined,
    })

    const feeAllowance = Any.fromPartial({
      typeUrl: '/cosmos.feegrant.v1beta1.BasicAllowance',
      value: BasicAllowance.encode(allowance).finish(),
    })

    const feegrant = {
      granter: primaryAddress,
      grantee: sessionAddress,
      allowance: feeAllowance,
    }

    messages.push({
      typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
      value: feegrant,
    })
  }

  return messages
}
