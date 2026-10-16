import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/material.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/material.spec")["default"]>(databaseSchema, groupLayer);

export default {
["lesson"]: RegisteredConvexFunction.register({ ...definitions["lesson"], handler: forward(definitions["lesson"].handler) }),
["navigation"]: RegisteredConvexFunction.register({ ...definitions["navigation"], handler: forward(definitions["navigation"].handler) }),
["identity"]: RegisteredConvexFunction.register({ ...definitions["identity"], handler: forward(definitions["identity"].handler) }),
["apiPage"]: RegisteredConvexFunction.register({ ...definitions["apiPage"], handler: forward(definitions["apiPage"].handler) }),
["bucket"]: RegisteredConvexFunction.register({ ...definitions["bucket"], handler: forward(definitions["bucket"].handler) }),
["latest"]: RegisteredConvexFunction.register({ ...definitions["latest"], handler: forward(definitions["latest"].handler) }),
["publication"]: RegisteredConvexFunction.register({ ...definitions["publication"], handler: forward(definitions["publication"].handler) }),
["sitemapBuckets"]: RegisteredConvexFunction.register({ ...definitions["sitemapBuckets"], handler: forward(definitions["sitemapBuckets"].handler) }),
["sitemapPage"]: RegisteredConvexFunction.register({ ...definitions["sitemapPage"], handler: forward(definitions["sitemapPage"].handler) }),
["publications"]: RegisteredConvexFunction.register({ ...definitions["publications"], handler: forward(definitions["publications"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/material.spec")["default"]>;
