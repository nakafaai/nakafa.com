import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../classroom/passages.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../classroom/passages.spec")["default"]>(databaseSchema, groupLayer);

export default {
["source"]: RegisteredConvexFunction.register({ ...definitions["source"], handler: forward(definitions["source"].handler) }),
["build"]: RegisteredConvexFunction.register({ ...definitions["build"], handler: forward(definitions["build"].handler) }),
["store"]: RegisteredConvexFunction.register({ ...definitions["store"], handler: forward(definitions["store"].handler) }),
["clear"]: RegisteredConvexFunction.register({ ...definitions["clear"], handler: forward(definitions["clear"].handler) }),
["rebuild"]: RegisteredConvexFunction.register({ ...definitions["rebuild"], handler: forward(definitions["rebuild"].handler) }),
["open"]: RegisteredConvexFunction.register({ ...definitions["open"], handler: forward(definitions["open"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../classroom/passages.spec")["default"]>;
