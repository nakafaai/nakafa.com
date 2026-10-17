import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../analytics/erasure/action.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../analytics/erasure/action.spec")["default"]>(databaseSchema, groupLayer);

export default {
["eraseUserAnalytics"]: RegisteredConvexFunction.register({ ...definitions["eraseUserAnalytics"], handler: forward(definitions["eraseUserAnalytics"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../analytics/erasure/action.spec")["default"]>;
