export {}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    export interface Request {
      token?: string;
      user?:{
        id: number;
        mail: string;
        role: string;
      }
    }
  }
}