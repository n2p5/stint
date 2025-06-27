// Passkey functions
export { getOrCreatePasskeyWallet } from './passkey'

// Stint functions (wallet creation, authz + feegrant)
export {
  newSessionWallet,
  createStintSetup,
  revokeStint,
} from './stint'

// Types
export type { 
  SessionWallet, 
  SessionWalletConfig, 
  StintConfig 
} from './types'

export type { PasskeyWallet, PasskeyOptions } from './passkey'
