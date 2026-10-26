import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../integrations/reads.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../integrations/reads.spec")["default"]>(databaseSchema, groupLayer);

export default {
["periods"]: RegisteredConvexFunction.register({ ...definitions["periods"], handler: forward(definitions["periods"].handler) }),
["cohorts"]: RegisteredConvexFunction.register({ ...definitions["cohorts"], handler: forward(definitions["cohorts"].handler) }),
["people"]: RegisteredConvexFunction.register({ ...definitions["people"], handler: forward(definitions["people"].handler) }),
["placements"]: RegisteredConvexFunction.register({ ...definitions["placements"], handler: forward(definitions["placements"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../integrations/reads.spec")["default"]>;
