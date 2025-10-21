import { Buffer } from 'buffer';

// Polyfill global
if (typeof global === 'undefined') {
  globalThis.global = globalThis;
}

// Polyfill Buffer
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
