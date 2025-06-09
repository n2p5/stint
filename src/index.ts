// Wallet functions
export {
  createSessionWallet,
  initStintWallet,
  getSessionAddress,
  getMainAddress
} from './wallet'

// Passkey functions
export {
  createPasskeyCredential,
  derivePrivateKey,
  getPasskeyPRF
} from './passkey'

// Authz functions
export {
  createAuthzGrantMsg,
  createBidirectionalAuthz,
  revokeAuthz,
  createSendAuthorization,
  createGenericAuthorization
} from './authz'

// Types
export type {
  SessionWallet
} from './wallet'

export type {
  StintWalletOptions,
  SessionWalletConfig,
  AuthzConfig,
  PasskeyCredential
} from './types'