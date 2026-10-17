import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/welcome/reconciliation.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../emails/welcome/reconciliation.spec")["default"]>(databaseSchema, groupLayer);

export default {
["reconcileWelcomeIntentLifecycle"]: RegisteredConvexFunction.register({ ...definitions["reconcileWelcomeIntentLifecycle"], handler: forward(definitions["reconcileWelcomeIntentLifecycle"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../emails/welcome/reconciliation.spec")["default"]>;
