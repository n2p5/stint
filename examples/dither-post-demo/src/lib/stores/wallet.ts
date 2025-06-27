import { writable } from 'svelte/store';
import type { OfflineSigner } from '@cosmjs/proto-signing';
import type { SessionWallet } from 'stint';

interface WalletState {
  isConnected: boolean;
  walletName: string | null;
  signer: OfflineSigner | null;
  address: string | null;
  sessionWallet: SessionWallet | null;
}

export const walletStore = writable<WalletState>({
  isConnected: false,
  walletName: null,
  signer: null,
  address: null,
  sessionWallet: null
});

export function resetWallet() {
  walletStore.set({
    isConnected: false,
    walletName: null,
    signer: null,
    address: null,
    sessionWallet: null
  });
}