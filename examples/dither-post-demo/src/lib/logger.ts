import type { Logger } from 'stint-signer'

/**
 * Custom logger for the dither-post-demo example
 * Logs to console with nice formatting and context
 */
export const exampleLogger: Logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    console.log(`🔍 [Stint Debug] ${message}`, context ? context : '')
  },
  
  info: (message: string, context?: Record<string, unknown>) => {
    console.log(`ℹ️ [Stint Info] ${message}`, context ? context : '')
  },
  
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(`⚠️ [Stint Warning] ${message}`, context ? context : '')
  },
  
  error: (message: string, error?: Error, context?: Record<string, unknown>) => {
    console.error(`❌ [Stint Error] ${message}`, error, context ? context : '')
  },
}

/**
 * Logger that also updates the UI with status messages
 * Useful for showing users what's happening during operations
 */
export function createUILogger(setStatus: (status: string) => void): Logger {
  return {
    debug: (message: string, context?: Record<string, unknown>) => {
      exampleLogger.debug(message, context)
    },
    
    info: (message: string, context?: Record<string, unknown>) => {
      exampleLogger.info(message, context)
      setStatus(message)
    },
    
    warn: (message: string, context?: Record<string, unknown>) => {
      exampleLogger.warn(message, context)
      setStatus(`Warning: ${message}`)
    },
    
    error: (message: string, error?: Error, context?: Record<string, unknown>) => {
      exampleLogger.error(message, error, context)
      setStatus(`Error: ${message}`)
    },
  }
}