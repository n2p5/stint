<script lang="ts">
  import { walletStore } from '$lib/stores/wallet';
  import { newSessionWallet } from 'stint';
  import { SigningStargateClient, GasPrice } from '@cosmjs/stargate';
  import { RPC_URL } from '$lib/utils/wallets';
  
  let isCreating = false;
  let error = '';
  
  async function createSession() {
    isCreating = true;
    error = '';
    
    try {
      if (!$walletStore.signer) throw new Error('No wallet connected');
      
      // Create primary client
      const primaryClient = await SigningStargateClient.connectWithSigner(
        RPC_URL,
        $walletStore.signer,
        {
          gasPrice: GasPrice.fromString('0.025uphoton')
        }
      );
      
      // Create session wallet
      const sessionWallet = await newSessionWallet({
        primaryClient,
        saltName: 'stint-wallet'
      });
      
      walletStore.update(state => ({
        ...state,
        sessionWallet
      }));
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create session wallet';
    } finally {
      isCreating = false;
    }
  }
  
  function formatAddress(address: string): string {
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
  }
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Step 2: Create Session Wallet</h2>
    
    {#if $walletStore.sessionWallet}
      <div class="space-y-4">
        <div class="alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Session wallet created successfully!</span>
        </div>
        
        <div class="stats bg-primary text-primary-content">
          <div class="stat">
            <div class="stat-title text-primary-content/70">Primary Address</div>
            <div class="stat-value text-lg">
              {formatAddress($walletStore.sessionWallet.primaryAddress())}
            </div>
          </div>
          
          <div class="stat">
            <div class="stat-title text-primary-content/70">Session Address</div>
            <div class="stat-value text-lg">
              {formatAddress($walletStore.sessionWallet.sessionAddress())}
            </div>
          </div>
        </div>
        
        <div class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Session wallet ready! Now create authorization grants to enable transactions.</span>
        </div>
      </div>
    {:else if $walletStore.isConnected}
      <p class="text-base-content/70">
        Create a session wallet using a Passkey. This wallet will be able to transact on behalf of your main wallet.
      </p>
      
      {#if error}
        <div class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      {/if}
      
      <div class="card-actions">
        <button 
          class="btn btn-primary"
          on:click={createSession}
          disabled={isCreating}
        >
          {#if isCreating}
            <span class="loading loading-spinner"></span>
          {/if}
          Create Session Wallet
        </button>
      </div>
    {:else}
      <div class="alert">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Please connect your wallet first</span>
      </div>
    {/if}
  </div>
</div>