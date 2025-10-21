// import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
const app = express(); 

const port = parseInt(process.env.PORT as string) || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

// export default httpServerHandler({ port: port });
// export default {
//   fetch: async (request: Request) => {
//     return new Response('Hello from Croissant API!', { status: 200 });
//   }
// }