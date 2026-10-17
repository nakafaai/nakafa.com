import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/article/internal.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contentRelease/article/internal.spec")["default"]>(databaseSchema, groupLayer);

export default {
["readAgentTaxonomy"]: RegisteredConvexFunction.register({ ...definitions["readAgentTaxonomy"], handler: forward(definitions["readAgentTaxonomy"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contentRelease/article/internal.spec")["default"]>;
