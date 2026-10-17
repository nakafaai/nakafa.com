import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../nina/sealed.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../nina/sealed.spec")["default"]>(databaseSchema, groupLayer);

export default {
["thread"]: RegisteredConvexFunction.register({ ...definitions["thread"], handler: forward(definitions["thread"].handler) }),
["message"]: RegisteredConvexFunction.register({ ...definitions["message"], handler: forward(definitions["message"].handler) }),
["seal"]: RegisteredConvexFunction.register({ ...definitions["seal"], handler: forward(definitions["seal"].handler) }),
["drain"]: RegisteredConvexFunction.register({ ...definitions["drain"], handler: forward(definitions["drain"].handler) }),
["candidates"]: RegisteredConvexFunction.register({ ...definitions["candidates"], handler: forward(definitions["candidates"].handler) }),
["recordFailure"]: RegisteredConvexFunction.register({ ...definitions["recordFailure"], handler: forward(definitions["recordFailure"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../nina/sealed.spec")["default"]>;
