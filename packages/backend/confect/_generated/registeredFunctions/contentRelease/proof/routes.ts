import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../contentRelease/proof/routes.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../contentRelease/proof/routes.spec")["default"]>(databaseSchema, groupLayer);

export default {
["routes"]: RegisteredConvexFunction.register({ ...definitions["routes"], handler: forward(definitions["routes"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../contentRelease/proof/routes.spec")["default"]>;
