import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../billing/xendit/checkout.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../billing/xendit/checkout.spec")["default"]>(databaseSchema, groupLayer);

export default {
["prepare"]: RegisteredConvexFunction.register({ ...definitions["prepare"], handler: forward(definitions["prepare"].handler) }),
["admit"]: RegisteredConvexFunction.register({ ...definitions["admit"], handler: forward(definitions["admit"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../billing/xendit/checkout.spec")["default"]>;
