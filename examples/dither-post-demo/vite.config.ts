import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  optimizeDeps: {
    include: [
      'cosmjs-types/cosmos/authz/v1beta1/tx',
      'cosmjs-types/google/protobuf/any',
      'cosmjs-types/cosmos/bank/v1beta1/tx',
    ],
  },
  define: {
    global: 'globalThis',
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      external: [],
    },
  },
  server: {
    fs: {
      strict: false,
    },
  },
})
