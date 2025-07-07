<script lang="ts">
  import { sessionStore } from '$lib/stores/session';
  import { DITHER_ADDRESS, DEFAULT_AMOUNT, DEFAULT_MEMO } from '$lib/constants';
  import { consoleLogger } from 'stint-signer';
  import { createTxLink, type TxLinkData } from '$lib/utils/explorer';
  
  let recipient = DITHER_ADDRESS;
  let amount = DEFAULT_AMOUNT;
  let memo = DEFAULT_MEMO;
  let isSending = false;
  let error = '';
  let successTx: TxLinkData | null = null;
  
  $: canSend = $sessionStore.sessionSigner && recipient && amount && Number(amount) > 0;
  
  async function sendTransaction() {
    if (!$sessionStore.sessionSigner) return;
    
    isSending = true;
    error = '';
    successTx = null;
    
    consoleLogger.info('Starting transaction with simplified execute.send...', {
      recipient,
      amount,
      memo: memo.slice(0, 50) + (memo.length > 50 ? '...' : '')
    });
    
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
      
      // Use the new simplified execute.send method!
      const result = await $sessionStore.sessionSigner.execute.send({
        toAddress: recipient,
        amount: [{ denom: 'uphoton', amount: String(amount) }],
        memo,
        fee: {
          amount: [{ denom: 'uphoton', amount: '5000' }],
          gas: '200000'
        }
      });
      
      successTx = createTxLink(result.transactionHash);
      
      consoleLogger.info('Transaction successful!', {
        transactionHash: result.transactionHash,
        gasUsed: result.gasUsed,
        gasWanted: result.gasWanted,
        height: result.height,
        events: result.events?.length || 0
      });
      
      // Reset form on success
      recipient = DITHER_ADDRESS;
      amount = DEFAULT_AMOUNT;
      memo = DEFAULT_MEMO;
    } catch (err) {
      consoleLogger.error('Transaction failed', err instanceof Error ? err : undefined, {
        operation: 'sendTransaction',
        recipient,
        amount
      });
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
            {/if}
            Post to Dither
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