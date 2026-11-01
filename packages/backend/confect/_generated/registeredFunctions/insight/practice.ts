import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../insight/practice.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../insight/practice.spec")["default"]>(databaseSchema, groupLayer);

export default {
["topics"]: RegisteredConvexFunction.register({ ...definitions["topics"], handler: forward(definitions["topics"].handler) }),
["share"]: RegisteredConvexFunction.register({ ...definitions["share"], handler: forward(definitions["share"].handler) }),
["stop"]: RegisteredConvexFunction.register({ ...definitions["stop"], handler: forward(definitions["stop"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../insight/practice.spec")["default"]>;
