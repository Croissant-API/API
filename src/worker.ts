// Custom adapter to handle the Workers environment

interface Env {
  [key: string]: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Simple HTTP handler for Workers
    const url = new URL(request.url);
    
    try {
      // Basic routing for your API endpoints
      if (url.pathname === '/') {
        return new Response(JSON.stringify({
          message: 'Croissant API is running',
          version: '1.0.0',
          endpoints: [
            '/api/users',
            '/api/games', 
            '/api/inventory',
            '/api/trades',
            '/api/auth'
          ]
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          status: 200
        });
      }

      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
          }
        });
      }

      // Basic API endpoint example
      if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({
          message: 'API endpoint',
          path: url.pathname,
          method: request.method,
          note: 'This is a temporary response while migrating to Workers'
        }), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          status: 200
        });
      }

      // Default 404 response
      return new Response(JSON.stringify({ 
        error: 'Not Found',
        path: url.pathname
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};