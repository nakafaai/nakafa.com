import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../contentRelease/manifest.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../contentRelease/manifest.spec")["default"]>(databaseSchema, groupLayer);

export default {
["stageRelease"]: RegisteredConvexFunction.register({ ...definitions["stageRelease"], handler: forward(definitions["stageRelease"].handler) }),
["stageRecovery"]: RegisteredConvexFunction.register({ ...definitions["stageRecovery"], handler: forward(definitions["stageRecovery"].handler) }),
["abort"]: RegisteredConvexFunction.register({ ...definitions["abort"], handler: forward(definitions["abort"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../contentRelease/manifest.spec")["default"]>;
