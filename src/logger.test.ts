import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { consoleLogger, noopLogger } from './logger'

describe('logger', () => {
  // Store original console methods
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  }

  beforeEach(() => {
    // Mock console methods
    console.debug = vi.fn()
    console.info = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()
  })

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug
    console.info = originalConsole.info
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  })

  describe('consoleLogger', () => {
    it('should log debug messages without context', () => {
      consoleLogger.debug('test debug message')
      expect(console.debug).toHaveBeenCalledWith('[Stint] test debug message')
    })

    it('should log debug messages with context', () => {
      const context = { key: 'value' }
      consoleLogger.debug('test debug message', context)
      expect(console.debug).toHaveBeenCalledWith('[Stint] test debug message', context)
    })

    it('should log info messages without context', () => {
      consoleLogger.info('test info message')
      expect(console.info).toHaveBeenCalledWith('[Stint] test info message')
    })

    it('should log info messages with context', () => {
      const context = { key: 'value' }
      consoleLogger.info('test info message', context)
      expect(console.info).toHaveBeenCalledWith('[Stint] test info message', context)
    })

    it('should log warn messages without context', () => {
      consoleLogger.warn('test warn message')
      expect(console.warn).toHaveBeenCalledWith('[Stint] test warn message')
    })

    it('should log warn messages with context', () => {
      const context = { key: 'value' }
      consoleLogger.warn('test warn message', context)
      expect(console.warn).toHaveBeenCalledWith('[Stint] test warn message', context)
    })

    it('should log error messages without error or context', () => {
      consoleLogger.error('test error message')
      expect(console.error).toHaveBeenCalledWith('[Stint] test error message')
    })

    it('should log error messages with error but no context', () => {
      const error = new Error('test error')
      consoleLogger.error('test error message', error)
      expect(console.error).toHaveBeenCalledWith('[Stint] test error message', error)
    })

    it('should log error messages with context but no error', () => {
      const context = { key: 'value' }
      consoleLogger.error('test error message', undefined, context)
      expect(console.error).toHaveBeenCalledWith('[Stint] test error message', context)
    })

    it('should log error messages with both error and context', () => {
      const error = new Error('test error')
      const context = { key: 'value' }
      consoleLogger.error('test error message', error, context)
      expect(console.error).toHaveBeenCalledWith('[Stint] test error message', error, context)
    })
  })

  describe('noopLogger', () => {
    it('should not log debug messages', () => {
      noopLogger.debug('test debug message')
      expect(console.debug).not.toHaveBeenCalled()
    })

    it('should not log info messages', () => {
      noopLogger.info('test info message')
      expect(console.info).not.toHaveBeenCalled()
    })

    it('should not log warn messages', () => {
      noopLogger.warn('test warn message')
      expect(console.warn).not.toHaveBeenCalled()
    })

    it('should not log error messages', () => {
      noopLogger.error('test error message', new Error('test'))
      expect(console.error).not.toHaveBeenCalled()
    })
  })
})