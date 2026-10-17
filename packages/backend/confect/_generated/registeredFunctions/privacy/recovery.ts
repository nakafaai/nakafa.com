import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../privacy/recovery.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../privacy/recovery.spec")["default"]>(databaseSchema, groupLayer);

export default {
["retryCleanupWorkflow"]: RegisteredConvexFunction.register({ ...definitions["retryCleanupWorkflow"], handler: forward(definitions["retryCleanupWorkflow"].handler) }),
["handleCleanupComplete"]: definitions["handleCleanupComplete"].handler,
["cleanupWorkflowStorage"]: RegisteredConvexFunction.register({ ...definitions["cleanupWorkflowStorage"], handler: forward(definitions["cleanupWorkflowStorage"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../privacy/recovery.spec")["default"]>;
