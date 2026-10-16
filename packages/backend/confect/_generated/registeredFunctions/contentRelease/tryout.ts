import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/tryout.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/tryout.spec")["default"]>(databaseSchema, groupLayer);

export default {
["catalog"]: RegisteredConvexFunction.register({ ...definitions["catalog"], handler: forward(definitions["catalog"].handler) }),
["sitemapCount"]: RegisteredConvexFunction.register({ ...definitions["sitemapCount"], handler: forward(definitions["sitemapCount"].handler) }),
["sitemapPage"]: RegisteredConvexFunction.register({ ...definitions["sitemapPage"], handler: forward(definitions["sitemapPage"].handler) }),
["taxonomy"]: RegisteredConvexFunction.register({ ...definitions["taxonomy"], handler: forward(definitions["taxonomy"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/tryout.spec")["default"]>;
