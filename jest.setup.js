// Mock import.meta for Jest environment
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      main: false
    }
  },
  writable: true,
  configurable: true
});
