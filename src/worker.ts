// import { Hono } from 'hono';

// // simple edge handler; keep it independent of any Node-only modules
// const app = new Hono();

// // example route - you can extend this as needed for edge logic
// app.get('/', (ctx) => ctx.text('edge worker running'));

// export default app;

import { app } from './app';

export default app;
