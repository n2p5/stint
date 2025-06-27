# Stint Dither Post Demo

A clean, modern demo of Stint session signers built with SvelteKit and DaisyUI.

> **⚠️ EXPERIMENTAL SOFTWARE - TESTNET ONLY**
> 
> This is a demonstration of experimental software that has NOT been security audited. Only use on testnets with test tokens that have no real value. Do not use with real funds or in production environments.

## Features

- 🎨 **Modern UI** with DaisyUI components
- 🧩 **Modular Components** for wallet connection, session signer creation, authorization, and transactions
- 📱 **Responsive Design** that works on desktop and mobile
- 🔧 **Type Safety** with full TypeScript support
- ⚡ **Fast Development** with SvelteKit hot reload

## Getting Started

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Start development server:**
   ```bash
   pnpm dev
   ```

3. **Open browser:**
   Navigate to http://localhost:5173

## How to Use

1. **Connect Wallet** - Connect Keplr, Leap, or Cosmostation (primary signer)
2. **Create Session Signer** - Generate a session signer using WebAuthn Passkey
3. **Create Authorization** - Set up authz grants and feegrants from primary to session signer
4. **Send Transaction** - Use the session signer to send transactions on behalf of primary address

## Project Structure

```
src/
├── lib/
│   ├── components/        # Svelte components
│   │   ├── WalletConnect.svelte
│   │   ├── SessionSigner.svelte
│   │   ├── Authorization.svelte
│   │   └── Transaction.svelte
│   ├── stores/           # Svelte stores
│   │   └── session.ts
│   └── utils/            # Utilities
│       ├── wallets.ts
│       └── polyfill.ts
├── routes/               # SvelteKit routes
│   ├── +layout.svelte
│   └── +page.svelte
└── app.css              # Global styles
```

## Technologies Used

- **SvelteKit** - Full-stack web framework
- **DaisyUI** - Tailwind CSS component library
- **TypeScript** - Type safety
- **Stint Signer** - Session signer library
- **CosmJS** - Cosmos SDK JavaScript library

## Build for Production

```bash
pnpm build
```

This will create a static build in the `build/` directory that can be served by any static hosting provider.