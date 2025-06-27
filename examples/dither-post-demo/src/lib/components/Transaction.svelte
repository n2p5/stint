<script lang="ts">
  import { sessionStore } from '$lib/stores/session';
  import { onMount } from 'svelte';
  import { DITHER_ADDRESS, DEFAULT_AMOUNT, DEFAULT_MEMO } from '$lib/constants';
  
  let recipient = DITHER_ADDRESS;
  let amount = DEFAULT_AMOUNT;
  let memo = DEFAULT_MEMO;
  let isSending = false;
  let error = '';
  let successTx = '';
  let cosmosModules: any = null;
  
  onMount(async () => {
    // Load cosmos modules
    const [bankModule, authzModule, anyModule] = await Promise.all([
      import('cosmjs-types/cosmos/bank/v1beta1/tx'),
      import('cosmjs-types/cosmos/authz/v1beta1/tx'),
      import('cosmjs-types/google/protobuf/any')
    ]);
    
    cosmosModules = {
      MsgSend: bankModule.MsgSend,
      MsgExec: authzModule.MsgExec,
      Any: anyModule.Any
    };
  });
  
  $: canSend = $sessionStore.sessionSigner && recipient && amount && Number(amount) > 0 && cosmosModules;
  
  async function sendTransaction() {
    if (!$sessionStore.sessionSigner || !cosmosModules) return;
    
    isSending = true;
    error = '';
    successTx = '';
    
    try {
      // Validate recipient address
      if (!recipient.startsWith('atone1')) {
        throw new Error('Recipient must be an AtomOne address (atone1...)');
      }
      
      // Validate amount
      const amountNum = Number(amount);
      if (isNaN(amountNum) || amountNum <= 0 || amountNum > 1000000 || !Number.isInteger(amountNum)) {
        throw new Error('Amount must be a positive integer between 1 and 1,000,000 uphoton (1 PHOTON)');
      }
      
      const primaryAddress = $sessionStore.sessionSigner.primaryAddress();
      const sessionAddress = $sessionStore.sessionSigner.sessionAddress();
      
      // Create MsgSend message
      const msgSend = cosmosModules.MsgSend.fromPartial({
        fromAddress: primaryAddress,
        toAddress: recipient,
        amount: [{ denom: 'uphoton', amount: String(amount) }]
      });
      
      // Encode the MsgSend
      const msgSendBytes = cosmosModules.MsgSend.encode(msgSend).finish();
      const msgSendAny = cosmosModules.Any.fromPartial({
        typeUrl: '/cosmos.bank.v1beta1.MsgSend',
        value: msgSendBytes
      });
      
      // Create MsgExec message
      const execMsg = {
        typeUrl: '/cosmos.authz.v1beta1.MsgExec',
        value: {
          grantee: sessionAddress,
          msgs: [msgSendAny]
        }
      };
      
      // Send transaction using session signer with explicit fee (PHOTON only + granter)
      const fee = {
        amount: [{ denom: 'uphoton', amount: '5000' }],
        gas: '200000',
        granter: primaryAddress, // This tells the chain to use the feegrant!
      };
      
      
      const result = await $sessionStore.sessionSigner.client.signAndBroadcast(
        sessionAddress,
        [execMsg],
        fee,
        memo
      );
      
      if (result.code !== 0) {
        throw new Error(`Transaction failed: ${result.rawLog}`);
      }
      
      successTx = result.transactionHash;
      
      // Reset form on success
      recipient = DITHER_ADDRESS;
      amount = DEFAULT_AMOUNT;
      memo = DEFAULT_MEMO;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to send transaction';
    } finally {
      isSending = false;
    }
  }
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Step 4: Post to Dither</h2>
    
    {#if $sessionStore.sessionSigner}
      <div class="space-y-4">
        {#if successTx}
          <div class="alert alert-success">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 class="font-bold">Transaction sent!</h3>
              <div class="text-xs">Tx: {successTx}</div>
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
        
        <div class="form-control">
          <label class="label" for="recipient">
            <span class="label-text">Recipient Address</span>
            <span class="label-text-alt">Dither Testnet</span>
          </label>
          <input 
            id="recipient"
            type="text" 
            placeholder="atone1..." 
            class="input input-bordered"
            bind:value={recipient}
            disabled={true}
            readonly
          />
        </div>
        
        <div class="form-control">
          <label class="label" for="amount">
            <span class="label-text">Amount (uphoton)</span>
            <span class="label-text-alt">Max: 1,000,000 (1 PHOTON)</span>
          </label>
          <input 
            id="amount"
            type="number" 
            placeholder="100" 
            class="input input-bordered"
            bind:value={amount}
            min="1"
            max="1000000"
            disabled={isSending}
          />
        </div>
        
        <div class="form-control">
          <label class="label" for="memo">
            <span class="label-text">Dither Post Content</span>
          </label>
          <textarea 
            id="memo"
            placeholder="Your post content..." 
            class="textarea textarea-bordered h-20"
            bind:value={memo}
            disabled={isSending}
          ></textarea>
        </div>
        
        <div class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <p><strong>Dither Integration:</strong> Post to decentralized social network</p>
            <p class="text-sm opacity-70">Session signer posts on behalf of your primary address</p>
          </div>
        </div>
        
        <div class="card-actions">
          <button 
            class="btn btn-primary"
            on:click={sendTransaction}
            disabled={!canSend || isSending}
          >
            {#if isSending}
              <span class="loading loading-spinner"></span>
            {:else if !cosmosModules}
              <span class="loading loading-spinner"></span>
            {/if}
            {#if !cosmosModules}
              Loading modules...
            {:else}
              Post to Dither
            {/if}
          </button>
        </div>
      </div>
    {:else}
      <div class="alert">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-info shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>Please complete the previous steps first</span>
      </div>
    {/if}
  </div>
</div>