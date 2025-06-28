/**
 * Logger interface that can be implemented by users
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, error?: Error, context?: Record<string, unknown>): void
}

/**
 * Simple console-based logger implementation
 * Users can provide their own logger that implements the Logger interface
 */
export const consoleLogger: Logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    if (context) {
      console.debug(`[Stint] ${message}`, context)
    } else {
      console.debug(`[Stint] ${message}`)
    }
  },
  
  info: (message: string, context?: Record<string, unknown>) => {
    if (context) {
      console.info(`[Stint] ${message}`, context)
    } else {
      console.info(`[Stint] ${message}`)
    }
  },
  
  warn: (message: string, context?: Record<string, unknown>) => {
    if (context) {
      console.warn(`[Stint] ${message}`, context)
    } else {
      console.warn(`[Stint] ${message}`)
    }
  },
  
  error: (message: string, error?: Error, context?: Record<string, unknown>) => {
    if (error && context) {
      console.error(`[Stint] ${message}`, error, context)
    } else if (error) {
      console.error(`[Stint] ${message}`, error)
    } else if (context) {
      console.error(`[Stint] ${message}`, context)
    } else {
      console.error(`[Stint] ${message}`)
    }
  },
}

/**
 * No-op logger that discards all log messages
 * Useful for production environments where logging is not desired
 */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}