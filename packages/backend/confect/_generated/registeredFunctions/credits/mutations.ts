import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../credits/mutations.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../credits/mutations.spec")["default"]>(databaseSchema, groupLayer);

export default {
["syncCreditResetPeriod"]: RegisteredConvexFunction.register({ ...definitions["syncCreditResetPeriod"], handler: forward(definitions["syncCreditResetPeriod"].handler) }),
["syncAllCreditResetPeriods"]: RegisteredConvexFunction.register({ ...definitions["syncAllCreditResetPeriods"], handler: forward(definitions["syncAllCreditResetPeriods"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../credits/mutations.spec")["default"]>;
