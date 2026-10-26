import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../billing/xendit/cancel.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../billing/xendit/cancel.spec")["default"]>(databaseSchema, groupLayer);

export default {
["cancelPlan"]: RegisteredConvexFunction.register({ ...definitions["cancelPlan"], handler: forward(definitions["cancelPlan"].handler) }),
["deactivate"]: RegisteredConvexFunction.register({ ...definitions["deactivate"], handler: forward(definitions["deactivate"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../billing/xendit/cancel.spec")["default"]>;
