// Main worker entry point for Cloudflare Workers
import { app } from './app';

// Add a root endpoint
app.get('/', (c) => {
  return c.json({
    message: 'Croissant API is running with Hono + Inversify',
    version: '1.0.0',
    framework: 'Hono',
    di: 'Inversify',
    endpoints: [
      '/test/hello',
      '/test/echo', 
      '/test/headers',
      // TODO: Add other endpoints as controllers are migrated
      // '/api/users',
      // '/api/games',   
      // '/api/inventory',
      // '/api/trades',
      // '/api/auth'
    ]
  });
});

export default app;

