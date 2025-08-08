// Main function
export { newSessionSigner } from './stint'

// Execute helpers (can be used directly for testing/advanced usage)
export { wrapInMsgExec, createFeeWithGranter, send, custom } from './execute'

// Window utilities (for debugging and validation)
export { getWindowBoundaries } from './passkey'

// Types
export type { SessionSigner, SessionSignerConfig, DelegationConfig, ExecuteHelpers } from './types'

// Error handling
export { StintError, ErrorCodes } from './errors'
export type { ErrorCode } from './errors'

// Logging
export type { Logger } from './logger'
export { consoleLogger } from './logger'
