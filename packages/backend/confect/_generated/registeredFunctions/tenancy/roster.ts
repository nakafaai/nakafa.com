import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/roster.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/roster.spec")["default"]>(databaseSchema, groupLayer);

export default {
["members"]: RegisteredConvexFunction.register({ ...definitions["members"], handler: forward(definitions["members"].handler) }),
["invite"]: RegisteredConvexFunction.register({ ...definitions["invite"], handler: forward(definitions["invite"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/roster.spec")["default"]>;
