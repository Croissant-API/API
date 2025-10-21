import { Context } from 'hono';
import { injectable } from 'inversify';
import { getAllDescriptions } from '../decorators/describe';
import { controller, httpGet } from '../hono-inversify';

@injectable()
@controller('/describe')
export class DescribeController {
  @httpGet('/')
  public async getDescriptions(c: Context) {
    return c.json(getAllDescriptions());
  }
}
