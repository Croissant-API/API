// Simplified Hono app for testing
import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// Add CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH'],
}));

// Test endpoints
app.get('/', (c) => {
  return c.json({
    message: 'Croissant API is running with Hono',
    version: '1.0.0',
    framework: 'Hono',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/test/hello',
      '/test/echo', 
      '/test/headers'
    ]
  });
});

app.get('/test/hello', (c) => {
  return c.json({ 
    message: 'Hello from Hono!',
    method: c.req.method,
    path: c.req.path
  });
});

app.post('/test/echo', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ 
      echo: body,
      method: c.req.method,
      path: c.req.path,
      contentType: c.req.header('content-type')
    });
  } catch (error) {
    return c.json({ 
      error: 'Invalid JSON',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 400);
  }
});

app.get('/test/headers', (c) => {
  const clientIP = c.req.header('cf-connecting-ip') || 
                   c.req.header('x-forwarded-for') || 
                   c.req.header('x-real-ip') || 
                   'unknown';
  
  return c.json({
    clientIP,
    userAgent: c.req.header('user-agent'),
    host: c.req.header('host'),
    url: c.req.url,
    method: c.req.method
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ 
    error: 'Not Found',
    path: c.req.path,
    method: c.req.method
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ 
    error: 'Internal Server Error',
    message: err instanceof Error ? err.message : 'Unknown error'
  }, 500);
});

export default app;