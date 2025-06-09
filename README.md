# stint

Short-lived, non-custodial session wallets for Cosmos SDK.

## Overview

Stint enables users to create ephemeral session wallets that can perform limited blockchain actions without requiring constant hardware wallet interaction. It uses WebAuthn Passkeys with PRF extension for key derivation and Cosmos SDK's authz module for secure delegation.

## Features

- 🔑 **Passkey-based key derivation** - Use WebAuthn PRF extension for deterministic key generation
- 🔐 **Non-custodial** - Users maintain full control of their funds
- ⚡ **Seamless UX** - Sign transactions without popups for authorized actions
- 🔄 **Bidirectional authorization** - Ensures funds can always be recovered
- 📦 **Framework agnostic** - Works with any JavaScript environment

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
import {
  createPasskeyCredential,
  derivePrivateKey,
  createSessionWallet,
  initStintWallet,
  createBidirectionalAuthz
} from 'stint'

// 1. Create a passkey and derive a private key
const credential = await createPasskeyCredential({
  rpId: window.location.hostname,
  rpName: 'My App',
  userName: 'user@example.com',
  userDisplayName: 'User'
})

const privateKey = await derivePrivateKey(credential.id)

// 2. Create session wallet
const sessionWallet = await createSessionWallet(privateKey, 'cosmos')

// 3. Initialize Stint with your main wallet
const stint = await initStintWallet({
  mainWallet: keplrOfflineSigner, // Your Keplr wallet
  sessionConfig: {
    chainId: 'cosmoshub-4',
    rpcEndpoint: 'https://rpc.cosmos.network',
    gasPrice: '0.025uatom'
    // For AtomOne testnet:
    // chainId: 'atomone-testnet-1',
    // rpcEndpoint: 'https://atomone-testnet-1-rpc.allinbits.services',
    // gasPrice: '0.001uatone'
  }
}, sessionWallet)

// 4. Set up bidirectional authorization
const { sessionToMainGrant, mainToSessionGrant, gasAmount } = 
  await createBidirectionalAuthz(stint, {
    sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000),
    spendLimit: { denom: 'uatom', amount: '1000000' }
  })

// 5. Broadcast the authorization setup with your main wallet
// (Implementation depends on your app)
```

## Examples

See the [examples](./examples) directory for complete working examples:

- [Basic Example](./examples/basic) - Simple browser demo with Keplr integration

## Development

```bash
# Install dependencies
pnpm install

# Build library
pnpm build

# Run in watch mode
pnpm dev

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format code
pnpm format
```

## How It Works

1. **Passkey Creation**: Uses WebAuthn to create a passkey with PRF extension
2. **Key Derivation**: Derives a deterministic private key from the passkey PRF output
3. **Session Wallet**: Creates an ephemeral wallet from the derived key
4. **Bidirectional Authz**:
   - Session wallet authorizes main wallet for unlimited withdrawals (recovery)
   - Main wallet authorizes session wallet for limited actions
5. **Gas Funding**: Main wallet sends gas funds to session wallet
6. **Usage**: Session wallet can now sign transactions within authorized limits

## Security Considerations

- Session wallets are ephemeral and should be treated as temporary
- Always set appropriate authorization limits and expiration times
- The bidirectional authz ensures users can always recover funds
- Private keys are derived deterministically from passkeys stored in secure hardware

## License

Unlicense (Public Domain)