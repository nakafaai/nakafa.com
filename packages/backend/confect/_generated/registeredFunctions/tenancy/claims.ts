import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/claims.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/claims.spec")["default"]>(databaseSchema, groupLayer);

export default {
["run"]: RegisteredConvexFunction.register({ ...definitions["run"], handler: forward(definitions["run"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/claims.spec")["default"]>;
