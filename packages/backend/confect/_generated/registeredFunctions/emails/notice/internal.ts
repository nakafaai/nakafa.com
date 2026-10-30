import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../emails/notice/internal.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../emails/notice/internal.spec")["default"]>(databaseSchema, groupLayer);

export default {
["readInput"]: RegisteredConvexFunction.register({ ...definitions["readInput"], handler: forward(definitions["readInput"].handler) }),
["enqueue"]: RegisteredConvexFunction.register({ ...definitions["enqueue"], handler: forward(definitions["enqueue"].handler) }),
["send"]: RegisteredConvexFunction.register({ ...definitions["send"], handler: forward(definitions["send"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../emails/notice/internal.spec")["default"]>;
