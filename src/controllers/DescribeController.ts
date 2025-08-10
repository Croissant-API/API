import { Request, Response } from "express";
import { controller, httpGet } from "inversify-express-utils";
import { getAllDescriptions } from "../decorators/describe";

@controller("/describe")
export class DescribeController {
  @httpGet("/")
  public async getDescriptions(req: Request, res: Response) {
    res.json(getAllDescriptions());
  }
}
