import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/assignments.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/assignments.spec")["default"]>(databaseSchema, groupLayer);

export default {
["assign"]: RegisteredConvexFunction.register({ ...definitions["assign"], handler: forward(definitions["assign"].handler) }),
["unassign"]: RegisteredConvexFunction.register({ ...definitions["unassign"], handler: forward(definitions["unassign"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/assignments.spec")["default"]>;
