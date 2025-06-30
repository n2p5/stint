# Stint

[![npm version](https://img.shields.io/npm/v/stint-signer.svg)](https://www.npmjs.com/package/stint-signer)
[![codecov](https://codecov.io/gh/n2p5/stint/graph/badge.svg)](https://codecov.io/gh/n2p5/stint)
[![Known Vulnerabilities](https://snyk.io/test/github/n2p5/stint/badge.svg)](https://snyk.io/test/github/n2p5/stint)

Short-lived, non-custodial, zero-balance passkey based session signers for the Cosmos SDK ecosystem.

> **⚠️ EXPERIMENTAL SOFTWARE WARNING**
>
> **This project is experimental and has NOT undergone a security audit.** Use at your own risk and only with funds you can afford to lose. Do not use in production environments or with significant amounts of cryptocurrency.

## Overview

Stint enables ephemeral session signers that can perform limited blockchain actions without requiring constant hardware wallet interaction. It uses Cosmos SDK's `authz` and `feegrant` modules combined with WebAuthn Passkeys for secure, deterministic key derivation.

## Features

- 🔑 **Passkey-based key derivation** - Uses WebAuthn PRF extension for deterministic, secure key generation
- 🔐 **Non-custodial** - Session signer's private key never leaves the client
- ⚡ **Seamless UX** - Sign transactions without hardware wallet popups for authorized actions  
- 🚀 **Zero balance required** - Session signer works without any token balance
- 🌐 **Multi-wallet support** - Works with Keplr, Leap, Cosmostation, and any Cosmos wallet

## Installation

```bash
npm install stint-signer
# or
pnpm add stint-signer
# or
yarn add stint-signer
```

## Quick Start

```typescript
import { newSessionSigner } from 'stint-signer'
import { SigningStargateClient } from '@cosmjs/stargate'

// 1. Create session signer
const sessionSigner = await newSessionSigner({
  primaryClient,  // Your existing SigningStargateClient
  saltName: 'my-app' // Optional: defaults to 'stint-session'
})

// 2. Generate authorization messages
const authorizedRecipient = 'atone1recipient123...'
const setupMessages = sessionSigner.generateDelegationMessages({
  sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  spendLimit: { denom: 'uphoton', amount: '1000000' },   // 1 PHOTON spending limit
  gasLimit: { denom: 'uphoton', amount: '500000' },      // 0.5 PHOTON gas limit
  allowedRecipients: [authorizedRecipient]               // Restrict to specific recipient
})

// 3. Broadcast setup transaction with your primary signer
const primaryAddress = sessionSigner.primaryAddress()
await primaryClient.signAndBroadcast(primaryAddress, setupMessages, 'auto')

// 4. Use session signer to send transactions!
await sessionSigner.client.sendTokens(
  sessionSigner.primaryAddress(), // Funds come from primary signer
  authorizedRecipient,           // Must match allowedRecipients
  [{ denom: 'uphoton', amount: '100000' }], // 0.1 PHOTON
  'auto',
  'Sent via session signer'
)
```

## API Reference

### `newSessionSigner(config)`

Creates a new session signer with passkey-based key derivation.

```typescript
const sessionSigner = await newSessionSigner({
  primaryClient: SigningStargateClient,  // Required: Your primary address's client
  saltName?: string,                     // Optional: Salt for key derivation
  logger?: Logger                        // Optional: Custom logger
})
```

### SessionSigner Methods

- `client`: SigningStargateClient for the session signer
- `primaryAddress()`: Get the primary signer address
- `sessionAddress()`: Get the session signer address  
- `generateDelegationMessages(config)`: Generate setup messages for authorization
- `generateConditionalDelegationMessages(config)`: Generate messages only for missing grants
- `hasAuthzGrant(messageType?)`: Check if authz grant exists
- `hasFeegrant()`: Check if feegrant exists
- `revokeDelegationMessages(msgTypeUrl?)`: Generate revocation messages

## Development

```bash
pnpm install       # Install dependencies
pnpm build         # Build library
pnpm dev           # Run in watch mode
pnpm test          # Run tests
pnpm typecheck     # Type check
pnpm lint          # Lint code
```

## Documentation

For advanced usage, examples, and detailed documentation, see the [Complete Guide](./docs/GUIDE.md).

## Examples

- [Dither Post Demo](./examples/dither-post-demo) - Full example of session signer creation with posting on Dither

## License

Unlicense (Public Domain)
