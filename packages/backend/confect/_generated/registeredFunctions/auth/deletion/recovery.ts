import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../auth/deletion/recovery.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../auth/deletion/recovery.spec")["default"]>(databaseSchema, groupLayer);

export default {
["sweepAccountDeletionRecovery"]: RegisteredConvexFunction.register({ ...definitions["sweepAccountDeletionRecovery"], handler: forward(definitions["sweepAccountDeletionRecovery"].handler) }),
["recoverAccountDeletion"]: RegisteredConvexFunction.register({ ...definitions["recoverAccountDeletion"], handler: forward(definitions["recoverAccountDeletion"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../auth/deletion/recovery.spec")["default"]>;
