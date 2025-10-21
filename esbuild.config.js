module.exports = {
  external: ['__STATIC_CONTENT_MANIFEST'],
  define: {
    global: 'globalThis',
  },
  alias: {
    stream: 'stream-browserify',
    util: 'util',
  },
  inject: ['./polyfills.js'],
};