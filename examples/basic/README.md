# Stint Basic Example

A complete browser demonstration of Stint's session wallet functionality using AtomOne testnet. This example shows how to create ephemeral wallets that can transact without holding any funds, powered by Cosmos SDK's authz and feegrant modules.

## What This Demo Shows

- **Multi-wallet support** - Auto-detects and connects to Keplr, Leap, or Cosmostation
- **Passkey integration** - Creates deterministic session wallets using WebAuthn passkeys  
- **Zero-balance transactions** - Session wallets that never hold funds but can still transact
- **Smart authorization** - Checks for existing grants to avoid duplicate setup
- **Complete transaction flow** - From setup to sending real transactions

## Prerequisites

- A Cosmos wallet browser extension (Keplr, Leap, or Cosmostation)
- Some PHOTON tokens on AtomOne testnet for gas fees
- A device that supports WebAuthn (most modern browsers)

## Getting Started

1. From the repository root:

   ```bash
   pnpm install
   pnpm build
   ```

2. Navigate to this example:

   ```bash
   cd examples/basic
   pnpm install
   ```

3. Start the development server with hot reload:

   ```bash
   pnpm dev
   ```

   This will start both the library watch mode (rebuilds on changes) and the Vite dev server.

   Alternative development modes:
   - `pnpm dev:fast` - Only start Vite (faster, but manual library rebuilds needed)
   - From root: `pnpm dev:example` - Same as `pnpm dev` but run from workspace root

4. Open <http://localhost:5173> in your browser

## How It Works

### Step 1: Connect Primary Wallet

- Auto-detects available Cosmos wallets (Keplr, Leap, Cosmostation)
- Connects to AtomOne testnet (adds chain configuration if needed)
- Shows your primary wallet address

### Step 2: Create Session Wallet

- Prompts for WebAuthn passkey creation/authentication
- Uses PRF extension to derive a deterministic private key
- Creates an ephemeral session wallet that never holds funds
- Shows both primary and session wallet addresses

### Step 3: Setup Authorization & Feegrant

- Checks if authz grants and feegrants already exist (avoids duplicates)
- Creates authorization for session wallet to send up to 1 PHOTON
- Creates feegrant so session wallet can pay gas fees from your primary wallet
- **Key insight**: Session wallet can transact without any token balance!

### Step 4: Test Transaction

- Send PHOTON tokens using the session wallet
- All gas fees are automatically paid by the feegrant
- Transaction is authorized via authz from your primary wallet
- Demonstrates seamless UX without hardware wallet popups

## Key Technical Features

### Simplified API

Session wallet creation now handles passkey management automatically:

```typescript
// Just one function call creates everything
const stintWallet = await newSessionWallet({
  primaryWallet: signer,
  primaryAddress: primaryAddress,
  prefix: 'atone',
  sessionConfig: { chainId, rpcEndpoint, gasPrice }
})
```

### Multiple Session Wallets

Create different session wallets for different purposes:

```typescript
const defaultWallet = await newSessionWallet({ ...config }) // default
const tradingWallet = await newSessionWallet({ ...config, saltName: 'trading' }) // trading scope
```

### Smart Duplicate Prevention

The example automatically detects existing authorizations and skips redundant setup, making it safe to run multiple times.

### Multi-Wallet Compatibility

Works with any Cosmos wallet that provides a standard `OfflineSigner` interface.

## AtomOne Testnet Details

- Chain ID: `atomone-testnet-1`
- RPC: <https://atomone-testnet-1-rpc.allinbits.services>
- REST API: <https://atomone-testnet-1-api.allinbits.services>
- Staking Token: ATONE (uatone)
- Fee Token: PHOTON (uphoton)
- Bech32 Prefix: `atone`

## Getting Testnet Tokens

You'll need PHOTON testnet tokens to pay for gas. Check with the AtomOne community for faucet information.

## What Makes This Special

This isn't just another wallet connection demo. This example demonstrates a fundamentally new UX pattern:

🔹 **Zero-balance wallets that work** - Session wallets never hold funds but can still send transactions  
🔹 **No hardware wallet fatigue** - Users approve once, transact seamlessly afterwards  
🔹 **Deterministic keys from biometrics** - Same passkey always generates the same session wallet  
🔹 **Revocable permissions** - Primary wallet maintains full control and can revoke at any time  
🔹 **Gas-free for users** - All transaction fees are automatically covered by feegrants  

## Real-World Applications

This pattern enables new types of applications:

- **Social apps** - Like posts without signing popups
- **Gaming** - Seamless in-game transactions  
- **DeFi** - Automated trading bots with spending limits
- **Content platforms** - Microtransactions without friction

The session wallet paradigm removes the biggest UX barriers in Web3 while maintaining security and user control.
