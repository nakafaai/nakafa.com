import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../customers/mutations/internal.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../customers/mutations/internal.spec")["default"]>(databaseSchema, groupLayer);

export default {
["deleteCustomerById"]: RegisteredConvexFunction.register({ ...definitions["deleteCustomerById"], handler: forward(definitions["deleteCustomerById"].handler) }),
["recordCustomerDeletionCheckpoint"]: RegisteredConvexFunction.register({ ...definitions["recordCustomerDeletionCheckpoint"], handler: forward(definitions["recordCustomerDeletionCheckpoint"].handler) }),
["completeCustomerDeletionCheckpoint"]: RegisteredConvexFunction.register({ ...definitions["completeCustomerDeletionCheckpoint"], handler: forward(definitions["completeCustomerDeletionCheckpoint"].handler) }),
["upsertCustomer"]: RegisteredConvexFunction.register({ ...definitions["upsertCustomer"], handler: forward(definitions["upsertCustomer"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../customers/mutations/internal.spec")["default"]>;
