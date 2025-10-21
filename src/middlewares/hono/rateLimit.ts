import { Context, MiddlewareHandler } from 'hono';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

// Simple in-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export const createRateLimit = (config: RateLimitConfig): MiddlewareHandler => {
  return async (c: Context, next) => {
    // Get client IP - in Cloudflare Workers this is different
    const clientIP = c.req.header('cf-connecting-ip') || 
                     c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 
                     'unknown';
    
    const key = `${clientIP}:${c.req.url}`;
    const now = Date.now();
    
    // Clean up old entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < now) {
        rateLimitStore.delete(k);
      }
    }
    
    // Get or create rate limit info for this key
    let rateLimitInfo = rateLimitStore.get(key);
    
    if (!rateLimitInfo || rateLimitInfo.resetTime < now) {
      // Create new window
      rateLimitInfo = {
        count: 1,
        resetTime: now + config.windowMs
      };
    } else {
      // Increment existing window
      rateLimitInfo.count++;
    }
    
    rateLimitStore.set(key, rateLimitInfo);
    
    // Check if limit exceeded
    if (rateLimitInfo.count > config.max) {
      const retryAfter = Math.ceil((rateLimitInfo.resetTime - now) / 1000);
      
      if (config.standardHeaders) {
        c.res.headers.set('RateLimit-Limit', config.max.toString());
        c.res.headers.set('RateLimit-Remaining', '0');
        c.res.headers.set('RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000).toString());
      }
      
      if (config.legacyHeaders !== false) {
        c.res.headers.set('X-RateLimit-Limit', config.max.toString());
        c.res.headers.set('X-RateLimit-Remaining', '0');
        c.res.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000).toString());
      }
      
      c.res.headers.set('Retry-After', retryAfter.toString());
      
      return c.json({ error: config.message }, 429);
    }
    
    // Set rate limit headers for successful requests
    const remaining = Math.max(0, config.max - rateLimitInfo.count);
    
    if (config.standardHeaders) {
      c.res.headers.set('RateLimit-Limit', config.max.toString());
      c.res.headers.set('RateLimit-Remaining', remaining.toString());
      c.res.headers.set('RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000).toString());
    }
    
    if (config.legacyHeaders !== false) {
      c.res.headers.set('X-RateLimit-Limit', config.max.toString());
      c.res.headers.set('X-RateLimit-Remaining', remaining.toString());
      c.res.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitInfo.resetTime / 1000).toString());
    }
    
    await next();
  };
};