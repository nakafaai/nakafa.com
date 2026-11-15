import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../practice/sessions.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../practice/sessions.spec")["default"]>(databaseSchema, groupLayer);

export default {
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
["restart"]: RegisteredConvexFunction.register({ ...definitions["restart"], handler: forward(definitions["restart"].handler) }),
["check"]: RegisteredConvexFunction.register({ ...definitions["check"], handler: forward(definitions["check"].handler) }),
["state"]: RegisteredConvexFunction.register({ ...definitions["state"], handler: forward(definitions["state"].handler) }),
["content"]: RegisteredConvexFunction.register({ ...definitions["content"], handler: forward(definitions["content"].handler) }),
["explain"]: RegisteredConvexFunction.register({ ...definitions["explain"], handler: forward(definitions["explain"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../practice/sessions.spec")["default"]>;
