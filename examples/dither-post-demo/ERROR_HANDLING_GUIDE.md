# Error Handling and Logging Guide

This example demonstrates comprehensive error handling and logging with the Stint library.

## Logger Implementation

The example uses Stint's built-in `consoleLogger` that provides:

1. **Console Logging**: Structured console output with `[Stint]` prefix
2. **All Log Levels Visible**: Debug messages use `console.log()` for visibility
3. **Structured Context**: Rich context data for debugging

### Usage Examples

```typescript
import { consoleLogger } from 'stint-signer';

// Basic logging
consoleLogger.info('Operation started', { userId: 'abc123' });
consoleLogger.error('Operation failed', error, { context: 'additional data' });

// Pass logger to newSessionSigner
const sessionSigner = await newSessionSigner({
  primaryClient,
  logger: consoleLogger
});
```

## Error Handling Patterns

### 1. Session Signer Creation (SessionSigner.svelte)

**Features:**
- Custom error messages based on `StintError` error codes
- Progress status updates during passkey operations
- Comprehensive error logging with context

**Error Types Handled:**
- `WEBAUTHN_NOT_SUPPORTED`: Browser compatibility issues
- `USER_CANCELLED`: User cancelled passkey prompt
- `PRF_NOT_SUPPORTED`: Authenticator doesn't support PRF extension
- `PASSKEY_CREATION_FAILED`: Passkey creation errors

### 2. Authorization Management (Authorization.svelte)

**Features:**
- Non-blocking error handling for authorization checks
- Detailed transaction logging with gas usage
- Balance validation with user-friendly error messages

**Key Improvements:**
- Silent failures replaced with proper logging
- Transaction success/failure with detailed context
- Authorization status logging with expiration dates

### 3. Transaction Broadcasting (Transaction.svelte)

**Features:**
- Step-by-step transaction construction logging
- Comprehensive validation with specific error messages
- Detailed broadcast logging with gas metrics

**Logging Points:**
- Module loading
- Message construction (MsgSend → MsgExec)
- Transaction broadcast parameters
- Success metrics (gas used, transaction hash, events)

## Error Code Reference

| Error Code | Description | User Action |
|------------|-------------|-------------|
| `WEBAUTHN_NOT_SUPPORTED` | Browser doesn't support WebAuthn | Use modern browser |
| `USER_CANCELLED` | User cancelled passkey prompt | Retry operation |
| `PRF_NOT_SUPPORTED` | Authenticator lacks PRF extension | Try different authenticator |
| `PASSKEY_CREATION_FAILED` | Passkey creation failed | Check authenticator/try again |
| `SIGNER_EXTRACTION_FAILED` | Cannot access wallet signer | Check wallet connection |
| `RPC_URL_EXTRACTION_FAILED` | Cannot get RPC endpoint | Check client configuration |

## Debugging Tips

### 1. Enable Detailed Logging

Open browser console to see all Stint operations:

```
[Stint] Initializing session signer
[Stint] Starting passkey derivation
[Stint] Session signer created successfully!
```

### 2. Authorization Debugging

Check authorization status with detailed context:

```javascript
// Console output shows:
{
  hasAuthzGrant: true,
  hasFeegrant: true,
  authzExpiration: "2024-01-02T12:00:00.000Z",
  feegrantExpiration: "2024-01-02T12:00:00.000Z"
}
```

### 3. Transaction Debugging

Monitor transaction construction and broadcast:

```javascript
// Transaction preparation
{ recipient: "atone1...", amount: 100000, memo: "Post to Dither..." }

// MsgExec construction
{ grantee: "atone1abc...", msgType: "/cosmos.bank.v1beta1.MsgSend" }

// Broadcast parameters
{ 
  signer: "atone1abc...",
  feeGranter: "atone1def...",
  gasLimit: "200000",
  feeAmount: [{ denom: "uphoton", amount: "5000" }]
}

// Success metrics
{
  transactionHash: "0x123...",
  gasUsed: 145000,
  gasWanted: 200000,
  height: 12345,
  events: 8
}
```

## Production Considerations

### 1. Logger Configuration

For production, consider using a no-op logger or sending logs to a monitoring service:

```typescript
import { noopLogger, consoleLogger } from 'stint-signer';

const sessionSigner = await newSessionSigner({
  primaryClient,
  logger: process.env.NODE_ENV === 'production' ? noopLogger : consoleLogger
});
```

### 2. Error Monitoring

Integrate with error monitoring services:

```typescript
import * as Sentry from '@sentry/browser';
import { Logger } from 'stint-signer';

const productionLogger: Logger = {
  debug: (message, context) => {
    // Skip debug logs in production
  },
  info: (message, context) => {
    console.info(`[Stint] ${message}`, context);
  },
  warn: (message, context) => {
    console.warn(`[Stint] ${message}`, context);
    Sentry.captureMessage(message, 'warning');
  },
  error: (message, error, context) => {
    console.error(`[Stint] ${message}`, error, context);
    Sentry.captureException(error || new Error(message), {
      tags: { component: 'stint' },
      extra: context
    });
  }
};
```

### 3. Security Considerations

- Never log sensitive data (private keys, mnemonics)
- Sanitize user inputs before logging
- Use structured logging for better analysis
- Consider log retention policies

## Testing Error Scenarios

1. **Disconnect wallet** during session creation
2. **Cancel passkey prompt** to test user cancellation
3. **Use incompatible browser** to test WebAuthn support
4. **Insufficient balance** to test balance validation
5. **Invalid recipient address** to test validation

This comprehensive error handling makes the application much more debuggable and user-friendly!