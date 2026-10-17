import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/snapshot/batch.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contentRelease/snapshot/batch.spec")["default"]>(databaseSchema, groupLayer);

export default {
["stageSnapshotBatch"]: RegisteredConvexFunction.register({ ...definitions["stageSnapshotBatch"], handler: forward(definitions["stageSnapshotBatch"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contentRelease/snapshot/batch.spec")["default"]>;
