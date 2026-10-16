import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/snapshot/manifest.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contentRelease/snapshot/manifest.spec")["default"]>(databaseSchema, groupLayer);

export default {
["stageSnapshot"]: RegisteredConvexFunction.register({ ...definitions["stageSnapshot"], handler: forward(definitions["stageSnapshot"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contentRelease/snapshot/manifest.spec")["default"]>;
