import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../nina/memory.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../nina/memory.spec")["default"]>(databaseSchema, groupLayer);

export default {
["list"]: RegisteredConvexFunction.register({ ...definitions["list"], handler: forward(definitions["list"].handler) }),
["state"]: RegisteredConvexFunction.register({ ...definitions["state"], handler: forward(definitions["state"].handler) }),
["add"]: RegisteredConvexFunction.register({ ...definitions["add"], handler: forward(definitions["add"].handler) }),
["edit"]: RegisteredConvexFunction.register({ ...definitions["edit"], handler: forward(definitions["edit"].handler) }),
["remove"]: RegisteredConvexFunction.register({ ...definitions["remove"], handler: forward(definitions["remove"].handler) }),
["restore"]: RegisteredConvexFunction.register({ ...definitions["restore"], handler: forward(definitions["restore"].handler) }),
["pause"]: RegisteredConvexFunction.register({ ...definitions["pause"], handler: forward(definitions["pause"].handler) }),
["clear"]: RegisteredConvexFunction.register({ ...definitions["clear"], handler: forward(definitions["clear"].handler) }),
["lookup"]: RegisteredConvexFunction.register({ ...definitions["lookup"], handler: forward(definitions["lookup"].handler) }),
["paused"]: RegisteredConvexFunction.register({ ...definitions["paused"], handler: forward(definitions["paused"].handler) }),
["known"]: RegisteredConvexFunction.register({ ...definitions["known"], handler: forward(definitions["known"].handler) }),
["capture"]: RegisteredConvexFunction.register({ ...definitions["capture"], handler: forward(definitions["capture"].handler) }),
["drain"]: RegisteredConvexFunction.register({ ...definitions["drain"], handler: forward(definitions["drain"].handler) }),
["expire"]: RegisteredConvexFunction.register({ ...definitions["expire"], handler: forward(definitions["expire"].handler) }),
["purge"]: RegisteredConvexFunction.register({ ...definitions["purge"], handler: forward(definitions["purge"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../nina/memory.spec")["default"]>;
