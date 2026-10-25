import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../billing/topup.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../billing/topup.spec")["default"]>(databaseSchema, groupLayer);

export default {
["refundWithoutPro"]: RegisteredConvexFunction.register({ ...definitions["refundWithoutPro"], handler: forward(definitions["refundWithoutPro"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../billing/topup.spec")["default"]>;
