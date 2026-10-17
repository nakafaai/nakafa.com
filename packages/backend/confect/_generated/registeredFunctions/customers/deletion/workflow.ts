import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../customers/deletion/workflow.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../customers/deletion/workflow.spec")["default"]>(databaseSchema, groupLayer);

export default {
["finalizeDeletedUserCleanup"]: RegisteredConvexFunction.register({ ...definitions["finalizeDeletedUserCleanup"], handler: forward(definitions["finalizeDeletedUserCleanup"].handler) }),
["launchDeletedUserCleanup"]: RegisteredConvexFunction.register({ ...definitions["launchDeletedUserCleanup"], handler: forward(definitions["launchDeletedUserCleanup"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../customers/deletion/workflow.spec")["default"]>;
