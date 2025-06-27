import { writable } from 'svelte/store'
import type { OfflineSigner } from '@cosmjs/proto-signing'
import type { SessionSigner } from 'stint-signer'

interface SessionState {
  isConnected: boolean
  name: string | null // Still refers to the primary name
  signer: OfflineSigner | null
  address: string | null
  sessionSigner: SessionSigner | null
}

export const sessionStore = writable<SessionState>({
  isConnected: false,
  name: null,
  signer: null,
  address: null,
  sessionSigner: null,
})

export function resetSession() {
  sessionStore.set({
    isConnected: false,
    name: null,
    signer: null,
    address: null,
    sessionSigner: null,
  })
}
