import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../billing/migration.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../billing/migration.spec")["default"]>(databaseSchema, groupLayer);

export default {
["copyPolarSubscriptionsPage"]: RegisteredConvexFunction.register({ ...definitions["copyPolarSubscriptionsPage"], handler: forward(definitions["copyPolarSubscriptionsPage"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../billing/migration.spec")["default"]>;
