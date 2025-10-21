import { Context } from 'hono';
import { controller, httpGet, httpPost } from '../hono-inversify';

@controller('/test')
export class TestController {
  
  @httpGet('/hello')
  async hello(c: Context) {
    return c.json({ message: 'Hello from Hono with Inversify!' });
  }

  @httpPost('/echo')
  async echo(c: Context) {
    const body = await c.req.json();
    return c.json({ 
      echo: body,
      method: c.req.method,
      path: c.req.path,
      contentType: c.req.header('content-type')
    });
  }

  @httpGet('/headers')
  async getHeaders(c: Context) {
    const clientIP = c.req.header('cf-connecting-ip') || 
                     c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 
                     'unknown';
    
    return c.json({
      clientIP,
      userAgent: c.req.header('user-agent'),
      host: c.req.header('host'),
      url: c.req.url
    });
  }
}