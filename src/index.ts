// Passkey functions
export { getOrCreatePasskeyWallet } from './passkey'

// Stint functions (wallet creation, authz + feegrant)
export {
  newSessionWallet,
  createAuthzGrantMsg,
  createStintSetup,
  revokeStint,
  createSendAuthorization,
  createGenericAuthorization,
} from './stint'

// Types
export type { 
  SessionWallet, 
  StintWalletOptions, 
  SessionWalletConfig, 
  StintConfig 
} from './types'

export type { PasskeyWallet, PasskeyOptions } from './passkey'
