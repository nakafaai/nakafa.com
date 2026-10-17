import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../subscriptions/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../subscriptions/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["hasActiveSubscription"]: RegisteredConvexFunction.register({ ...definitions["hasActiveSubscription"], handler: forward(definitions["hasActiveSubscription"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../subscriptions/queries.spec")["default"]>;
