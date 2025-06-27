<script lang="ts">
  import { walletStore } from '$lib/stores/wallet';
  import { detectWallets, connectKeplr, connectLeap, connectCosmostation } from '$lib/utils/wallets';
  import { onMount } from 'svelte';
  
  let availableWallets: string[] = [];
  let isConnecting = false;
  let error = '';
  
  onMount(() => {
    availableWallets = detectWallets();
  });
  
  async function handleConnect(walletType: string) {
    isConnecting = true;
    error = '';
    
    try {
      let walletInfo;
      
      switch (walletType) {
        case 'keplr':
          walletInfo = await connectKeplr();
          break;
        case 'leap':
          walletInfo = await connectLeap();
          break;
        case 'cosmostation':
          walletInfo = await connectCosmostation();
          break;
        default:
          throw new Error('Unknown wallet type');
      }
      
      walletStore.update(state => ({
        ...state,
        isConnected: true,
        walletName: walletInfo.name,
        signer: walletInfo.signer,
        address: walletInfo.address
      }));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to connect wallet';
    } finally {
      isConnecting = false;
    }
  }
  
  function disconnect() {
    walletStore.update(state => ({
      ...state,
      isConnected: false,
      walletName: null,
      signer: null,
      address: null,
      sessionWallet: null
    }));
  }
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Step 1: Connect Wallet</h2>
    
    {#if $walletStore.isConnected}
      <div class="alert alert-success">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 class="font-bold">Connected to {$walletStore.walletName}</h3>
          <div class="text-xs opacity-70">{$walletStore.address}</div>
        </div>
      </div>
      
      <button class="btn btn-error" on:click={disconnect}>
        Disconnect
      </button>
    {:else}
      <p class="text-base-content/70">Connect your Cosmos wallet to get started</p>
      
      {#if error}
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      {/if}
      
      <div class="flex flex-wrap gap-2">
        {#each availableWallets as wallet}
          <button 
            class="btn btn-primary capitalize"
            on:click={() => handleConnect(wallet)}
            disabled={isConnecting}
          >
            {#if isConnecting}
              <span class="loading loading-spinner"></span>
            {/if}
            {wallet}
          </button>
        {/each}
      </div>
      
      {#if availableWallets.length === 0}
        <div class="alert alert-warning">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>No Cosmos wallets detected. Please install Keplr, Leap, or Cosmostation.</span>
        </div>
      {/if}
    {/if}
  </div>
</div>