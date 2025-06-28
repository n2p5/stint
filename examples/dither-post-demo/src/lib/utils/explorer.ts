/**
 * AtomOne testnet explorer configuration
 */
export const ATOMONE_TESTNET_EXPLORER = {
  name: 'AtomOne Testnet Explorer',
  baseUrl: 'https://testnet.explorer.allinbits.services/atomone-testnet-1',
}

/**
 * Generate a clickable transaction link for the AtomOne testnet explorer
 */
export function getTransactionUrl(txHash: string): string {
  return `${ATOMONE_TESTNET_EXPLORER.baseUrl}/tx/${txHash}`
}

/**
 * Format a transaction hash for display (shortened with ellipsis)
 */
export function formatTxHash(txHash: string, length: number = 16): string {
  if (txHash.length <= length) return txHash
  return `${txHash.slice(0, length)}...`
}

/**
 * Create a complete transaction link element data
 */
export interface TxLinkData {
  hash: string
  url: string
  displayText: string
}

export function createTxLink(txHash: string, displayLength: number = 16): TxLinkData {
  return {
    hash: txHash,
    url: getTransactionUrl(txHash),
    displayText: formatTxHash(txHash, displayLength),
  }
}
