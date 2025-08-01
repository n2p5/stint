# Stint Complete Guide

This guide covers advanced usage, detailed examples, and comprehensive documentation for Stint.

## Table of Contents

- [Why Use Session Signers?](#why-use-session-signers)
- [How It Works](#how-it-works)
- [Complete Flow Example](#complete-flow-example)
- [How-To Guides](#how-to-guides)
  - [Post to Dither](#post-to-dither)
  - [Working with AtomOne](#working-with-atomone)
  - [Using MsgExec for Authz](#using-msgexec-for-authz)
  - [Debugging with Logging](#debugging-with-logging)
- [API Reference](#api-reference)
- [Multiple Session Signers](#multiple-session-signers)
- [Custom Logging](#custom-logging)
- [Error Handling](#error-handling)
- [Advanced Configuration](#advanced-configuration)
- [Security & Risks](#security--risks)

## Why Use Session Signers?

A session signer, when narrowly scoped, can be useful for simplifying the User Experience (UX) for social dApps that use a low fee and gas structure for on-chain interactivity.

- **Social media interactions**: Enable users to "like", "repost", or comment on-chain without signing popups
- **Profile and settings updates**: Make small changes to on-chain profiles or preferences seamlessly
- **Gaming and play-to-earn**: Allow in-game actions like moves, item trades, or achievement claims without interrupting gameplay
- **Recurring payments or tips**: Set up limited spending for content creators, subscriptions, or micro-donations
- **DAO participation**: Vote on a set of proposals without hardware wallet interaction for each vote

## How It Works

The system works by creating a **session signer** that never holds funds but can transact on behalf of your primary signer:

1. **Passkey + PRF**: Creates a deterministic private key using WebAuthn Passkey with PRF extension
2. **Authz Grant**: Primary signer authorizes session signer to perform specific actions (e.g., Send messages) with defined limits
3. **Feegrant**: Primary signer grants fee allowance to session signer, so it doesn't need to hold any funds for gas

### Technical Flow Diagram

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Passkey as WebAuthn Passkey
    participant Primary as Primary Wallet
    participant Session as Session Signer
    participant Chain as Cosmos Chain

    rect rgb(0, 100, 200)
        Note over User, Session: 1. Session Signer Creation
        User->>Browser: newSessionSigner()
        Browser->>Passkey: Create/Authenticate with PRF
        Passkey-->>Browser: PRF output
        Browser->>Browser: Derive private key from PRF
        Browser->>Session: Create session signer
        Session-->>User: Return SessionSigner object
    end

    rect rgb(200, 100, 0)
        Note over User, Chain: 2. Authorization Setup
        User->>Session: generateDelegationMessages()
        Session-->>User: Authz + Feegrant messages
        User->>Primary: Sign messages
        Primary->>Chain: Broadcast transaction
        Chain->>Chain: Store authz grant
        Chain->>Chain: Store feegrant allowance
        Chain-->>User: Transaction confirmed
    end

    rect rgb(0, 150, 50)
        Note over User, Chain: 3. Session Usage
        User->>Session: execute.send()
        Session->>Session: Create MsgExec wrapper
        Session->>Session: Sign transaction
        Session->>Chain: Submit transaction
        Chain->>Chain: Verify authz grant
        Chain->>Chain: Deduct from feegrant
        Chain->>Chain: Transfer funds from Primary
        Chain-->>User: Transaction success
        Note right of Session: Session signer never holds funds!
    end
```

## Complete Flow Example

Here's a complete example showing how to set up a session signer and send a transaction on behalf of the primary signer:

```typescript
import { newSessionSigner } from 'stint-signer'
import { SigningStargateClient } from '@cosmjs/stargate'

async function stintExample() {
  // 1. Create session signer (triggers passkey creation/authentication)
  const sessionSigner = await newSessionSigner({
    primaryClient,  // Your existing SigningStargateClient
    saltName: 'my-app-trading'  // Optional: creates isolated session signer
  })

  const primaryAddress = sessionSigner.primaryAddress()
  const sessionAddress = sessionSigner.sessionAddress()
  
  console.log(`Primary address: ${primaryAddress}`)
  console.log(`Session address: ${sessionAddress}`)

  // 2. Check if authorizations already exist (optional)
  const existingAuthz = await sessionSigner.hasAuthzGrant()
  const existingFeegrant = await sessionSigner.hasFeegrant()
  
  // 3. Define authorized recipient for restrictions
  const authorizedRecipient = 'atone1isolatedaccountxyz123...'
  
  if (!existingAuthz || !existingFeegrant) {
    // Generate ready-to-broadcast authorization messages with account scope restriction
    const setupMessages = sessionSigner.generateDelegationMessages({
      sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      spendLimit: { denom: 'uphoton', amount: '500000' }, // Max 0.5 PHOTON for sending
      gasLimit: { denom: 'uphoton', amount: '500000' },  // 0.5 PHOTON for gas
      allowedRecipients: [authorizedRecipient] // Restrict to specific recipient
    })

    // 4. Authorize with primary signer (ready-to-broadcast messages)
    console.log('Setting up session signer authorizations...')
    const setupResult = await primaryClient.signAndBroadcast(
      primaryAddress, 
      setupMessages, 
      'auto'
    )
    
    console.log('Setup successful:', setupResult.transactionHash)
  } else {
    console.log('Session signer already authorized!')
  }

  // 5. Send transaction using simplified execute.send() method
  const sendAmount = [{ denom: 'uphoton', amount: '500000' }] // 0.5 PHOTON (within limits)

  console.log('Sending transaction via session signer...')
  
  // Use the simplified execute.send method (automatically handles MsgExec wrapping)
  const result = await sessionSigner.execute.send({
    toAddress: authorizedRecipient,  // Must match allowedRecipients
    amount: sendAmount,
    memo: 'Transaction via session signer'
  })
  
  console.log('Transaction successful!')
  console.log('Funds transferred from primary using session signer authorization!')

  // The session signer:
  // ✅ Never held any funds
  // ✅ Sent transaction on behalf of primary address  
  // ✅ Gas fees automatically paid from primary address via feegrant
  // ✅ Restricted to authorized recipient only
  // ✅ Limited to authorized spending amount
}

// Run the example
stintExample().catch(console.error)
```

### Key Benefits Demonstrated

- **Zero-balance operation**: Session signer never needs funds
- **Automatic gas payment**: Feegrant covers all transaction fees
- **Scope restrictions**: Limited to specific recipients and amounts
- **Seamless UX**: No hardware wallet popups after initial setup
- **Security**: Passkey-based deterministic key derivation
- **Revocable**: Primary signer maintains full control

## How-To Guides

### Post to Dither

[Dither](https://testnet.dither.network) is a decentralized social network on AtomOne. Here's how to post using a session signer:

```typescript
import { newSessionSigner } from 'stint-signer'

// Dither's posting address on AtomOne testnet
const DITHER_ADDRESS = 'atone1qh95tzhnn9d5fkr3ejzpdcrdgvp45ccd4skl5x0z5y6kqp6jytuqclvpsp'

// Create session signer
const sessionSigner = await newSessionSigner({
  primaryClient,
  saltName: 'dither-posts'
})

// Set up authorization for Dither posting
const messages = sessionSigner.generateDelegationMessages({
  sessionExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
  spendLimit: { denom: 'uphoton', amount: '100000' }, // 0.1 PHOTON for posts
  gasLimit: { denom: 'uphoton', amount: '500000' },   // 0.5 PHOTON for gas
  allowedRecipients: [DITHER_ADDRESS] // Only allow posting to Dither
})

// Authorize with primary signer
await primaryClient.signAndBroadcast(primaryAddress, messages, 'auto')

// Now post to Dither! Use the simplified execute.send method
await sessionSigner.execute.send({
  toAddress: DITHER_ADDRESS,
  amount: [{ denom: 'uphoton', amount: '100' }], // Minimal amount required
  memo: 'Hello Dither! Posted via Stint session signer 🚀' // Your post content
})
```

### Working with AtomOne

AtomOne uses PHOTON as its gas token. Here are the key considerations:

```typescript
// AtomOne denomination requirements
const config = {
  // Spending limit can be ATOM or PHOTON
  spendLimit: { 
    denom: 'uatom',    // or 'uphoton'
    amount: '1000000'  // 1 ATOM or 1 PHOTON
  },
  
  // Gas MUST be PHOTON on AtomOne
  gasLimit: { 
    denom: 'uphoton',  // Required: AtomOne only accepts PHOTON for gas
    amount: '500000'   // 0.5 PHOTON
  }
}

// When sending transactions, ensure fee uses PHOTON
const fee = {
  amount: [{ denom: 'uphoton', amount: '5000' }], // PHOTON only
  gas: '200000',
  granter: primaryAddress // Important: enables feegrant usage
}
```

### Simple Execute API (Recommended)

The easiest way to use session signers is with the `execute` helpers that automatically handle MsgExec wrapping:

```typescript
// Send tokens (common use case)
await sessionSigner.execute.send({
  toAddress: 'atone1recipient...',
  amount: [{ denom: 'uphoton', amount: '1000' }],
  memo: 'Payment for services'
})

// With custom fees
await sessionSigner.execute.send({
  toAddress: 'atone1recipient...',
  amount: [{ denom: 'uphoton', amount: '1000' }],
  memo: 'Payment for services',
  fee: {
    amount: [{ denom: 'uphoton', amount: '8000' }],
    gas: '300000'
  }
})

// Execute custom messages (advanced)
await sessionSigner.execute.custom({
  messages: [msgStakeAny, msgVoteAny], // Pre-encoded protobuf messages
  memo: 'Batch governance actions'
})
```

### Advanced: Manual MsgExec for Custom Messages

For advanced use cases or custom message types, you can manually construct MsgExec. **Important: You cannot use convenience methods like `sendTokens` because they don't support authz delegation.**

```typescript
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx'
import { MsgExec } from 'cosmjs-types/cosmos/authz/v1beta1/tx'
import { Any } from 'cosmjs-types/google/protobuf/any'

// 1. Create the inner message (what you want to do)
const msgSend = MsgSend.fromPartial({
  fromAddress: primaryAddress,  // Funds come from primary
  toAddress: recipientAddress,
  amount: [{ denom: 'uphoton', amount: '1000' }]
})

// 2. Encode as Any type
const msgSendBytes = MsgSend.encode(msgSend).finish()
const msgSendAny = Any.fromPartial({
  typeUrl: '/cosmos.bank.v1beta1.MsgSend',
  value: msgSendBytes
})

// 3. Wrap in MsgExec
const execMsg = {
  typeUrl: '/cosmos.authz.v1beta1.MsgExec',
  value: {
    grantee: sessionAddress,  // Session signer is grantee
    msgs: [msgSendAny]        // Inner message(s)
  }
}

// 4. Sign with session signer, use feegrant for fees
const result = await sessionSigner.client.signAndBroadcast(
  sessionAddress,  // Session signer signs
  [execMsg],       // MsgExec wrapper
  {
    amount: [{ denom: 'uphoton', amount: '5000' }],
    gas: '200000',
    granter: primaryAddress  // Primary pays fees via feegrant
  },
  'Optional memo'
)
```

### Debugging with Logging

Enable comprehensive logging to debug session signer operations:

```typescript
import { newSessionSigner, consoleLogger } from 'stint-signer'

// Enable logging during development
const sessionSigner = await newSessionSigner({
  primaryClient,
  logger: consoleLogger  // Shows all debug, info, warn, error logs
})

// What you'll see in the console:
// [Stint] Initializing session signer { saltName: 'my-app' }
// [Stint] Starting passkey derivation { address: 'atone1...', saltName: 'my-app' }
// [Stint] Session key ready
// [Stint] Checking authz grant { messageType: '/cosmos.bank.v1beta1.MsgSend' }
// [Stint] Found authz grant { hasExpiration: true }

// Conditional logging based on environment
const logger = process.env.NODE_ENV === 'development' ? consoleLogger : undefined
const sessionSigner = await newSessionSigner({
  primaryClient,
  logger  // No logs in production
})
```

## API Reference

### Available Exports

```typescript
// Main functions
import { newSessionSigner, getWindowBoundaries } from 'stint-signer'

// Error handling  
import { StintError, ErrorCodes, type ErrorCode } from 'stint-signer'

// Logging
import { consoleLogger, type Logger } from 'stint-signer'

// TypeScript types
import type { 
  SessionSigner, 
  SessionSignerConfig, 
  DelegationConfig,
  ExecuteHelpers,
  AuthzGrantInfo,
  FeegrantInfo
} from 'stint-signer'
```

### Execute Helpers API

The `execute` property provides simplified methods for common operations:

```typescript
// Send tokens with automatic MsgExec wrapping
await sessionSigner.execute.send({
  toAddress: string,
  amount: Coin[],           // [{ denom: 'uphoton', amount: '1000' }]
  memo?: string,            // Optional memo
  fee?: StdFee | 'auto'     // Auto-includes granter for feegrant
})

// Execute custom messages (advanced)
await sessionSigner.execute.custom({
  messages: Any[],          // Pre-encoded protobuf messages
  memo?: string,
  fee?: StdFee | 'auto'
})
```

### Session Signer Methods

#### `sessionSigner.generateDelegationMessages(config)`

Generates ready-to-broadcast authz grant and feegrant messages to delegate authority to the session signer.

```typescript
const messages = sessionSigner.generateDelegationMessages({
  sessionExpiration?: Date,              // When the grants expire
  spendLimit?: { denom: string, amount: string },  // Max amount session signer can spend (uatom or uphoton)
  gasLimit?: { denom: string, amount: string },    // Max gas fees covered by feegrant (must be uphoton in AtomOne)
  allowedRecipients?: string[]           // Optional: restrict recipients
})

// messages is an array ready for signAndBroadcast:
await primaryClient.signAndBroadcast(primaryAddress, messages, 'auto')
```

**AtomOne Denomination Requirements:**
- `spendLimit.denom`: Can be `'uatom'` (ATOM) or `'uphoton'` (PHOTON)
- `gasLimit.denom`: Must be `'uphoton'` (PHOTON) - AtomOne requires fees in PHOTON
- Default values use `'uphoton'` for both spend and gas limits

#### `sessionSigner.generateConditionalDelegationMessages(config)`

Similar to `generateDelegationMessages`, but only generates messages for grants that don't already exist. This is more efficient when you want to avoid duplicate grants.

```typescript
const messages = await sessionSigner.generateConditionalDelegationMessages({
  sessionExpiration?: Date,              // When the grants expire
  spendLimit?: { denom: string, amount: string },  // Max amount session signer can spend
  gasLimit?: { denom: string, amount: string },    // Max gas fees covered by feegrant
  allowedRecipients?: string[]           // Optional: restrict recipients
})

// messages will be empty if both grants already exist
if (messages.length > 0) {
  await primaryClient.signAndBroadcast(primaryAddress, messages, 'auto')
} else {
  console.log('All grants already exist!')
}
```

This method automatically checks for existing grants and only includes the missing ones in the returned message array.

#### `sessionSigner.revokeDelegationMessages(msgTypeUrl?)`

Generates ready-to-broadcast messages to revoke the delegated authority.

```typescript
const messages = sessionSigner.revokeDelegationMessages(
  '/cosmos.bank.v1beta1.MsgSend'  // Optional: message type to revoke (default: MsgSend)
)

// messages is an array ready for signAndBroadcast:
await primaryClient.signAndBroadcast(primaryAddress, messages, 'auto')
```

## Multiple Session Signers

You can create multiple session signers for different purposes using salt names:

```typescript
// Default session signer
const defaultSigner = await newSessionSigner({
  primaryClient,
})

// Trading-specific session signer  
const tradingSigner = await newSessionSigner({
  primaryClient,
  saltName: 'trading',
})

// Gaming-specific session signer
const gamingSigner = await newSessionSigner({
  primaryClient,
  saltName: 'gaming',
})
```

Each salt creates a completely different private key from the same passkey.

## Custom Logging

Stint includes a comprehensive logging system to help you debug and monitor session signer operations. By default, the library runs silently with no logging output, making it production-ready out of the box. You can enable logging by providing a logger implementation.

### Using Built-in Loggers

```typescript
import { newSessionSigner, consoleLogger } from 'stint-signer'

// Default behavior - no logging (production-ready)
const sessionSigner = await newSessionSigner({
  primaryClient
})

// Enable console logging for debugging
const sessionSigner = await newSessionSigner({
  primaryClient,
  logger: consoleLogger
})

// Conditional logging based on environment
const sessionSigner = await newSessionSigner({
  primaryClient,
  logger: process.env.NODE_ENV === 'development' ? consoleLogger : undefined
})
```

### Custom Logger Implementation

```typescript
import { newSessionSigner, type Logger } from 'stint-signer'

// Implement your own logger
const customLogger: Logger = {
  debug: (message: string, context?: Record<string, unknown>) => {
    // Send to your debugging service
    debugService.log('debug', message, context)
  },
  info: (message: string, context?: Record<string, unknown>) => {
    // Send to your analytics
    analytics.track(message, context)
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    // Send to warning monitoring
    warningService.report(message, context)
  },
  error: (message: string, error?: Error, context?: Record<string, unknown>) => {
    // Send to error tracking (Sentry, etc.)
    errorTracker.captureException(error || new Error(message), {
      tags: { component: 'stint-signer' },
      extra: context
    })
  }
}

const sessionSigner = await newSessionSigner({
  primaryClient,
  logger: customLogger
})
```

### What Gets Logged

The logger captures important events throughout the session signer lifecycle:

- **Session creation**: Passkey operations, key derivation progress
- **Grant checking**: Network requests for existing authz/feegrant status
- **Transaction operations**: Message generation and broadcasting
- **Error conditions**: Network failures, validation errors, WebAuthn issues

Example log output:
```
[Stint] Initializing session signer { saltName: 'my-app' }
[Stint] Starting passkey derivation { address: 'atone1abc...', saltName: 'my-app' }  
[Stint] Session key ready
[Stint] Checking authz grant { messageType: '/cosmos.bank.v1beta1.MsgSend' }
[Stint] Found authz grant { hasExpiration: true }
```

## Error Handling

Stint provides structured error handling with specific error codes for different failure scenarios.

### Error Types

```typescript
import { StintError, ErrorCodes } from 'stint-signer'

try {
  const sessionSigner = await newSessionSigner({ primaryClient })
} catch (error) {
  if (error instanceof StintError) {
    switch (error.code) {
      case ErrorCodes.WEBAUTHN_NOT_SUPPORTED:
        console.log('WebAuthn not available in this browser')
        // Fallback to hardware wallet only
        break
        
      case ErrorCodes.PASSKEY_CREATION_FAILED:
        console.log('User cancelled passkey creation')
        // Show user-friendly message
        break
        
      case ErrorCodes.PRF_NOT_SUPPORTED:
        console.log('Passkey does not support PRF extension')
        // Inform user about browser/device limitations
        break
        
      case ErrorCodes.USER_CANCELLED:
        console.log('User cancelled the operation')
        // No action needed
        break
        
      case ErrorCodes.INVALID_RPC_URL:
        console.log('Invalid RPC URL provided')
        // Check your configuration
        break
        
      default:
        console.log('Unknown stint error:', error.message)
    }
    
    // Access additional error details
    console.log('Error details:', error.details)
  } else {
    // Handle other errors
    console.error('Unexpected error:', error)
  }
}
```

### Complete Error Code Reference

| Error Code | Description | Common Causes |
|------------|-------------|---------------|
| `WEBAUTHN_NOT_SUPPORTED` | WebAuthn API not available | Older browser, non-HTTPS context |
| `PASSKEY_CREATION_FAILED` | Failed to create passkey | User cancellation, hardware limitations |
| `PASSKEY_AUTHENTICATION_FAILED` | Failed to authenticate passkey | User cancellation, wrong passkey |
| `PRF_NOT_SUPPORTED` | Passkey PRF extension not supported | Older browser, hardware limitations |
| `USER_CANCELLED` | User cancelled operation | User action |
| `CLIENT_INITIALIZATION_FAILED` | Failed to create signing client | Network issues, invalid configuration |
| `SIGNER_EXTRACTION_FAILED` | Could not extract signer from client | Invalid client configuration |
| `RPC_URL_EXTRACTION_FAILED` | Could not get RPC URL from client | Client configuration issue |
| `GRANT_CHECK_FAILED` | Failed to check existing grants | Network issues, invalid endpoints |
| `INVALID_RESPONSE` | Unexpected API response format | Network issues, API changes |
| `INVALID_ADDRESS` | Invalid Cosmos address format | Configuration error |
| `INVALID_AMOUNT` | Invalid token amount | Input validation error |
| `INVALID_DENOMINATION` | Invalid token denomination | Configuration error |
| `INVALID_RPC_URL` | Invalid or malformed RPC URL | Security validation, configuration error |

### Network Request Security

Stint includes built-in security measures for network requests:

- **Request timeouts**: 10-second timeout on all fetch operations
- **Response size limits**: 1MB maximum response size to prevent DoS
- **Content-type validation**: Only accepts `application/json` responses
- **URL validation**: Prevents injection attacks with secure URL parsing
- **No redirects**: Prevents redirect-based attacks

```typescript
// Network errors are handled gracefully
try {
  const hasGrant = await sessionSigner.hasAuthzGrant()
} catch (error) {
  // Network failures return null rather than throwing
  console.log('Grant check failed, assuming no grant exists')
}
```

## Advanced Configuration

### Window-Based Key Rotation

Stint implements automatic key rotation using time-based windows for enhanced security. This feature ensures that session signers automatically derive new private keys at regular intervals, limiting the impact of potential key compromise.

#### How Time Windows Work

Time windows are calculated using Unix epoch timestamps, ensuring deterministic key generation across different devices and sessions:

```typescript
// Create session signer with custom window settings
const sessionSigner = await newSessionSigner({
  primaryClient,
  saltName: 'my-app',
  
  // Key rotates every 8 hours for high-security applications
  stintWindowHours: 8,
  
  // Use previous window during transitions to avoid interruptions
  usePreviousWindow: false,
})
```

#### Window Configuration Options

Choose the rotation frequency based on your security requirements:

```typescript
// Maximum security - hourly rotation
const hourlyRotation = await newSessionSigner({
  primaryClient,
  stintWindowHours: 1,  // New key every hour
})

// High security - 8-hour rotation  
const eightHourRotation = await newSessionSigner({
  primaryClient,
  stintWindowHours: 8,  // New key every 8 hours
})

// Balanced security - daily rotation (default)
const dailyRotation = await newSessionSigner({
  primaryClient,
  stintWindowHours: 24, // New key every 24 hours (default)
})

// Convenience - weekly rotation
const weeklyRotation = await newSessionSigner({
  primaryClient,
  stintWindowHours: 168, // New key every week
})
```

#### Grace Period During Window Transitions

When users might be near a window boundary, use `usePreviousWindow: true` to access the previous time window's keys:

```typescript
// Check if we're near a window boundary
import { getWindowBoundaries } from 'stint-signer'

const boundaries = getWindowBoundaries(24) // 24-hour windows
const now = Date.now()
const timeUntilNextWindow = boundaries.end.getTime() - now
const oneHourMs = 60 * 60 * 1000

// If less than 1 hour until next window, use previous window for stability
const usePreviousWindow = timeUntilNextWindow < oneHourMs

const sessionSigner = await newSessionSigner({
  primaryClient,
  stintWindowHours: 24,
  usePreviousWindow, // Use previous window during transition periods
})
```

#### Debugging Window Boundaries

Use the `getWindowBoundaries` utility to inspect current window information:

```typescript
import { getWindowBoundaries } from 'stint-signer'

// Get current window information
const boundaries = getWindowBoundaries(24) // 24-hour windows

console.log('Window details:', {
  windowNumber: boundaries.windowNumber,
  start: boundaries.start.toISOString(),
  end: boundaries.end.toISOString(),
  timeRemaining: boundaries.end.getTime() - Date.now()
})

// Test different window sizes
const hourlyBounds = getWindowBoundaries(1)    // Hourly windows
const weeklyBounds = getWindowBoundaries(168)  // Weekly windows
```

#### Window-Based Authorization Strategy

With automatic key rotation, you may need to adjust your authorization strategy:

```typescript
// Strategy 1: Shorter authorizations aligned with key rotation
const sessionSigner = await newSessionSigner({
  primaryClient,
  stintWindowHours: 8, // 8-hour key rotation
})

// Set authorization to expire with the key rotation
const authMessages = sessionSigner.generateDelegationMessages({
  sessionExpiration: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours to match window
  spendLimit: { denom: 'uphoton', amount: '1000000' },
  gasLimit: { denom: 'uphoton', amount: '500000' },
})

// Strategy 2: Longer authorizations with key rotation for added security
const longerSessionSigner = await newSessionSigner({
  primaryClient,
  stintWindowHours: 24, // Daily key rotation
})

// Authorization lasts longer than key rotation for convenience
const longerAuthMessages = longerSessionSigner.generateDelegationMessages({
  sessionExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week
  spendLimit: { denom: 'uphoton', amount: '5000000' },
  gasLimit: { denom: 'uphoton', amount: '2000000' },
})
```

#### Security Benefits of Window-Based Rotation

- **Limited key lifetime**: Even if a key is compromised, it's only valid for the current window
- **Automatic rotation**: No manual intervention required for key updates
- **Deterministic**: Same device will always generate the same key for a given window
- **Backward compatibility**: Previous window access allows for graceful transitions
- **Configurable**: Adjust rotation frequency based on security requirements

### Custom Salt Names for Isolation

Use different salt names to create completely isolated session signers:

```typescript
// Production app
const prodSigner = await newSessionSigner({
  primaryClient,
  saltName: 'myapp-prod'
})

// Staging/testing  
const testSigner = await newSessionSigner({
  primaryClient,
  saltName: 'myapp-test'
})

// Feature-specific isolation
const tradingSigner = await newSessionSigner({
  primaryClient,
  saltName: 'myapp-trading'
})
```

### Conditional Authorization

Only create grants that don't already exist:

```typescript
// Check existing grants first
const [hasAuthz, hasFeegrant] = await Promise.all([
  sessionSigner.hasAuthzGrant(),
  sessionSigner.hasFeegrant()
])

if (!hasAuthz || !hasFeegrant) {
  // Only create missing grants
  const messages = sessionSigner.generateConditionalDelegationMessages({
    sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
    spendLimit: { denom: 'uphoton', amount: '1000000' },
    gasLimit: { denom: 'uphoton', amount: '500000' },
    allowedRecipients: ['atone1specific...']
  })
  
  if (messages.length > 0) {
    await primaryClient.signAndBroadcast(primaryAddress, messages, 'auto')
  }
}
```

## Security & Risks

> **⚠️ CRITICAL: This software has NOT been security audited. Use only for testing and experimentation.**

### Risks to Consider

#### High Spending Limits Without Recipient Restrictions

- **Risk**: Setting high `spendLimit` values without specifying `allowedRecipients` allows the session signer to send funds to ANY address
- **Impact**: If the session key is compromised, an attacker could drain funds up to the spending limit
- **Mitigation**: Always use `allowedRecipients` to restrict destinations, or keep spending limits minimal

#### Excessive Fee Allowances

- **Risk**: Setting very high `gasLimit` values can allow a compromised session signer to waste funds on transaction fees
- **Impact**: Malicious or buggy code could burn through your fee allowance unnecessarily
- **Mitigation**: Set reasonable gas limits based on expected usage patterns

#### Long Expiration Times

- **Risk**: Setting `sessionExpiration` far in the future increases the window of opportunity for attacks
- **Impact**: A compromised key remains dangerous for longer periods
- **Mitigation**: Use short expiration times (hours or days, not months) and renew as needed

#### Passkey Compromise

- **Risk**: If your device or passkey is compromised, the attacker can recreate your session signer
- **Impact**: They gain the same permissions you granted to the session signer
- **Mitigation**: Revoke session signers immediately if device security is compromised

#### Application-Level Vulnerabilities

- **Risk**: XSS, CSRF, or other web vulnerabilities could allow attackers to use your session signer
- **Impact**: Unauthorized transactions within your granted permissions
- **Mitigation**: Follow web security best practices and audit your application code

### Security Features

- **Session signers are ephemeral** and should be treated as temporary
- **Non-custodial with no funds at risk** - Session signers never hold any tokens, all gas is covered by feegrants
- **Configurable limits** - Set appropriate authorization limits and expiration times
- **Deterministic keys** - Private keys are derived deterministically from passkeys stored in secure hardware
- **Revocable** - Authorizations can be revoked at any time by the primary signer
- **Use testnets only** - Only use on testnets until this software has been thoroughly audited
- **Review code carefully** - Inspect all code before use in any environment with real value