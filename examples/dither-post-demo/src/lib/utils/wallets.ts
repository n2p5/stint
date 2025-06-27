export const CHAIN_ID = 'atomone-testnet-1';
export const RPC_URL = 'https://atomone-testnet-1-rpc.allinbits.services';

export const CHAIN_INFO = {
  chainId: CHAIN_ID,
  chainName: 'AtomOne Testnet',
  rpc: RPC_URL,
  rest: 'https://atomone-testnet-1.allinbits.services',
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
};

// Wallet detection
export function detectWallets() {
  const wallets = [];
  if (window.keplr) wallets.push('keplr');
  if (window.leap) wallets.push('leap');
  if (window.cosmostation) wallets.push('cosmostation');
  return wallets;
}

// Connect Keplr
export async function connectKeplr() {
  if (!window.keplr) throw new Error('Keplr wallet not found');
  
  try {
    await window.keplr.experimentalSuggestChain(CHAIN_INFO);
  } catch {
    // Chain might already be added
  }
  
  await window.keplr.enable(CHAIN_ID);
  const offlineSigner = window.keplr.getOfflineSigner(CHAIN_ID);
  const accounts = await offlineSigner.getAccounts();
  
  return {
    name: 'Keplr',
    signer: offlineSigner,
    address: accounts[0].address,
  };
}

// Connect Leap
export async function connectLeap() {
  if (!window.leap) throw new Error('Leap wallet not found');
  
  await window.leap.enable(CHAIN_ID);
  const offlineSigner = window.leap.getOfflineSigner(CHAIN_ID);
  const accounts = await offlineSigner.getAccounts();
  
  return {
    name: 'Leap',
    signer: offlineSigner,
    address: accounts[0].address,
  };
}

// Connect Cosmostation
export async function connectCosmostation() {
  if (!window.cosmostation?.providers?.keplr) {
    throw new Error('Cosmostation wallet not found');
  }
  
  await window.cosmostation.providers.keplr.enable(CHAIN_ID);
  const offlineSigner = window.cosmostation.providers.keplr.getOfflineSigner(CHAIN_ID);
  const accounts = await offlineSigner.getAccounts();
  
  return {
    name: 'Cosmostation',
    signer: offlineSigner,
    address: accounts[0].address,
  };
}

// Wallet type declarations
declare global {
  interface Window {
    keplr: any;
    leap: any;
    cosmostation: any;
  }
}