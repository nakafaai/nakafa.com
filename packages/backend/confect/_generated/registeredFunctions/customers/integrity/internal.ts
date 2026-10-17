import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../customers/integrity/internal.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../customers/integrity/internal.spec")["default"]>(databaseSchema, groupLayer);

export default {
["listUsersForCustomerIntegrity"]: RegisteredConvexFunction.register({ ...definitions["listUsersForCustomerIntegrity"], handler: forward(definitions["listUsersForCustomerIntegrity"].handler) }),
["listCustomersForIntegrity"]: RegisteredConvexFunction.register({ ...definitions["listCustomersForIntegrity"], handler: forward(definitions["listCustomersForIntegrity"].handler) }),
["listActiveSubscriptionsForIntegrity"]: RegisteredConvexFunction.register({ ...definitions["listActiveSubscriptionsForIntegrity"], handler: forward(definitions["listActiveSubscriptionsForIntegrity"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../customers/integrity/internal.spec")["default"]>;
