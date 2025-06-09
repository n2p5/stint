import {
  createPasskeyCredential,
  derivePrivateKey,
  createSessionWallet,
  initStintWallet,
  createBidirectionalAuthz,
  getSessionAddress,
  getMainAddress,
} from 'stint'

// State
let passkeyCredentialId: string | null = null
let sessionPrivateKey: string | null = null
let stintWallet: any = null

// UI Elements
const passkeyBtn = document.getElementById('create-passkey') as HTMLButtonElement
const keplrBtn = document.getElementById('connect-keplr') as HTMLButtonElement
const sessionBtn = document.getElementById('create-session') as HTMLButtonElement
const transactionBtn = document.getElementById('test-transaction') as HTMLButtonElement

const passkeyStatus = document.getElementById('passkey-status')!
const walletStatus = document.getElementById('wallet-status')!
const sessionStatus = document.getElementById('session-status')!
const transactionStatus = document.getElementById('transaction-status')!

// Step 1: Create Passkey
passkeyBtn.addEventListener('click', async () => {
  try {
    passkeyStatus.textContent = 'Creating passkey...'
    passkeyStatus.className = 'status'

    const credential = await createPasskeyCredential({
      rpId: window.location.hostname,
      rpName: 'Stint Demo',
      userName: 'demo-user',
      userDisplayName: 'Demo User',
    })

    passkeyCredentialId = credential.id
    sessionPrivateKey = await derivePrivateKey(credential.id)

    passkeyStatus.textContent = `✅ Passkey created!\nCredential ID: ${credential.id}\nDerived key ready.`
    passkeyStatus.className = 'status success'
    
    keplrBtn.disabled = false
  } catch (error) {
    passkeyStatus.textContent = `❌ Error: ${error}`
    passkeyStatus.className = 'status error'
  }
})

// Step 2: Connect Keplr
keplrBtn.addEventListener('click', async () => {
  try {
    walletStatus.textContent = 'Connecting to Keplr...'
    walletStatus.className = 'status'

    if (!window.keplr) {
      throw new Error('Keplr extension not found')
    }

    // Using AtomOne testnet
    const chainId = 'atomone-testnet-1'
    
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
            coinDenom: 'ATONE',
            coinMinimalDenom: 'uatone',
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

    walletStatus.textContent = `✅ Connected to Keplr!\nAddress: ${accounts[0].address}`
    walletStatus.className = 'status success'

    // Store the signer for later use
    window.mainWalletSigner = offlineSigner
    sessionBtn.disabled = false
  } catch (error) {
    walletStatus.textContent = `❌ Error: ${error}`
    walletStatus.className = 'status error'
  }
})

// Step 3: Create Session Wallet
sessionBtn.addEventListener('click', async () => {
  try {
    sessionStatus.textContent = 'Creating session wallet...'
    sessionStatus.className = 'status'

    if (!sessionPrivateKey || !window.mainWalletSigner) {
      throw new Error('Missing prerequisites')
    }

    // Create the session wallet from the derived private key
    const sessionWallet = await createSessionWallet(sessionPrivateKey, 'atone')

    // Initialize stint wallet
    stintWallet = await initStintWallet(
      {
        mainWallet: window.mainWalletSigner,
        sessionConfig: {
          chainId: 'atomone-testnet-1',
          rpcEndpoint: 'https://atomone-testnet-1-rpc.allinbits.services',
          gasPrice: '0.001uatone',
        },
      },
      sessionWallet
    )

    const sessionAddr = await getSessionAddress(stintWallet)
    const mainAddr = await getMainAddress(stintWallet)

    sessionStatus.textContent = `✅ Session wallet created!
Session Address: ${sessionAddr}
Main Address: ${mainAddr}

Next steps would be:
1. Create bidirectional authz grants
2. Send gas funds to session wallet
3. Start transacting!`
    sessionStatus.className = 'status success'

    transactionBtn.disabled = false
  } catch (error) {
    sessionStatus.textContent = `❌ Error: ${error}`
    sessionStatus.className = 'status error'
  }
})

// Step 4: Setup Bidirectional Authz
transactionBtn.addEventListener('click', async () => {
  try {
    transactionStatus.textContent = 'Setting up bidirectional authorization...'
    transactionStatus.className = 'status'

    if (!stintWallet || !window.keplr) {
      throw new Error('Missing prerequisites')
    }

    // Create bidirectional authz configuration
    const authzSetup = await createBidirectionalAuthz(stintWallet, {
      sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      spendLimit: { denom: 'uatone', amount: '1000000' } // 1 ATONE spending limit
    })

    const mainAddr = await getMainAddress(stintWallet)
    const sessionAddr = await getSessionAddress(stintWallet)

    transactionStatus.textContent = `Creating transaction with:
- Session → Main grant (recovery)
- Main → Session grant (1 ATONE limit, 24h expiry)
- Gas funds: ${authzSetup.gasAmount.amount} ${authzSetup.gasAmount.denom}

Broadcasting...`

    // Connect to the chain with Keplr for broadcasting
    const chainId = 'atomone-testnet-1'
    const offlineSigner = window.keplr.getOfflineSigner(chainId)
    
    // Import SigningStargateClient for main wallet transactions
    const { SigningStargateClient } = await import('@cosmjs/stargate')
    const { MsgSend } = await import('cosmjs-types/cosmos/bank/v1beta1/tx')
    const { TxRaw } = await import('cosmjs-types/cosmos/tx/v1beta1/tx')
    
    const mainClient = await SigningStargateClient.connectWithSigner(
      'https://atomone-testnet-1-rpc.allinbits.services',
      offlineSigner,
      {
        gasPrice: {
          denom: 'uatone',
          amount: { toString: () => '0.001', valueOf: () => 0.001 } as any
        }
      }
    )

    // Create the send message for gas funds
    const sendMsg = {
      typeUrl: '/cosmos.bank.v1beta1.MsgSend',
      value: MsgSend.fromPartial({
        fromAddress: mainAddr,
        toAddress: sessionAddr,
        amount: [authzSetup.gasAmount],
      }),
    }

    // Transaction 1: Main wallet grants session wallet + sends gas funds (combined)
    transactionStatus.textContent += '\n\nStep 1: Main wallet grants authorization and sends gas funds...'
    
    const mainMessages = [
      {
        typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
        value: authzSetup.mainToSessionGrant,
      },
      sendMsg,
    ]

    const mainGasEstimate = await mainClient.simulate(mainAddr, mainMessages, '')
    const mainFee = {
      amount: [{ denom: 'uatone', amount: '3000' }],
      gas: Math.ceil(mainGasEstimate * 1.5).toString(), // Increased buffer
    }

    const mainResult = await mainClient.signAndBroadcast(mainAddr, mainMessages, mainFee, 'Main wallet setup: grant + gas funds')

    if (mainResult.code !== 0) {
      throw new Error(`Main wallet transaction failed: ${mainResult.rawLog}`)
    }

    transactionStatus.textContent += `\n✅ Main wallet setup complete: ${mainResult.transactionHash}`

    // Transaction 2: Session wallet grants main wallet (for recovery)
    transactionStatus.textContent += '\n\nStep 2: Session wallet grants recovery authorization to main wallet...'

    const sessionMessages = [
      {
        typeUrl: '/cosmos.authz.v1beta1.MsgGrant',
        value: authzSetup.sessionToMainGrant,
      },
    ]

    const sessionClient = stintWallet.client
    const sessionGasEstimate = await sessionClient.simulate(sessionAddr, sessionMessages, '')
    const sessionFee = {
      amount: [{ denom: 'uatone', amount: '2500' }], // Increased from 1500 to 2500
      gas: Math.ceil(sessionGasEstimate * 1.5).toString(), // Increased buffer
    }

    const sessionResult = await sessionClient.signAndBroadcast(sessionAddr, sessionMessages, sessionFee, 'Session wallet grants main wallet recovery')

    if (sessionResult.code !== 0) {
      throw new Error(`Session wallet transaction failed: ${sessionResult.rawLog}`)
    }

    const result = { transactionHash: `${mainResult.transactionHash}, ${sessionResult.transactionHash}`, height: mainResult.height }

    transactionStatus.textContent = `✅ Session wallet setup complete!

Transaction hashes: 
- Main wallet (grant + gas): ${mainResult.transactionHash}
- Session wallet grant: ${sessionResult.transactionHash}
Height: ${result.height}

Session wallet ${sessionAddr} can now:
- Send up to 1 ATONE using authz
- Has gas funds for transactions

Main wallet ${mainAddr} can:
- Recover all funds from session wallet at any time

Try sending a transaction with the session wallet!`
    transactionStatus.className = 'status success'

    // Add a new button to test sending with session wallet
    const testSendBtn = document.createElement('button')
    testSendBtn.textContent = 'Test Session Send'
    testSendBtn.style.marginTop = '1rem'
    transactionStatus.appendChild(document.createElement('br'))
    transactionStatus.appendChild(testSendBtn)

    testSendBtn.addEventListener('click', async () => {
      try {
        transactionStatus.textContent = 'Sending transaction with session wallet...'
        transactionStatus.className = 'status'

        // Use the session wallet to send a small amount
        const recipient = prompt('Enter recipient address (atone1...):', sessionAddr)
        if (!recipient) return

        const amount = prompt('Enter amount in uatone (max 1000000):', '1000')
        if (!amount || parseInt(amount) > 1000000) {
          throw new Error('Invalid amount')
        }

        // Create an authz exec message
        const { MsgExec } = await import('cosmjs-types/cosmos/authz/v1beta1/tx')
        const { Any } = await import('cosmjs-types/google/protobuf/any')

        const innerSendMsg = MsgSend.fromPartial({
          fromAddress: mainAddr, // Funds come from main wallet
          toAddress: recipient,
          amount: [{ denom: 'uatone', amount }],
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

        // Use the session wallet's client
        const sessionClient = stintWallet.client
        const sessionFee = {
          amount: [{ denom: 'uatone', amount: '1000' }],
          gas: '200000',
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

Sent ${amount} uatone to ${recipient}
Using authz from: ${mainAddr}
Signed by session wallet: ${sessionAddr}

Transaction hash: ${execResult.transactionHash}

The session wallet signed this transaction without needing access to your main wallet! 🎉`
        transactionStatus.className = 'status success'
      } catch (error) {
        transactionStatus.textContent = `❌ Session transaction error: ${error}`
        transactionStatus.className = 'status error'
      }
    })
  } catch (error) {
    transactionStatus.textContent = `❌ Error: ${error}`
    transactionStatus.className = 'status error'
  }
})

// Add TypeScript declarations for Keplr
declare global {
  interface Window {
    keplr: any
    mainWalletSigner: any
  }
}