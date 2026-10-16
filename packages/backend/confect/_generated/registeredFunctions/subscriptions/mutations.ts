import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../subscriptions/mutations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../subscriptions/mutations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["createSubscription"]: RegisteredConvexFunction.register({ ...definitions["createSubscription"], handler: forward(definitions["createSubscription"].handler) }),
["updateSubscription"]: RegisteredConvexFunction.register({ ...definitions["updateSubscription"], handler: forward(definitions["updateSubscription"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../subscriptions/mutations.spec")["default"]>;
