<script lang="ts">
  import '../app.css';
  import '../lib/utils/polyfill';
</script>

<div class="min-h-screen bg-base-200">
  <div class="navbar bg-base-100 shadow-lg">
    <div class="navbar-start">
      <h1 class="text-xl font-bold">Stint Session Wallet Demo</h1>
    </div>
    <div class="navbar-end">
      <a href="https://github.com/n2p5/stint" target="_blank" class="btn btn-ghost">
        GitHub
      </a>
    </div>
  </div>
  
  <main>
    <slot />
  </main>
</div>