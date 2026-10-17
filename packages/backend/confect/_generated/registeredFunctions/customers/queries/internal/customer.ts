import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../../schema";
import groupLayer from "../../../../../customers/queries/internal/customer.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../../customers/queries/internal/customer.spec")["default"]>(databaseSchema, groupLayer);

export default {
["getCustomerByUserId"]: RegisteredConvexFunction.register({ ...definitions["getCustomerByUserId"], handler: forward(definitions["getCustomerByUserId"].handler) }),
["getCustomerDeletionCheckpoint"]: RegisteredConvexFunction.register({ ...definitions["getCustomerDeletionCheckpoint"], handler: forward(definitions["getCustomerDeletionCheckpoint"].handler) }),
["resolveWebhookTarget"]: RegisteredConvexFunction.register({ ...definitions["resolveWebhookTarget"], handler: forward(definitions["resolveWebhookTarget"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../../customers/queries/internal/customer.spec")["default"]>;
