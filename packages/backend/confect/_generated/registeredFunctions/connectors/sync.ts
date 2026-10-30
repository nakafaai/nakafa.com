import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../connectors/sync.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../connectors/sync.spec")["default"]>(databaseSchema, groupLayer);

export default {
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
["target"]: RegisteredConvexFunction.register({ ...definitions["target"], handler: forward(definitions["target"].handler) }),
["run"]: RegisteredConvexFunction.register({ ...definitions["run"], handler: forward(definitions["run"].handler) }),
["storeEvents"]: RegisteredConvexFunction.register({ ...definitions["storeEvents"], handler: forward(definitions["storeEvents"].handler) }),
["settle"]: RegisteredConvexFunction.register({ ...definitions["settle"], handler: forward(definitions["settle"].handler) }),
["reconnect"]: RegisteredConvexFunction.register({ ...definitions["reconnect"], handler: forward(definitions["reconnect"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../connectors/sync.spec")["default"]>;
