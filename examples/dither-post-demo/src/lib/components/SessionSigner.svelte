<script lang="ts">
  import { sessionStore } from '$lib/stores/session';
  import { newSessionSigner, StintError, ErrorCodes, consoleLogger, getWindowBoundaries } from 'stint-signer';
  import { SigningStargateClient, GasPrice } from '@cosmjs/stargate';
  import { RPC_URL } from '$lib/utils/wallets';
  
  let isCreating = false;
  let error = '';
  let status = '';
  
  // Window configuration options
  let showAdvanced = false;
  let stintWindowHours = 24; // Default 24 hours
  let usePreviousWindow = false;
  
  async function createSession() {
    isCreating = true;
    error = '';
    status = '';
    
    try {
      if (!$sessionStore.signer) throw new Error('No wallet connected');
      
      status = 'Initializing primary client...';
      
      // Create primary client
      const primaryClient = await SigningStargateClient.connectWithSigner(
        RPC_URL,
        $sessionStore.signer,
        {
          gasPrice: GasPrice.fromString('0.025uphoton')
        }
      );
      
      status = 'Creating session signer with passkey...';
      
      // Create session signer with consoleLogger from stint and window configuration
      const sessionSigner = await newSessionSigner({
        primaryClient,
        saltName: 'stint-session',
        stintWindowHours,
        usePreviousWindow,
        logger: consoleLogger
      });
      
      status = 'Session signer created successfully!';
      
      sessionStore.update(state => ({
        ...state,
        sessionSigner
      }));
      
      status = ''; // Clear status on success
    } catch (err) {
      if (err instanceof StintError) {
        consoleLogger.error(`Stint operation failed: ${err.message}`, err, { 
          code: err.code, 
          details: err.details 
        });
        
        // Provide user-friendly error messages based on error code
        switch (err.code) {
          case ErrorCodes.WEBAUTHN_NOT_SUPPORTED:
            error = 'Your browser does not support WebAuthn. Please use a modern browser like Chrome, Firefox, or Safari.';
            break;
          case ErrorCodes.USER_CANCELLED:
            error = 'Passkey operation was cancelled. Please try again and complete the passkey prompt.';
            break;
          case ErrorCodes.PRF_NOT_SUPPORTED:
            error = 'Your browser or authenticator does not support the required PRF extension. Please try a different browser or authenticator.';
            break;
          case ErrorCodes.PASSKEY_CREATION_FAILED:
          case ErrorCodes.PASSKEY_AUTHENTICATION_FAILED:
            error = 'Failed to create or authenticate with passkey. Please try again.';
            break;
          default:
            error = `Session signer creation failed: ${err.message}`;
        }
      } else {
        consoleLogger.error('Unexpected error during session creation', err instanceof Error ? err : undefined);
        error = err instanceof Error ? err.message : 'Failed to create session signer';
      }
    } finally {
      isCreating = false;
    }
  }
  
  function formatAddress(address: string): string {
    return `${address.slice(0, 10)}...${address.slice(-6)}`;
  }
  
  function formatTimeRemaining(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }
  
  // Get current window information for display
  function getWindowInfo() {
    try {
      const boundaries = getWindowBoundaries(stintWindowHours);
      const now = Date.now();
      const timeUntilNext = boundaries.end.getTime() - now;
      return {
        windowNumber: boundaries.windowNumber,
        timeUntilNext: timeUntilNext > 0 ? timeUntilNext : 0,
        windowStart: boundaries.start,
        windowEnd: boundaries.end
      };
    } catch {
      return null;
    }
  }
  
  $: windowInfo = getWindowInfo();
</script>

<div class="card bg-base-100 shadow-xl">
  <div class="card-body">
    <h2 class="card-title">Step 2: Create Session Signer</h2>
    
    {#if $sessionStore.sessionSigner}
      <div class="space-y-4">
        <div class="alert alert-success">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Session signer created successfully!</span>
        </div>
        
        <div class="stats bg-primary text-primary-content">
          <div class="stat">
            <div class="stat-title text-primary-content/70">Primary Address</div>
            <div class="stat-value text-lg">
              {formatAddress($sessionStore.sessionSigner.primaryAddress())}
            </div>
          </div>
          
          <div class="stat">
            <div class="stat-title text-primary-content/70">Session Address</div>
            <div class="stat-value text-lg">
              {formatAddress($sessionStore.sessionSigner.sessionAddress())}
            </div>
          </div>
        </div>
        
        <div class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>Session signer ready! Now create authorization grants to enable transactions.</span>
        </div>
      </div>
    {:else if $sessionStore.isConnected}
      <p class="text-base-content/70">
        Create a session signer using a Passkey. This signer will be able to transact on behalf of your primary address.
      </p>
      
      <!-- Advanced Window Configuration -->
      <div class="collapse collapse-arrow bg-base-200">
        <input type="checkbox" bind:checked={showAdvanced} />
        <div class="collapse-title text-xl font-medium">
          Advanced: Window-Based Key Rotation
        </div>
        <div class="collapse-content">
          <div class="space-y-4">
            <div class="form-control">
              <label class="label">
                <span class="label-text">Key Rotation Interval (hours)</span>
                <span class="label-text-alt">Current: {stintWindowHours}h</span>
              </label>
              <select class="select select-bordered" bind:value={stintWindowHours}>
                <option value={1}>1 hour (Maximum Security)</option>
                <option value={8}>8 hours (High Security)</option>
                <option value={24}>24 hours (Balanced - Default)</option>
                <option value={168}>1 week (Convenience)</option>
              </select>
              <label class="label">
                <span class="label-text-alt">Keys rotate automatically at these intervals for enhanced security</span>
              </label>
            </div>
            
            <div class="form-control">
              <label class="label cursor-pointer">
                <span class="label-text">Use Previous Window</span>
                <input type="checkbox" class="checkbox" bind:checked={usePreviousWindow} />
              </label>
              <label class="label">
                <span class="label-text-alt">Enable grace period by using the previous time window's keys</span>
              </label>
            </div>
            
            {#if windowInfo}
              <div class="stats bg-primary text-primary-content">
                <div class="stat">
                  <div class="stat-title text-primary-content/70">Current Window</div>
                  <div class="stat-value text-lg">#{windowInfo.windowNumber}</div>
                  <div class="stat-desc text-primary-content/70">
                    {usePreviousWindow ? `Using previous window #${windowInfo.windowNumber - 1}` : 'Using current window'}
                  </div>
                </div>
                <div class="stat">
                  <div class="stat-title text-primary-content/70">Time Until Next</div>
                  <div class="stat-value text-lg">{formatTimeRemaining(windowInfo.timeUntilNext)}</div>
                  <div class="stat-desc text-primary-content/70">Key rotates automatically</div>
                </div>
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      {#if status}
        <div class="alert alert-info">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <span>{status}</span>
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
      
      <div class="card-actions">
        <button 
          class="btn btn-primary"
          on:click={createSession}
          disabled={isCreating}
        >
          {#if isCreating}
            <span class="loading loading-spinner"></span>
          {/if}
          Create Session Signer
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