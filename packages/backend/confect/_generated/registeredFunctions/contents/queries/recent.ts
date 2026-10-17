import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contents/queries/recent.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contents/queries/recent.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getRecentlyViewed"]: RegisteredConvexFunction.register({ ...definitions["getRecentlyViewed"], handler: forward(definitions["getRecentlyViewed"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contents/queries/recent.spec")["default"]>;
