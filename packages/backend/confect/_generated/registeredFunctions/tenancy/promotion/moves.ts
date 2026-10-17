import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../tenancy/promotion/moves.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../tenancy/promotion/moves.spec")["default"]>(databaseSchema, groupLayer);

export default {
["setMove"]: RegisteredConvexFunction.register({ ...definitions["setMove"], handler: forward(definitions["setMove"].handler) }),
["moves"]: RegisteredConvexFunction.register({ ...definitions["moves"], handler: forward(definitions["moves"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../tenancy/promotion/moves.spec")["default"]>;
