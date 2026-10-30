import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../notifications/deliver.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../notifications/deliver.spec")["default"]>(databaseSchema, groupLayer);

export default {
["notice"]: RegisteredConvexFunction.register({ ...definitions["notice"], handler: forward(definitions["notice"].handler) }),
["forget"]: RegisteredConvexFunction.register({ ...definitions["forget"], handler: forward(definitions["forget"].handler) }),
["send"]: RegisteredConvexFunction.register({ ...definitions["send"], handler: forward(definitions["send"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../notifications/deliver.spec")["default"]>;
