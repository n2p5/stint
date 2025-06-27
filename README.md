# Stint

Short-lived, non-custodial session wallets for the Cosmos SDK ecosystem.

## Overview

Stint enables users to create ephemeral session wallets that can perform limited blockchain actions without requiring constant hardware wallet interaction. The system uses Cosmos SDK's `authz` and `feegrant` modules combined with WebAuthn Passkeys for secure, deterministic key derivation.

## Key Concept

The system works by creating a **session wallet** that never holds funds but can transact on behalf of your main wallet:

1. **Passkey + PRF**: Creates a deterministic private key using WebAuthn Passkey with PRF extension
2. **Authz Grant**: Main wallet authorizes session wallet to perform specific actions (e.g., Send messages) with defined limits  
3. **Feegrant**: Main wallet grants fee allowance to session wallet, so it doesn't need to hold any funds for gas

## Features

- 🔑 **Passkey-based key derivation** - Uses WebAuthn PRF extension for deterministic, secure key generation
- 🔐 **Non-custodial** - Session wallets never hold funds, all gas is covered by feegrants
- ⚡ **Seamless UX** - Sign transactions without hardware wallet popups for authorized actions  
- 🚀 **Zero balance required** - Session wallets work without any token balance
- 🌐 **Multi-wallet support** - Works with Keplr, Leap, Cosmostation, and any Cosmos wallet
- 📦 **Framework agnostic** - Works in browsers and React Native environments

## Installation

```bash
npm install stint
# or
pnpm add stint
# or
yarn add stint
```

## Quick Start

```typescript
import { newSessionWallet } from 'stint'
import { SigningStargateClient } from '@cosmjs/stargate'

// 1. Create session wallet
const sessionWallet = await newSessionWallet({
  primaryClient,  // Your existing SigningStargateClient
  saltName: 'my-app' // optional, defaults to 'stint-wallet'
})

// 2. Check existing grants (optional)
const hasAuthz = await sessionWallet.hasAuthzGrant()
const hasFeegrant = await sessionWallet.hasFeegrant()

// 3. Generate ready-to-broadcast delegation messages
const authorizedRecipient = 'cosmos1recipient123...'
const setupMessages = sessionWallet.generateDelegationMessages({
  sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  spendLimit: { denom: 'uatom', amount: '1000000' },   // 1 ATOM spending limit (can be uatom or uphoton)
  gasLimit: { denom: 'uphoton', amount: '500000' },    // 0.5 PHOTON gas limit (must be uphoton in AtomOne)
  allowedRecipients: [authorizedRecipient] // Restrict to specific recipient only
})

// 4. Broadcast setup transaction with your primary wallet

const primaryAddress = sessionWallet.primaryAddress()
await primaryClient.signAndBroadcast(primaryAddress, setupMessages, 'auto')

// 5. Use session wallet to send transactions!
await sessionWallet.client.sendTokens(
  sessionWallet.primaryAddress(), // Funds come from primary wallet
  authorizedRecipient, // Must match allowedRecipients from step 3
  [{ denom: 'uatom', amount: '100000' }], // 0.1 ATOM
  'auto',
  'Sent via session wallet'
)
// ✅ Session wallet never held funds
// ✅ Gas fees automatically paid via feegrant  
// ✅ Transaction authorized within limits
```

## Complete Flow Example

Here's a complete example showing how to set up a session wallet and send a transaction on behalf of the primary wallet:

```typescript
import { newSessionWallet } from 'stint'
import { SigningStargateClient } from '@cosmjs/stargate'

async function stintExample() {
  // 1. Create session wallet (triggers passkey creation/authentication)
  const sessionWallet = await newSessionWallet({
    primaryClient,  // Your existing SigningStargateClient
    saltName: 'my-app-trading'  // Optional: creates isolated session wallet
  })

  const primaryAddress = sessionWallet.primaryAddress()
  const sessionAddress = sessionWallet.sessionAddress()
  
  console.log(`Primary wallet: ${primaryAddress}`)
  console.log(`Session wallet: ${sessionAddress}`)

  // 2. Check if authorizations already exist (optional)
  const existingAuthz = await sessionWallet.hasAuthzGrant()
  const existingFeegrant = await sessionWallet.hasFeegrant()
  
  // 3. Define authorized recipient for restrictions
  const authorizedRecipient = 'cosmos1isolatedaccountxyz123...'
  
  if (!existingAuthz || !existingFeegrant) {
    // Generate ready-to-broadcast authorization messages with account scope restriction
    const setupMessages = sessionWallet.generateDelegationMessages({
      sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      spendLimit: { denom: 'uphoton', amount: '500000' }, // Max 0.5 PHOTON for sending
      gasLimit: { denom: 'uphoton', amount: '500000' },  // 0.5 PHOTON for gas
      allowedRecipients: [authorizedRecipient] // Restrict to specific recipient
    // 4. Authorize with primary wallet (ready-to-broadcast messages)
    })

    // 4. Authorize with primary wallet (ready-to-broadcast messages)
    console.log('Setting up session wallet authorizations...')
    const setupResult = await primaryClient.signAndBroadcast(
      primaryAddress, 
      setupMessages, 
      'auto'
    )
    
    console.log('Setup successful:', setupResult.transactionHash)
  } else {
    console.log('Session wallet already authorized!')
  }

  // 5. Use session wallet client to send funds on behalf of primary wallet
  const sendAmount = [{ denom: 'uatom', amount: '500000' }] // 0.5 ATOM (within limits)

  console.log('Sending transaction via session wallet...')
  
  // Session wallet client sends funds with memo (gas fees automatically covered by feegrant)
  const sendResult = await sessionWallet.client.sendTokens(
    sessionWallet.primaryAddress(), // Funds come from primary wallet
    authorizedRecipient, // Must match allowedRecipients from authorization
    sendAmount,
    'auto',
    'Sent via Stint session wallet 🚀' // Optional memo
  )

  console.log('Transaction successful:', sendResult.transactionHash)
  console.log('Funds transferred from primary to isolated account!')

  // The session wallet:
  // ✅ Never held any funds
  // ✅ Sent transaction on behalf of primary wallet  
  // ✅ Gas fees automatically paid from primary wallet via feegrant
  // ✅ Restricted to authorized recipient only
  // ✅ Limited to authorized spending amount
}

// Run the example
stintExample().catch(console.error)
```

### Key Benefits Demonstrated

- **Zero-balance operation**: Session wallet never needs funds
- **Automatic gas payment**: Feegrant covers all transaction fees
- **Scope restrictions**: Limited to specific recipients and amounts
- **Seamless UX**: No hardware wallet popups after initial setup
- **Security**: Passkey-based deterministic key derivation
- **Revocable**: Primary wallet maintains full control

## Examples

See the [examples](./examples) directory for complete working examples:

- [Basic Example](./examples/basic) - Complete browser demo with multi-wallet support
- [Dither Post Demo](./examples/dither-post-demo) - Modern UI with DaisyUI components

## Development

```bash
# Install dependencies
pnpm install

# Build library
pnpm build

# Run in watch mode
pnpm dev

# Run example with hot reload
pnpm dev:example

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format code
pnpm format

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests with UI
pnpm test:ui
```

## How It Works

1. **Passkey Creation**: Uses WebAuthn to create a passkey with PRF extension linked to your primary wallet address
2. **Key Derivation**: Derives a deterministic private key from the passkey PRF output using a configurable salt
3. **Session Wallet**: Creates an ephemeral wallet from the derived key that never holds funds
4. **Authorization Setup**: Creates both authz grant and feegrant in a single transaction:
   - **Authz Grant**: Primary wallet authorizes session wallet for specific actions (e.g., Send) with spending limits
   - **Feegrant**: Primary wallet grants fee allowance so session wallet can pay for gas
5. **Seamless Usage**: Session wallet can now sign and send transactions within authorized limits without any balance

## API Reference

### `newSessionWallet(config)`

Creates a new session wallet with passkey-based key derivation.

```typescript
const wallet = await newSessionWallet({
  primaryClient: SigningStargateClient,  // Required: Your primary wallet's client
  saltName?: string                      // Optional: Salt for key derivation (default: 'stint-wallet')
})
```

Returns a `SessionWallet` object with these methods:

- `client`: SigningStargateClient for the session wallet (main interface for transactions)
- `primaryAddress()`: Get the primary wallet address
- `sessionAddress()`: Get the session wallet address  
- `generateDelegationMessages(config)`: Generate setup messages for authorization
- `hasAuthzGrant(messageType?)`: Check if authz grant exists
- `hasFeegrant()`: Check if feegrant exists
- `revokeDelegationMessages(msgTypeUrl?)`: Generate revocation messages (optional)

### Wallet Methods

#### `sessionWallet.generateDelegationMessages(config)`

Generates ready-to-broadcast authz grant and feegrant messages to delegate authority to the session wallet.

```typescript
const messages = sessionWallet.generateDelegationMessages({
  sessionExpiration?: Date,              // When the grants expire
  spendLimit?: { denom: string, amount: string },  // Max amount session wallet can spend (uatom or uphoton)
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

#### `sessionWallet.revokeDelegationMessages(msgTypeUrl?)`

Generates ready-to-broadcast messages to revoke the delegated authority.

```typescript
const messages = sessionWallet.revokeDelegationMessages(
  '/cosmos.bank.v1beta1.MsgSend'  // Optional: message type to revoke (default: MsgSend)
)

// messages is an array ready for signAndBroadcast:
await primaryClient.signAndBroadcast(primaryAddress, messages, 'auto')
```

## Multiple Session Wallets

You can create multiple session wallets for different purposes using salt names:

```typescript
// Default session wallet
const defaultWallet = await newSessionWallet({
  primaryClient,
})

// Trading-specific session wallet  
const tradingWallet = await newSessionWallet({
  primaryClient,
  saltName: 'trading',
})

// Gaming-specific session wallet
const gamingWallet = await newSessionWallet({
  primaryClient,
  saltName: 'gaming',
})
```

Each salt creates a completely different private key from the same passkey.

## Security Considerations

- **Session wallets are ephemeral** and should be treated as temporary
- **No funds at risk** - Session wallets never hold any tokens, all gas is covered by feegrants
- **Configurable limits** - Set appropriate authorization limits and expiration times
- **Deterministic keys** - Private keys are derived deterministically from passkeys stored in secure hardware
- **Revocable** - Authorizations can be revoked at any time by the primary wallet

## License

Unlicense (Public Domain)
