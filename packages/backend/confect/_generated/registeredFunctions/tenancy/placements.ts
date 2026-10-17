import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../tenancy/placements.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../tenancy/placements.spec")["default"]>(databaseSchema, groupLayer);

export default {
["place"]: RegisteredConvexFunction.register({ ...definitions["place"], handler: forward(definitions["place"].handler) }),
["move"]: RegisteredConvexFunction.register({ ...definitions["move"], handler: forward(definitions["move"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../tenancy/placements.spec")["default"]>;
