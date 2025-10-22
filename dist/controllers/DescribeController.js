"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DescribeController = void 0;
const inversify_express_utils_1 = require("inversify-express-utils");
const describe_1 = require("../decorators/describe");
let DescribeController = class DescribeController {
    async getDescriptions(req, res) {
        res.json((0, describe_1.getAllDescriptions)());
    }
};
exports.DescribeController = DescribeController;
__decorate([
    (0, inversify_express_utils_1.httpGet)('/')
], DescribeController.prototype, "getDescriptions", null);
exports.DescribeController = DescribeController = __decorate([
    (0, inversify_express_utils_1.controller)('/describe')
], DescribeController);
