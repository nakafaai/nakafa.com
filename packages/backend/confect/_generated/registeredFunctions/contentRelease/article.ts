import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/article.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/article.spec")["default"]>(databaseSchema, groupLayer);

export default {
["delivery"]: RegisteredConvexFunction.register({ ...definitions["delivery"], handler: forward(definitions["delivery"].handler) }),
["apiPage"]: RegisteredConvexFunction.register({ ...definitions["apiPage"], handler: forward(definitions["apiPage"].handler) }),
["route"]: RegisteredConvexFunction.register({ ...definitions["route"], handler: forward(definitions["route"].handler) }),
["publications"]: RegisteredConvexFunction.register({ ...definitions["publications"], handler: forward(definitions["publications"].handler) }),
["categories"]: RegisteredConvexFunction.register({ ...definitions["categories"], handler: forward(definitions["categories"].handler) }),
["bucket"]: RegisteredConvexFunction.register({ ...definitions["bucket"], handler: forward(definitions["bucket"].handler) }),
["latest"]: RegisteredConvexFunction.register({ ...definitions["latest"], handler: forward(definitions["latest"].handler) }),
["listing"]: RegisteredConvexFunction.register({ ...definitions["listing"], handler: forward(definitions["listing"].handler) }),
["sitemapBuckets"]: RegisteredConvexFunction.register({ ...definitions["sitemapBuckets"], handler: forward(definitions["sitemapBuckets"].handler) }),
["sitemapPage"]: RegisteredConvexFunction.register({ ...definitions["sitemapPage"], handler: forward(definitions["sitemapPage"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/article.spec")["default"]>;
