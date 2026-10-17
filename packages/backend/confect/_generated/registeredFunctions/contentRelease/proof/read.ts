import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/proof/read.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contentRelease/proof/read.spec")["default"]>(databaseSchema, groupLayer);

export default {
["state"]: RegisteredConvexFunction.register({ ...definitions["state"], handler: forward(definitions["state"].handler) }),
["artifactPlan"]: RegisteredConvexFunction.register({ ...definitions["artifactPlan"], handler: forward(definitions["artifactPlan"].handler) }),
["artifactBatch"]: RegisteredConvexFunction.register({ ...definitions["artifactBatch"], handler: forward(definitions["artifactBatch"].handler) }),
["page"]: RegisteredConvexFunction.register({ ...definitions["page"], handler: forward(definitions["page"].handler) }),
["routePage"]: RegisteredConvexFunction.register({ ...definitions["routePage"], handler: forward(definitions["routePage"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contentRelease/proof/read.spec")["default"]>;
