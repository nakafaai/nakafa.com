import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/profile.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/profile.spec")["default"]>(databaseSchema, groupLayer);

export default {
["get"]: RegisteredConvexFunction.register({ ...definitions["get"], handler: forward(definitions["get"].handler) }),
["refusal"]: RegisteredConvexFunction.register({ ...definitions["refusal"], handler: forward(definitions["refusal"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/profile.spec")["default"]>;
