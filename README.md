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
import {
  newSessionWallet,
  createStintSetup
} from 'stint'

// 1. Create complete session (handles everything automatically)
const wallet = await newSessionWallet({
  primaryWallet: yourCosmosWalletSigner, // Keplr, Leap, etc.
  prefix: 'cosmos',                      // optional, defaults to 'atom1'
  saltName: 'stint-wallet',              // optional, defaults to 'stint-wallet'
  sessionConfig: {
    chainId: 'cosmoshub-4',
    rpcEndpoint: 'https://rpc.cosmos.network',
    gasPrice: '0.025uatom'
  }
})

// 2. Create authz grant and feegrant setup
const stintSetup = await createStintSetup(wallet, {
  sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  spendLimit: { denom: 'uatom', amount: '1000000' }, // 1 ATOM spending limit
  gasLimit: { denom: 'uatom', amount: '500000' }      // 0.5 ATOM gas limit
})

// 3. Broadcast setup transaction with your primary wallet
const setupMessages = [
  {
    typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
    value: stintSetup.authzGrant,
  },
  {
    typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance', 
    value: stintSetup.feegrant,
  }
]

await primaryClient.signAndBroadcast(await wallet.primaryAddress(), setupMessages, fee)

// 4. Session wallet is now ready to transact!
const sessionAddress = await wallet.sessionAddress()
const primaryAddress = await wallet.primaryAddress()
// sessionAddress can now send transactions within authorized limits
// All gas fees are paid by the feegrant from your primary wallet
```

## Examples

See the [examples](./examples) directory for complete working examples:

- [Basic Example](./examples/basic) - Complete browser demo with multi-wallet support

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
```

## How It Works

1. **Passkey Creation**: Uses WebAuthn to create a passkey with PRF extension for your primary wallet address
2. **Key Derivation**: Derives a deterministic private key from the passkey PRF output using a configurable salt
3. **Session Wallet**: Creates an ephemeral wallet from the derived key that never holds funds
4. **Authorization Setup**: Creates both authz grant and feegrant in a single transaction:
   - **Authz Grant**: Primary wallet authorizes session wallet for specific actions (e.g., Send) with spending limits
   - **Feegrant**: Primary wallet grants fee allowance so session wallet can pay for gas
5. **Seamless Usage**: Session wallet can now sign and send transactions within authorized limits without any balance

## Multiple Session Wallets

You can create multiple session wallets for different purposes using salt names:

```typescript
// Default session wallet
const defaultWallet = await newSessionWallet({
  primaryWallet: signer,
  sessionConfig: config
})

// Trading-specific session wallet  
const tradingWallet = await newSessionWallet({
  primaryWallet: signer,
  saltName: 'trading',
  sessionConfig: config
})

// Gaming-specific session wallet
const gamingWallet = await newSessionWallet({
  primaryWallet: signer,
  saltName: 'gaming',
  sessionConfig: config
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
