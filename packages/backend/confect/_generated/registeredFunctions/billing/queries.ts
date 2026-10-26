import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../billing/queries.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../billing/queries.spec")["default"]>(databaseSchema, groupLayer);

export default {
["overview"]: RegisteredConvexFunction.register({ ...definitions["overview"], handler: forward(definitions["overview"].handler) }),
["payments"]: RegisteredConvexFunction.register({ ...definitions["payments"], handler: forward(definitions["payments"].handler) }),
["proOffers"]: RegisteredConvexFunction.register({ ...definitions["proOffers"], handler: forward(definitions["proOffers"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../billing/queries.spec")["default"]>;
