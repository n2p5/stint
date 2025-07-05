<script lang="ts">
  import { sessionStore } from '$lib/stores/session';
  import { SigningStargateClient, GasPrice } from '@cosmjs/stargate';
  import { RPC_URL } from '$lib/utils/wallets';
  import { DITHER_ADDRESS } from '$lib/constants';
  import { consoleLogger } from 'stint-signer';
  import { createTxLink, type TxLinkData } from '$lib/utils/explorer';
  
  let isChecking = false;
  let isAuthorizing = false;
  let isRevoking = false;
  let hasAuthzGrant = false;
  let hasFeegrant = false;
  let error = '';
  let successTx: TxLinkData | null = null;
  let revokeTx: TxLinkData | null = null;
  
  // Reactive check when session signer changes
  $: if ($sessionStore.sessionSigner) {
    checkAuthorizations();
  }
  
  async function checkAuthorizations() {
    if (!$sessionStore.sessionSigner) return;
    
    isChecking = true;
    consoleLogger.info('Checking authorization status...');
    
    try {
      const [authz, feegrant] = await Promise.all([
        $sessionStore.sessionSigner.hasAuthzGrant(),
        $sessionStore.sessionSigner.hasFeegrant()
      ]);
      
      hasAuthzGrant = !!authz;
      hasFeegrant = !!feegrant;
      
      consoleLogger.info('Authorization check completed', { 
        hasAuthzGrant, 
        hasFeegrant,
        authzExpiration: authz?.expiration?.toISOString(),
        feegrantExpiration: feegrant?.expiration?.toISOString()
      });
      
    } catch (err) {
      consoleLogger.warn('Failed to check authorizations', { 
        error: err instanceof Error ? err.message : 'Unknown error' 
      });
      // Don't show error to user as this is non-critical
    } finally {
      isChecking = false;
    }
  }
  
  async function createAuthorizations() {
    if (!$sessionStore.sessionSigner || !$sessionStore.signer) return;
    
    isAuthorizing = true;
    error = '';
    successTx = null;
    revokeTx = null;
    
    consoleLogger.info('Starting authorization creation...');
    
    try {
      consoleLogger.debug('Creating primary client...');
      // Check primary wallet balance
      const primaryClient = await SigningStargateClient.connectWithSigner(
        RPC_URL,
        $sessionStore.signer,
        {
          gasPrice: GasPrice.fromString('0.025uphoton')
        }
      );
      
      const primaryAddress = $sessionStore.sessionSigner.primaryAddress();
      
      consoleLogger.debug('Checking balance...', { primaryAddress });
      const photonBalance = await primaryClient.getBalance(primaryAddress, 'uphoton');
      
      consoleLogger.info('Balance check completed', { 
        balance: photonBalance.amount,
        denom: photonBalance.denom 
      });
      
      if (parseInt(photonBalance.amount) < 2000000) {
        throw new Error(`Insufficient PHOTON balance. You have ${photonBalance.amount} uphoton but need at least 2,000,000 uphoton (2 PHOTON).`);
      }
      
      consoleLogger.debug('Generating delegation messages...', {
        spendLimit: '1000000 uphoton',
        gasLimit: '1000000 uphoton',
        recipient: DITHER_ADDRESS
      });
      
      // Generate delegation messages with Dither testnet as authorized recipient
      const messages = $sessionStore.sessionSigner.generateDelegationMessages({
        sessionExpiration: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        spendLimit: { denom: 'uphoton', amount: '1000000' }, // 1 PHOTON
        gasLimit: { denom: 'uphoton', amount: '1000000' }, // 1 PHOTON gas
        allowedRecipients: [DITHER_ADDRESS] // Dither testnet
      });
      
      consoleLogger.info('Broadcasting authorization transaction...');
      
      // Broadcast transaction (reuse the primaryClient and primaryAddress from above)
      const result = await primaryClient.signAndBroadcast(
        primaryAddress,
        messages,
        'auto',
        'Stint session signer authorization'
      );
      
      if (result.code !== 0) {
        consoleLogger.error('Transaction failed', undefined, { 
          code: result.code, 
          rawLog: result.rawLog 
        });
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }
      
      successTx = createTxLink(result.transactionHash);
      consoleLogger.info('Authorization transaction successful!', { 
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed,
        gasWanted: result.gasWanted
      });
      
      // Recheck authorizations
      await checkAuthorizations();
    } catch (err) {
      consoleLogger.error('Failed to create authorizations', err instanceof Error ? err : undefined, {
        operation: 'createAuthorizations'
      });
      error = err instanceof Error ? err.message : 'Failed to create authorizations';
    } finally {
      isAuthorizing = false;
    }
  }
  
  async function revokeAuthorizations() {
    if (!$sessionStore.sessionSigner || !$sessionStore.signer) return;
    
    isRevoking = true;
    error = '';
    successTx = null;
    revokeTx = null;
    
    consoleLogger.info('Starting authorization revocation...');
    
    try {
      consoleLogger.debug('Generating revocation messages...');
      // Generate revocation messages
      const messages = $sessionStore.sessionSigner.revokeDelegationMessages();
      
      consoleLogger.debug('Creating primary client for revocation...');
      // Create primary client for broadcasting
      const primaryClient = await SigningStargateClient.connectWithSigner(
        RPC_URL,
        $sessionStore.signer,
        {
          gasPrice: GasPrice.fromString('0.025uphoton')
        }
      );
      
      consoleLogger.info('Broadcasting revocation transaction...');
      // Broadcast transaction
      const primaryAddress = $sessionStore.sessionSigner.primaryAddress();
      const result = await primaryClient.signAndBroadcast(
        primaryAddress,
        messages,
        'auto',
        'Stint session signer revocation'
      );
      
      if (result.code !== 0) {
        consoleLogger.error('Revocation transaction failed', undefined, { 
          code: result.code, 
          rawLog: result.rawLog 
        });
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }
      
      revokeTx = createTxLink(result.transactionHash);
      consoleLogger.info('Revocation transaction successful!', { 
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed,
        gasWanted: result.gasWanted
      });
      
      // Recheck authorizations
      await checkAuthorizations();
    } catch (err) {
      consoleLogger.error('Failed to revoke authorizations', err instanceof Error ? err : undefined, {
        operation: 'revokeAuthorizations'
      });
      error = err instanceof Error ? err.message : 'Failed to revoke authorizations';
    } finally {
      isRevoking = false;
    }
  }
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Step 3: Create Authorization</h2>
    
    {#if $sessionStore.sessionSigner}
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
                <div class="text-xs">
                  <span>Tx: </span>
                  <a 
                    href={successTx.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="link link-primary hover:link-accent"
                    title="View transaction on AtomOne Testnet Explorer"
                  >
                    {successTx.displayText}
                  </a>
                  <svg xmlns="http://www.w3.org/2000/svg" class="inline w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
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
                <div class="text-xs">
                  <span>Tx: </span>
                  <a 
                    href={revokeTx.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    class="link link-primary hover:link-accent"
                    title="View transaction on AtomOne Testnet Explorer"
                  >
                    {revokeTx.displayText}
                  </a>
                  <svg xmlns="http://www.w3.org/2000/svg" class="inline w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </div>
            </div>
          {/if}
          
          {#if error}
            <div class="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span>{error}</span>
                {#if error.includes('Insufficient PHOTON balance')}
                  <div class="mt-2">
                    <a 
                      href="https://testnet.explorer.allinbits.services/atomone-testnet-1/faucet" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="btn btn-sm btn-outline btn-primary"
                    >
                      Get PHOTON from Faucet
                      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
          
          {#if !hasAuthzGrant || !hasFeegrant}
            <p class="text-base-content/70">
              Create authorization grants to allow your session signer to post to Dither testnet on behalf of your primary address.
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
        <span>Please create a session signer first</span>
      </div>
    {/if}
  </div>
</div>