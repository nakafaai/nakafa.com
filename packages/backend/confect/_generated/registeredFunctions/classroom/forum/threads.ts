import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../../schema";
import groupLayer from "../../../../classroom/forum/threads.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../../classroom/forum/threads.spec")["default"]>(databaseSchema, groupLayer);

export default {
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
["get"]: RegisteredConvexFunction.register({ ...definitions["get"], handler: forward(definitions["get"].handler) }),
["replies"]: RegisteredConvexFunction.register({ ...definitions["replies"], handler: forward(definitions["replies"].handler) }),
["reply"]: RegisteredConvexFunction.register({ ...definitions["reply"], handler: forward(definitions["reply"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../../classroom/forum/threads.spec")["default"]>;
