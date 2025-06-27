<script lang="ts">
  import WalletConnect from '$lib/components/WalletConnect.svelte';
  import SessionWallet from '$lib/components/SessionWallet.svelte';
  import Authorization from '$lib/components/Authorization.svelte';
  import Transaction from '$lib/components/Transaction.svelte';
</script>

<svelte:head>
  <title>Stint + Dither Demo</title>
  <meta name="description" content="Post to Dither using Stint session wallets with authz delegation" />
</svelte:head>

<div class="container mx-auto px-4 py-8">
  <div class="max-w-4xl mx-auto">
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold mb-4">Stint + Dither Demo</h1>
      <p class="text-lg text-base-content/70">
        Post to Dither using a session wallet with authz + feegrant delegation
      </p>
    </div>
    
    <div class="space-y-6">
      <WalletConnect />
      <SessionWallet />
      <Authorization />
      <Transaction />
    </div>
    
    <div class="mt-12 p-6 bg-base-300 rounded-box">
      <h2 class="text-2xl font-bold mb-4">How it works</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Session Wallets</h3>
          <ul class="list-disc list-inside space-y-2 text-sm">
            <li>Created using WebAuthn Passkeys</li>
            <li>Deterministic key derivation</li>
            <li>Never hold any funds</li>
            <li>Can sign transactions on behalf of primary wallet</li>
          </ul>
        </div>
        
        <div class="space-y-4">
          <h3 class="text-lg font-semibold">Authorization</h3>
          <ul class="list-disc list-inside space-y-2 text-sm">
            <li>Authz grants define spending limits</li>
            <li>Feegrants cover gas fees automatically</li>
            <li>Time-limited and revocable</li>
            <li>Can restrict recipient addresses</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>