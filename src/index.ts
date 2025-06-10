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

// Stint functions (authz + feegrant)
export {
  createAuthzGrantMsg,
  createStintSetup,
  revokeStint,
  createSendAuthorization,
  createGenericAuthorization
} from './stint'

// Types
export type {
  SessionWallet
} from './wallet'

export type {
  StintWalletOptions,
  SessionWalletConfig,
  StintConfig,
  PasskeyCredential
} from './types'