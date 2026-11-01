import { ConvexFunctionDefinitions, RegisteredConvexFunction, type RegisteredFunctions } from "@confect/server";
import databaseSchema from "../../schema";
import groupLayer from "../../../integrations/hooks.impl";

const forward = <Ctx, Args, Returns>(handler: (ctx: Ctx, args: Args) => Promise<Returns>) => (ctx: Ctx, args: Args) => handler(ctx, args);

const definitions = ConvexFunctionDefinitions.buildForGroup<typeof import("../../../integrations/hooks.spec")["default"]>(databaseSchema, groupLayer);

export default {
["sweep"]: RegisteredConvexFunction.register({ ...definitions["sweep"], handler: forward(definitions["sweep"].handler) }),
["run"]: RegisteredConvexFunction.register({ ...definitions["run"], handler: forward(definitions["run"].handler) }),
["prepare"]: RegisteredConvexFunction.register({ ...definitions["prepare"], handler: forward(definitions["prepare"].handler) }),
["deliver"]: RegisteredConvexFunction.register({ ...definitions["deliver"], handler: forward(definitions["deliver"].handler) }),
["settle"]: RegisteredConvexFunction.register({ ...definitions["settle"], handler: forward(definitions["settle"].handler) }),
["prune"]: RegisteredConvexFunction.register({ ...definitions["prune"], handler: forward(definitions["prune"].handler) }),
} as RegisteredFunctions.RegisteredFunctionsForGroupSpec<typeof import("../../../integrations/hooks.spec")["default"]>;
