import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../billing/polar/school.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../billing/polar/school.spec")["default"]>(databaseSchema, groupLayer);

export default {
["checkout"]: RegisteredConvexFunction.register({ ...definitions["checkout"], handler: forward(definitions["checkout"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../billing/polar/school.spec")["default"]>;
