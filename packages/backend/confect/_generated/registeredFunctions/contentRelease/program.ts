import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/program.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/program.spec")["default"]>(databaseSchema, groupLayer);

export default {
["catalog"]: RegisteredConvexFunction.register({ ...definitions["catalog"], handler: forward(definitions["catalog"].handler) }),
["subjects"]: RegisteredConvexFunction.register({ ...definitions["subjects"], handler: forward(definitions["subjects"].handler) }),
["context"]: RegisteredConvexFunction.register({ ...definitions["context"], handler: forward(definitions["context"].handler) }),
["page"]: RegisteredConvexFunction.register({ ...definitions["page"], handler: forward(definitions["page"].handler) }),
["path"]: RegisteredConvexFunction.register({ ...definitions["path"], handler: forward(definitions["path"].handler) }),
["route"]: RegisteredConvexFunction.register({ ...definitions["route"], handler: forward(definitions["route"].handler) }),
["sitemapBuckets"]: RegisteredConvexFunction.register({ ...definitions["sitemapBuckets"], handler: forward(definitions["sitemapBuckets"].handler) }),
["sitemapPage"]: RegisteredConvexFunction.register({ ...definitions["sitemapPage"], handler: forward(definitions["sitemapPage"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/program.spec")["default"]>;
