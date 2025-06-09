# Stint Basic Example

This example demonstrates how to use Stint to create a session wallet with Keplr and AtomOne testnet.

## Prerequisites

- Keplr browser extension installed
- Some ATONE tokens on the AtomOne testnet for gas fees

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

3. Start the development server:
   ```bash
   pnpm dev
   ```

4. Open http://localhost:5173 in your browser

## How It Works

1. **Create Passkey**: Creates a WebAuthn passkey and derives a private key using PRF
2. **Connect Keplr**: Connects to your Keplr wallet and adds AtomOne testnet if needed
3. **Create Session**: Initializes a session wallet connected to AtomOne testnet
4. **Test Transaction**: Placeholder for implementing actual authz transactions

## AtomOne Testnet Details

- Chain ID: `atomone-testnet-1`
- RPC: https://atomone-testnet-1-rpc.allinbits.services
- REST API: https://atomone-testnet-1-api.allinbits.services
- Token: ATONE (uatone)
- Bech32 Prefix: `atone`

## Getting Testnet Tokens

You'll need ATONE testnet tokens to pay for gas. Check with the AtomOne community for faucet information.

## Next Steps

To complete the implementation, you would:

1. Use `createBidirectionalAuthz()` to create the authorization grants
2. Build and broadcast a transaction with both grants and gas funds
3. Use the session wallet to send authorized transactions

See the main library documentation for detailed implementation guidance.