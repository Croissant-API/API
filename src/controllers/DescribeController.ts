import type { Request, Response } from 'express';
import { getAllDescriptions } from '../decorators/describe';
import { controller, httpGet } from '../hono-inversify';

@controller('/describe')
export class DescribeController {
  @httpGet('/')
  public async getDescriptions(req: Request, res: Response) {
    res.json(getAllDescriptions());
  }
}
