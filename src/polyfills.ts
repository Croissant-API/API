/* eslint-disable @typescript-eslint/no-explicit-any */
import { Buffer } from 'buffer';

// Polyfill global
if (typeof global === 'undefined') {
  (globalThis as any).global = globalThis as any;
}

// Polyfill Buffer
if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}
