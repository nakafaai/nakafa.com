import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../customers/actions/internal.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../customers/actions/internal.spec")["default"]>(databaseSchema, groupLayer);

export default {
["syncCustomer"]: RegisteredConvexFunction.register({ ...definitions["syncCustomer"], handler: forward(definitions["syncCustomer"].handler) }),
["cleanupDeletedUserCustomerData"]: RegisteredConvexFunction.register({ ...definitions["cleanupDeletedUserCustomerData"], handler: forward(definitions["cleanupDeletedUserCustomerData"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../customers/actions/internal.spec")["default"]>;
