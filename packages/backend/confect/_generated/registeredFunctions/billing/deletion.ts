import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../billing/deletion.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../billing/deletion.spec")["default"]>(databaseSchema, groupLayer);

export default {
["readAccounts"]: RegisteredConvexFunction.register({ ...definitions["readAccounts"], handler: forward(definitions["readAccounts"].handler) }),
["deleteRows"]: RegisteredConvexFunction.register({ ...definitions["deleteRows"], handler: forward(definitions["deleteRows"].handler) }),
["cleanupDeletedUserBilling"]: RegisteredConvexFunction.register({ ...definitions["cleanupDeletedUserBilling"], handler: forward(definitions["cleanupDeletedUserBilling"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../billing/deletion.spec")["default"]>;
