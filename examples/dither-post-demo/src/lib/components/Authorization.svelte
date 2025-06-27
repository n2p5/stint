<script lang="ts">
  import { walletStore } from '$lib/stores/wallet';
  import { SigningStargateClient, GasPrice } from '@cosmjs/stargate';
  import { RPC_URL } from '$lib/utils/wallets';
  
  let isChecking = false;
  let isAuthorizing = false;
  let isRevoking = false;
  let hasAuthzGrant = false;
  let hasFeegrant = false;
  let error = '';
  let successTx = '';
  let revokeTx = '';
  
  // Reactive check when session wallet changes
  $: if ($walletStore.sessionWallet) {
    checkAuthorizations();
  }
  
  async function checkAuthorizations() {
    if (!$walletStore.sessionWallet) return;
    
    isChecking = true;
    try {
      const [authz, feegrant] = await Promise.all([
        $walletStore.sessionWallet.hasAuthzGrant(),
        $walletStore.sessionWallet.hasFeegrant()
      ]);
      
      hasAuthzGrant = !!authz;
      hasFeegrant = !!feegrant;
      
      // Debug: Log feegrant details
      if (feegrant) {
        console.log('Feegrant details:', feegrant);
        if (feegrant.allowance?.allowance?.spend_limit) {
          console.log('Feegrant spend limits:', feegrant.allowance.allowance.spend_limit);
        }
      }
    } catch (err) {
      console.error('Failed to check authorizations:', err);
    } finally {
      isChecking = false;
    }
  }
  
  async function createAuthorizations() {
    if (!$walletStore.sessionWallet || !$walletStore.signer) return;
    
    isAuthorizing = true;
    error = '';
    successTx = '';
    revokeTx = '';
    
    try {
      // Check primary wallet balance
      const primaryClient = await SigningStargateClient.connectWithSigner(
        RPC_URL,
        $walletStore.signer,
        {
          gasPrice: GasPrice.fromString('0.025uphoton')
        }
      );
      
      const primaryAddress = $walletStore.sessionWallet.primaryAddress();
      const photonBalance = await primaryClient.getBalance(primaryAddress, 'uphoton');
      console.log('Primary wallet PHOTON balance:', photonBalance);
      
      if (parseInt(photonBalance.amount) < 2000000) {
        throw new Error(`Insufficient PHOTON balance. You have ${photonBalance.amount} uphoton but need at least 2,000,000 uphoton (2 PHOTON).`);
      }
      // Generate delegation messages with Dither testnet as authorized recipient
      const messages = $walletStore.sessionWallet.generateDelegationMessages({
        sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        spendLimit: { denom: 'uphoton', amount: '1000000' }, // 1 PHOTON
        gasLimit: { denom: 'uphoton', amount: '1000000' }, // 1 PHOTON gas
        allowedRecipients: ['atone1uq6zjslvsa29cy6uu75y8txnl52mw06j6fzlep'] // Dither testnet
      });
      
      // Broadcast transaction (reuse the primaryClient and primaryAddress from above)
      const result = await primaryClient.signAndBroadcast(
        primaryAddress,
        messages,
        'auto',
        'Stint session wallet authorization'
      );
      
      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }
      
      successTx = result.transactionHash;
      
      // Recheck authorizations
      await checkAuthorizations();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create authorizations';
    } finally {
      isAuthorizing = false;
    }
  }
  
  async function revokeAuthorizations() {
    if (!$walletStore.sessionWallet || !$walletStore.signer) return;
    
    isRevoking = true;
    error = '';
    successTx = '';
    revokeTx = '';
    
    try {
      // Generate revocation messages
      const messages = $walletStore.sessionWallet.revokeDelegationMessages();
      
      // Create primary client for broadcasting
      const primaryClient = await SigningStargateClient.connectWithSigner(
        RPC_URL,
        $walletStore.signer,
        {
          gasPrice: GasPrice.fromString('0.025uphoton')
        }
      );
      
      // Broadcast transaction
      const primaryAddress = $walletStore.sessionWallet.primaryAddress();
      const result = await primaryClient.signAndBroadcast(
        primaryAddress,
        messages,
        'auto',
        'Stint session wallet revocation'
      );
      
      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }
      
      revokeTx = result.transactionHash;
      
      // Recheck authorizations
      await checkAuthorizations();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to revoke authorizations';
    } finally {
      isRevoking = false;
    }
  }
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Step 3: Create Authorization</h2>
    
    {#if $walletStore.sessionWallet}
      {#if isChecking}
        <div class="flex items-center gap-2">
          <span class="loading loading-spinner"></span>
          <span>Checking authorizations...</span>
        </div>
      {:else}
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="stat bg-base-200 rounded-box">
              <div class="stat-title">Authz Grant</div>
              <div class="stat-value text-lg">
                {#if hasAuthzGrant}
                  <span class="text-success">✓ Active</span>
                {:else}
                  <span class="text-warning">⚠ Not Set</span>
                {/if}
              </div>
              <div class="stat-desc">Restricted to Dither testnet only</div>
            </div>
            
            <div class="stat bg-base-200 rounded-box">
              <div class="stat-title">Fee Grant</div>
              <div class="stat-value text-lg">
                {#if hasFeegrant}
                  <span class="text-success">✓ Active</span>
                {:else}
                  <span class="text-warning">⚠ Not Set</span>
                {/if}
              </div>
              <div class="stat-desc">Covers gas fees up to 1 PHOTON</div>
            </div>
          </div>
          
          {#if successTx}
            <div class="alert alert-success">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 class="font-bold">Authorization created!</h3>
                <div class="text-xs">Tx: {successTx.slice(0, 16)}...</div>
              </div>
            </div>
          {/if}
          
          {#if revokeTx}
            <div class="alert alert-warning">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <h3 class="font-bold">Authorization revoked!</h3>
                <div class="text-xs">Tx: {revokeTx.slice(0, 16)}...</div>
              </div>
            </div>
          {/if}
          
          {#if error}
            <div class="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          {/if}
          
          {#if !hasAuthzGrant || !hasFeegrant}
            <p class="text-base-content/70">
              Create authorization grants to allow your session wallet to post to Dither testnet on behalf of your main wallet.
            </p>
            
            <div class="card-actions">
              <button 
                class="btn btn-primary"
                on:click={createAuthorizations}
                disabled={isAuthorizing}
              >
                {#if isAuthorizing}
                  <span class="loading loading-spinner"></span>
                {/if}
                Create Authorization
              </button>
              
              <button 
                class="btn btn-ghost"
                on:click={checkAuthorizations}
                disabled={isChecking}
              >
                Refresh Status
              </button>
            </div>
          {:else}
            <div class="alert alert-info">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span>All authorizations are active! You can now send transactions.</span>
            </div>
            
            <div class="card-actions">
              <button 
                class="btn btn-warning"
                on:click={revokeAuthorizations}
                disabled={isRevoking}
              >
                {#if isRevoking}
                  <span class="loading loading-spinner"></span>
                {/if}
                Revoke Authorization
              </button>
              
              <button 
                class="btn btn-ghost"
                on:click={checkAuthorizations}
                disabled={isChecking}
              >
                Refresh Status
              </button>
            </div>
          {/if}
        </div>
      {/if}
    {:else}
      <div class="alert">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Please create a session wallet first</span>
      </div>
    {/if}
  </div>
</div>