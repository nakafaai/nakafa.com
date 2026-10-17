import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/artifacts.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/artifacts.spec")["default"]>(databaseSchema, groupLayer);

export default {
["stageArtifactBatch"]: RegisteredConvexFunction.register({ ...definitions["stageArtifactBatch"], handler: forward(definitions["stageArtifactBatch"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/artifacts.spec")["default"]>;
