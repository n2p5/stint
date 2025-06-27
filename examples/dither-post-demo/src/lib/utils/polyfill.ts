// Minimal process polyfill for cosmjs compatibility
if (typeof globalThis !== 'undefined' && !globalThis.process) {
  (globalThis as any).process = {
    env: {},
    nextTick: (fn: () => void) => Promise.resolve().then(() => fn()),
    browser: true,
  };
}