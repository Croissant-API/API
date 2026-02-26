const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/worker.ts'],
  bundle: true,
  // Cloudflare Workers run in a browser-like environment.  Use the
  // "browser" platform so that npm packages resolve correctly and
  // Node.js built‑ins are treated as external.  We then rely on
  // runtime globals (fetch, crypto, etc.) instead of importing the
  // Node versions.
  platform: 'browser',
  mainFields: ['browser', 'module', 'main'],
  target: 'es2022',
  format: 'esm',                    // module workers are preferred
  external: [
    '@mongodb-js/zstd',             // native addon would be ignored anyway
    // common Node builtins that should not be bundled
    'fs',
    'path',
    'os',
    'crypto',
    'net',
    'dns',
    'stream',
    'util',
    'events',
    'querystring',
    'node:net',
    'node-fetch',
    '@peculiar/webcrypto',
    'express',
    'nodemailer',
    'ejs',
    'express-rate-limit',
    // also avoid bundling heavy libs that pull in builtins
    'mongodb',
    'jsonwebtoken',
    'jws',
    'jwa',
    // dotenv is only used in Node environments; we remove it from the bundle entirely
    'dotenv',
  ],
  outfile: 'dist/worker.js',        // produce a single JS file for Wrangler
}).catch(() => process.exit(1));