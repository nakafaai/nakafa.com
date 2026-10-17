import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../nina/sealed.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../nina/sealed.spec")["default"]>(databaseSchema, groupLayer);

export default {
["thread"]: RegisteredConvexFunction.register({ ...definitions["thread"], handler: forward(definitions["thread"].handler) }),
["message"]: RegisteredConvexFunction.register({ ...definitions["message"], handler: forward(definitions["message"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../nina/sealed.spec")["default"]>;
