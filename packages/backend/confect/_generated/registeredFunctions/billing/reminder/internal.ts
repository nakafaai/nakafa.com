import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../billing/reminder/internal.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../billing/reminder/internal.spec")["default"]>(databaseSchema, groupLayer);

export default {
["readInput"]: RegisteredConvexFunction.register({ ...definitions["readInput"], handler: forward(definitions["readInput"].handler) }),
["enqueue"]: RegisteredConvexFunction.register({ ...definitions["enqueue"], handler: forward(definitions["enqueue"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../billing/reminder/internal.spec")["default"]>;
