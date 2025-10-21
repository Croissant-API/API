import 'reflect-metadata';
import container from './container'; // Use the existing container
import { TestController } from './controllers/TestController';
import { Users } from './controllers/UserController';
import { InversifyHonoServer } from './hono-inversify/InversifyHonoServer';


console.log('Setting up container...');

// Bind controllers to the existing container
container.bind<Users>(Users).toSelf().inTransientScope();
container.bind<TestController>(TestController).toSelf().inTransientScope();

console.log('Container setup complete');

// Create the Hono-Inversify server
const server = new InversifyHonoServer(container);

// Optional configuration (global middlewares, etc.)
server.setConfig((app) => {
  // CORS middleware
  app.use('*', async (c, next) => {
    c.res.headers.set('Access-Control-Allow-Origin', '*');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (c.req.method === 'OPTIONS') {
      return c.text('', 200);
    }
    
    await next();
  });
});

console.log('Building app...');

// Build the application
export const app = server.build();

console.log('App built successfully');


