import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/proof/catalog.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contentRelease/proof/catalog.spec")["default"]>(databaseSchema, groupLayer);

export default {
["page"]: RegisteredConvexFunction.register({ ...definitions["page"], handler: forward(definitions["page"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contentRelease/proof/catalog.spec")["default"]>;
