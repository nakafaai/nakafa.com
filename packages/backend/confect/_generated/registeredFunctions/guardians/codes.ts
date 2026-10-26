import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../guardians/codes.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../guardians/codes.spec")["default"]>(databaseSchema, groupLayer);

export default {
["send"]: RegisteredConvexFunction.register({ ...definitions["send"], handler: forward(definitions["send"].handler) }),
["redeem"]: RegisteredConvexFunction.register({ ...definitions["redeem"], handler: forward(definitions["redeem"].handler) }),
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../guardians/codes.spec")["default"]>;
