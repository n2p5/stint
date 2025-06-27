// Minimal process polyfill for cosmjs compatibility
;(globalThis as any).process = {
  env: {},
  nextTick: (fn: () => void) => Promise.resolve().then(() => fn()),
  browser: true,
}

import { newSessionWallet, createStintSetup } from 'stint'

// State
let stintWallet: any = null

// UI Elements
const walletBtn = document.getElementById('connect-wallet') as HTMLButtonElement
const sessionBtn = document.getElementById('create-session') as HTMLButtonElement
const transactionBtn = document.getElementById('test-transaction') as HTMLButtonElement

const walletStatus = document.getElementById('wallet-status')!
const sessionStatus = document.getElementById('session-status')!
const transactionStatus = document.getElementById('transaction-status')!

// Helper function for test sending
async function testSessionSend() {
  try {
    transactionStatus.textContent = 'Sending transaction with session wallet...'
    transactionStatus.className = 'status'

    const primaryAddr = stintWallet.primaryAddress()
    const sessionAddr = stintWallet.sessionAddress()

    // Debug: Log addresses to check prefixes
    console.log('Primary address:', primaryAddr)
    console.log('Session address:', sessionAddr)

    // Use the session wallet to send a small amount
    const recipient = prompt('Enter recipient address (atone1...):', sessionAddr)
    if (!recipient) return

    // Validate recipient address has correct prefix
    if (!recipient.startsWith('atone1')) {
      throw new Error(
        `Recipient address must start with "atone1" for AtomOne testnet. Got: ${recipient}`
      )
    }

    const amount = prompt('Enter amount in uphoton (max 10000000):', '1000')
    if (!amount || parseInt(amount) > 10000000) {
      throw new Error('Invalid amount')
    }

    // Create an authz exec message
    const { MsgExec } = await import('cosmjs-types/cosmos/authz/v1beta1/tx')
    const { Any } = await import('cosmjs-types/google/protobuf/any')
    const { MsgSend } = await import('cosmjs-types/cosmos/bank/v1beta1/tx')

    const innerSendMsg = MsgSend.fromPartial({
      fromAddress: primaryAddr, // Funds come from primary wallet
      toAddress: recipient,
      amount: [{ denom: 'uphoton', amount }],
    })

    const execMsg = {
      typeUrl: '/cosmos.authz.v1beta1.MsgExec',
      value: MsgExec.fromPartial({
        grantee: sessionAddr,
        msgs: [
          Any.fromPartial({
            typeUrl: '/cosmos.bank.v1beta1.MsgSend',
            value: MsgSend.encode(innerSendMsg).finish(),
          }),
        ],
      }),
    }

    // Use the session wallet's client - gas will be paid by feegrant!
    const sessionClient = stintWallet.client
    const sessionFee = {
      amount: [{ denom: 'uphoton', amount: '5000' }],
      gas: '200000',
      granter: primaryAddr, // Feegrant pays the fees
    }

    const execResult = await sessionClient.signAndBroadcast(
      sessionAddr,
      [execMsg],
      sessionFee,
      'Stint session wallet transaction'
    )

    if (execResult.code !== 0) {
      throw new Error(`Transaction failed: ${execResult.rawLog}`)
    }

    transactionStatus.textContent = `✅ Session transaction successful!

Sent ${amount} uphoton to ${recipient}
Using authz from: ${primaryAddr}
Signed by session wallet: ${sessionAddr}

Transaction hash: ${execResult.transactionHash}

The session wallet signed this transaction without needing access to your primary wallet!
Gas was paid by the feegrant from the primary wallet! 🎉`
    transactionStatus.className = 'status success'
  } catch (error) {
    transactionStatus.textContent = `❌ Session transaction error: ${error}`
    transactionStatus.className = 'status error'
  }
}

// Wallet detection and connection
async function detectAndConnectWallet() {
  const chainId = 'atomone-testnet-1'

  // Try Keplr first
  if (window.keplr) {
    return await connectKeplr(chainId)
  }

  // Try Leap
  if (window.leap) {
    return await connectLeap(chainId)
  }

  // Try Cosmostation
  if (window.cosmostation) {
    return await connectCosmostation(chainId)
  }

  throw new Error('No supported Cosmos wallet found. Please install Keplr, Leap, or Cosmostation.')
}

async function connectKeplr(chainId: string) {
  // Add chain to Keplr if not already added
  try {
    await window.keplr.enable(chainId)
  } catch {
    // Chain not added, let's add it
    await window.keplr.experimentalSuggestChain({
      chainId: chainId,
      chainName: 'AtomOne Testnet',
      rpc: 'https://atomone-testnet-1-rpc.allinbits.services',
      rest: 'https://atomone-testnet-1-api.allinbits.services',
      bip44: {
        coinType: 118,
      },
      bech32Config: {
        bech32PrefixAccAddr: 'atone',
        bech32PrefixAccPub: 'atonepub',
        bech32PrefixValAddr: 'atonevaloper',
        bech32PrefixValPub: 'atonevaloperpub',
        bech32PrefixConsAddr: 'atonevalcons',
        bech32PrefixConsPub: 'atonevalconspub',
      },
      currencies: [
        {
          coinDenom: 'ATONE',
          coinMinimalDenom: 'uatone',
          coinDecimals: 6,
        },
      ],
      feeCurrencies: [
        {
          coinDenom: 'PHOTON',
          coinMinimalDenom: 'uphoton',
          coinDecimals: 6,
          gasPriceStep: {
            low: 0.001,
            average: 0.0025,
            high: 0.004,
          },
        },
      ],
      stakeCurrency: {
        coinDenom: 'ATONE',
        coinMinimalDenom: 'uatone',
        coinDecimals: 6,
      },
    })
    await window.keplr.enable(chainId)
  }

  const offlineSigner = window.keplr.getOfflineSigner(chainId)
  const accounts = await offlineSigner.getAccounts()

  return {
    name: 'Keplr',
    signer: offlineSigner,
    address: accounts[0].address,
  }
}

async function connectLeap(chainId: string) {
  await window.leap.enable(chainId)
  const offlineSigner = window.leap.getOfflineSigner(chainId)
  const accounts = await offlineSigner.getAccounts()

  return {
    name: 'Leap',
    signer: offlineSigner,
    address: accounts[0].address,
  }
}

async function connectCosmostation(chainId: string) {
  await window.cosmostation.providers.keplr.enable(chainId)
  const offlineSigner = window.cosmostation.providers.keplr.getOfflineSigner(chainId)
  const accounts = await offlineSigner.getAccounts()

  return {
    name: 'Cosmostation',
    signer: offlineSigner,
    address: accounts[0].address,
  }
}

// Step 1: Connect to Cosmos Wallet
walletBtn.addEventListener('click', async () => {
  try {
    walletStatus.textContent = 'Detecting and connecting to wallet...'
    walletStatus.className = 'status'

    const wallet = await detectAndConnectWallet()

    // Store the signer and address for later use
    window.primaryWalletSigner = wallet.signer
    window.primaryWalletAddress = wallet.address

    walletStatus.textContent = `✅ Connected to ${wallet.name}!\nAddress: ${wallet.address}`
    walletStatus.className = 'status success'

    sessionBtn.disabled = false
  } catch (error) {
    walletStatus.textContent = `❌ Error: ${error}`
    walletStatus.className = 'status error'
  }
})

// Step 2: Create Session Wallet
sessionBtn.addEventListener('click', async () => {
  try {
    sessionStatus.textContent =
      "Creating session wallet...\n\n👆 Please follow your browser's prompts to create/use a passkey.\nThis may include biometric authentication or device PIN."
    sessionStatus.className = 'status'

    if (!window.primaryWalletSigner || !window.primaryWalletAddress) {
      throw new Error('Please connect a Cosmos wallet first')
    }

    // First create a SigningStargateClient with the primary wallet
    const { SigningStargateClient } = await import('@cosmjs/stargate')
    const primaryClient = await SigningStargateClient.connectWithSigner(
      'https://atomone-testnet-1-rpc.allinbits.services',
      window.primaryWalletSigner,
      {
        gasPrice: {
          denom: 'uphoton',
          amount: { toString: () => '0.001', valueOf: () => 0.001 } as any,
        },
      }
    )

    // Create the complete Stint session (handles passkey + connection automatically)
    stintWallet = await newSessionWallet({
      primaryClient,
      saltName: 'stint-wallet',
    })

    const sessionAddr = stintWallet.sessionAddress()
    const primaryAddr = stintWallet.primaryAddress()

    sessionStatus.textContent = `✅ Session wallet created!
Session Address: ${sessionAddr}
Primary Address: ${primaryAddr}

Next steps would be:
1. Create authz grant and feegrant
2. Start transacting!`
    sessionStatus.className = 'status success'

    transactionBtn.disabled = false
  } catch (error) {
    sessionStatus.textContent = `❌ Error: ${error}`
    sessionStatus.className = 'status error'
  }
})

// Step 3: Setup Stint (Authz + Feegrant)
transactionBtn.addEventListener('click', async () => {
  try {
    transactionStatus.textContent = 'Setting up stint authorization and feegrant...'
    transactionStatus.className = 'status'

    if (!stintWallet || !window.primaryWalletSigner) {
      throw new Error('Missing prerequisites')
    }

    const primaryAddr = stintWallet.primaryAddress()
    const sessionAddr = stintWallet.sessionAddress()

    transactionStatus.textContent = `Checking existing authorizations...`

    // Connect to the chain with the primary wallet for broadcasting
    const offlineSigner = window.primaryWalletSigner

    // Import SigningStargateClient for primary wallet transactions
    const { SigningStargateClient } = await import('@cosmjs/stargate')

    const primaryClient = await SigningStargateClient.connectWithSigner(
      'https://atomone-testnet-1-rpc.allinbits.services',
      offlineSigner,
      {
        gasPrice: {
          denom: 'uphoton',
          amount: { toString: () => '0.001', valueOf: () => 0.001 } as any,
        },
      }
    )

    // Check if authz grant and feegrant already exist using wallet methods
    const authzGrantInfo = await stintWallet.hasAuthzGrant()
    const feegrantInfo = await stintWallet.hasFeegrant()

    const hasAuthzGrant = !!authzGrantInfo
    const hasFeegrant = !!feegrantInfo

    if (hasAuthzGrant && hasFeegrant) {
      transactionStatus.textContent = `✅ Authorizations already exist!

Existing authz grant: ${primaryAddr} → ${sessionAddr}
Existing feegrant: ${primaryAddr} → ${sessionAddr}

Session wallet is ready to use!`
      transactionStatus.className = 'status success'

      // Add the test send button
      const testSendBtn = document.createElement('button')
      testSendBtn.textContent = 'Test Session Send'
      testSendBtn.style.marginTop = '1rem'
      transactionStatus.appendChild(document.createElement('br'))
      transactionStatus.appendChild(testSendBtn)

      testSendBtn.addEventListener('click', testSessionSend)
      return
    }

    // Create stint setup (authz + feegrant) only if needed
    const stintSetup = await createStintSetup(stintWallet, {
      sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      spendLimit: { denom: 'uphoton', amount: '10000000' }, // 10 PHOTON spending limit
      gasLimit: { denom: 'uphoton', amount: '10000000' }, // 10 PHOTON gas limit
      // allowedRecipients: ['atone1abc...', 'atone1def...'], // Optional: restrict sends to specific addresses
    })

    const messagesToSend = []
    let statusText = 'Creating transaction with:\n'

    if (!hasAuthzGrant) {
      messagesToSend.push({
        typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
        value: stintSetup.authzGrant,
      })
      statusText += '- Authz grant: 10 PHOTON spending limit, 24h expiry\n'
    } else {
      statusText += '- Authz grant: ✅ Already exists\n'
    }

    if (!hasFeegrant) {
      messagesToSend.push({
        typeUrl: '/cosmos.feegrant.v1beta1.MsgGrantAllowance',
        value: stintSetup.feegrant,
      })
      statusText += '- Feegrant: 10 PHOTON gas limit, 24h expiry\n'
    } else {
      statusText += '- Feegrant: ✅ Already exists\n'
    }

    statusText += '\nBroadcasting...'
    transactionStatus.textContent = statusText

    // Only proceed if we have messages to send
    if (messagesToSend.length === 0) {
      transactionStatus.textContent = `✅ All authorizations already exist!

Authz grant: ✅ Already exists
Feegrant: ✅ Already exists

Session wallet is ready to use!`
      transactionStatus.className = 'status success'

      // Add the test send button
      const testSendBtn = document.createElement('button')
      testSendBtn.textContent = 'Test Session Send'
      testSendBtn.style.marginTop = '1rem'
      transactionStatus.appendChild(document.createElement('br'))
      transactionStatus.appendChild(testSendBtn)

      testSendBtn.addEventListener('click', testSessionSend)
      return
    }

    // Transaction: Main wallet grants authz + feegrant to session wallet
    transactionStatus.textContent += '\n\nSetting up stint with authz and feegrant...'

    const primaryGasEstimate = await primaryClient.simulate(primaryAddr, messagesToSend, '')
    const primaryFee = {
      amount: [{ denom: 'uphoton', amount: '10000' }],
      gas: Math.ceil(primaryGasEstimate * 1.5).toString(), // Increased buffer
    }

    const primaryResult = await primaryClient.signAndBroadcast(
      primaryAddr,
      messagesToSend,
      primaryFee,
      'Stint setup: authz + feegrant'
    )

    if (primaryResult.code !== 0) {
      throw new Error(`Stint setup transaction failed: ${primaryResult.events}`)
    }

    const result = { transactionHash: primaryResult.transactionHash, height: primaryResult.height }

    transactionStatus.textContent = `✅ Stint setup complete!

Transaction hash: ${result.transactionHash}
Height: ${result.height}

Session wallet ${sessionAddr} can now:
- Send up to 10 PHOTON using authz
- Use up to 10 PHOTON for gas fees (via feegrant)
- Does NOT hold any funds!

All gas fees and transactions are paid by: ${primaryAddr}

Try sending a transaction with the session wallet!`
    transactionStatus.className = 'status success'

    // Add a new button to test sending with session wallet
    const testSendBtn = document.createElement('button')
    testSendBtn.textContent = 'Test Session Send'
    testSendBtn.style.marginTop = '1rem'
    transactionStatus.appendChild(document.createElement('br'))
    transactionStatus.appendChild(testSendBtn)

    testSendBtn.addEventListener('click', testSessionSend)
  } catch (error) {
    transactionStatus.textContent = `❌ Error: ${error}`
    transactionStatus.className = 'status error'
  }
})

// Add TypeScript declarations for Cosmos wallets
declare global {
  interface Window {
    keplr?: any
    leap?: any
    cosmostation?: any
    primaryWalletSigner: any
    primaryWalletAddress: string
  }
}
