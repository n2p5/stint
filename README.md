# Stint

[![npm version](https://img.shields.io/npm/v/stint-signer.svg)](https://www.npmjs.com/package/stint-signer)
[![codecov](https://codecov.io/gh/n2p5/stint/graph/badge.svg)](https://codecov.io/gh/n2p5/stint)
[![Known Vulnerabilities](https://snyk.io/test/github/n2p5/stint/badge.svg)](https://snyk.io/test/github/n2p5/stint)

**Zero-balance session signers for smooth Web3 UX.** Post, vote, and transact without wallet popups using Passkeys + Cosmos SDK authz + feegrant modules.

> **⚠️ EXPERIMENTAL SOFTWARE - TESTNET ONLY**
>
> **This project is experimental and has NOT undergone a security audit.** Only use on testnets with test tokens that have no real value. Do not use with real funds or in production environments.

## What is Stint?

Stint creates **temporary signers** that can perform limited actions on behalf of your main wallet without holding any funds. Perfect for social dApps, games, and frequent interactions.

**How it works:**

1. **Create a session signer** using your device's Passkey (fingerprint/Face ID)
2. **Authorize specific actions** (like posting to social networks) with spending limits
3. **Interact seamlessly** - no more wallet popups for every small transaction

Your main wallet stays secure, session signers are time-limited, and you can revoke access anytime.

## Why Use Stint?

Perfect for apps that need frequent, small transactions:

### 🌐 **Social Media dApps**

- Post messages without wallet popups
- Like/react to content instantly
- Comment and interact seamlessly

### 🎮 **Gaming & NFTs**

- In-game transactions and trades
- Achievement claims and rewards
- Tournament entries

### 🗳️ **DAOs & Governance**  

- Vote on multiple proposals
- Delegate voting power
- Submit proposals without friction

### 💰 **Micro-payments**

- Content tips and donations
- Subscription payments
- Pay-per-use services

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

// 1. Create session signer (triggers Passkey prompt)
const sessionSigner = await newSessionSigner({
  primaryClient  // Your existing SigningStargateClient
})

// 2. Define authorized recipient for security
const authorizedRecipient = 'atone1dither123...' // Only allow sends to this address

// 3. Set up permissions (one-time setup)
const setupMessages = sessionSigner.generateDelegationMessages({
  sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  spendLimit: { denom: 'uphoton', amount: '1000000' },   // Max 1 PHOTON
  gasLimit: { denom: 'uphoton', amount: '500000' },      // 0.5 PHOTON for gas
  allowedRecipients: [authorizedRecipient]              // Restrict to specific address
})

await primaryClient.signAndBroadcast(
  sessionSigner.primaryAddress(), 
  setupMessages, 
  'auto'
)

// 4. Now send transactions instantly! 🚀
await sessionSigner.execute.send({
  toAddress: authorizedRecipient,  // Must match allowedRecipients
  amount: [{ denom: 'uphoton', amount: '100000' }],
  memo: 'Posted via session signer!'
})
```

**That's it!** No more wallet popups for authorized transactions.

## Live Example

🎯 **[Try the Dither Demo](./examples/dither-post-demo)** - Post to a decentralized social network without wallet popups!

The demo shows how to:

- Create session signers with WebAuthn Passkeys  
- Set up permissions in one transaction
- Post messages instantly using session signers

## Basic API

### Creating a Session Signer

```typescript
import { newSessionSigner } from 'stint-signer'

const sessionSigner = await newSessionSigner({
  primaryClient,              // Your SigningStargateClient
  saltName?: 'my-app',       // Optional: isolate different apps
  logger?: consoleLogger     // Optional: enable debug logs
})
```

### Setting Up Permissions

```typescript
// Generate permission messages
const messages = sessionSigner.generateDelegationMessages({
  sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  spendLimit: { denom: 'uphoton', amount: '1000000' },   // Max spending
  gasLimit: { denom: 'uphoton', amount: '500000' },      // Gas allowance
  allowedRecipients: ['atone1...']  // Optional: restrict recipients
})

// Sign with your main wallet (one time)
await primaryClient.signAndBroadcast(primaryAddress, messages, 'auto')
```

### Using Session Signers

```typescript
// Send tokens instantly (no wallet popup!)
await sessionSigner.execute.send({
  toAddress: 'atone1recipient...',
  amount: [{ denom: 'uphoton', amount: '100000' }],
  memo: 'Instant transaction!'
})

// Check permissions
const hasPermission = await sessionSigner.hasAuthzGrant()
const hasGasAllowance = await sessionSigner.hasFeegrant()
```

## Learn More

📖 **[Complete Guide](./docs/GUIDE.md)** - Advanced usage, security considerations, and detailed examples

🎯 **[Example App](./examples/dither-post-demo)** - Full working demo with Dither social network

## Key Features

✅ **Zero-balance signers** - Session signers never hold funds

✅ **Passkey security** - Uses device biometrics for key derivation

✅ **Time-limited** - Sessions expire automatically

✅ **Revocable** - Cancel permissions anytime

✅ **Scoped permissions** - Limit spending, recipients, and actions

✅ **Multi-wallet support** - Works with Keplr, Leap, Cosmostation


## License

Unlicense (Public Domain)
